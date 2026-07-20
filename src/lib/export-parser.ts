import JSZip from "jszip";
import Papa from "papaparse";

export const EXPORT_LIMITS = {
  uploadBytes: 2 * 1_024 * 1_024,
  archiveEntries: 40,
  archiveExpandedBytes: 5 * 1_024 * 1_024,
  entryBytes: 1 * 1_024 * 1_024,
  rowsPerTable: 500,
  columnsPerTable: 100,
  cellCharacters: 2_000,
  jsonDepth: 10,
  jsonNodes: 25_000,
} as const;

export type ExportCell = string | number | boolean | null;
export type ExportRow = Record<string, ExportCell>;

export type ParsedExportTable = {
  path: string;
  format: "csv" | "json";
  columns: string[];
  rows: ExportRow[];
};

export type ParsedExportAttachment = {
  path: string;
  byteLength: number;
  sha256: string;
};

export type ParsedExportPacket = {
  packetName: string;
  inputFormat: "csv" | "json" | "zip";
  inputBytes: number;
  expandedBytes: number;
  tables: ParsedExportTable[];
  attachments: ParsedExportAttachment[];
  warnings: string[];
};

export type SourceFieldEvidence = {
  sourceFile: string;
  sourceField: string;
  evidencePath: string;
  sampleValues: string[];
};

export type ExportParseErrorCode =
  | "unsupported_format"
  | "upload_too_large"
  | "invalid_text"
  | "invalid_csv"
  | "invalid_json"
  | "invalid_zip"
  | "unsafe_archive_path"
  | "archive_limit"
  | "table_limit"
  | "json_limit";

export class ExportParseError extends Error {
  constructor(
    readonly code: ExportParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ExportParseError";
  }
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ExportParseError("invalid_text", "The export contains invalid UTF-8 text.");
  }
}

function normalizeArchivePath(rawPath: string): string {
  const path = rawPath.replaceAll("\\", "/").replace(/^\.\//, "");
  const segments = path.split("/");
  if (
    !path ||
    path.startsWith("/") ||
    /^[A-Za-z]:\//.test(path) ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    segments.length > 12 ||
    path.length > 360
  ) {
    throw new ExportParseError(
      "unsafe_archive_path",
      "The archive contains an unsafe or unsupported path.",
    );
  }
  return segments.join("/");
}

function boundedCell(value: unknown): ExportCell {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) return String(value);
    return value;
  }
  const text = String(value);
  if (text.length > EXPORT_LIMITS.cellCharacters) {
    throw new ExportParseError("table_limit", "A cell exceeds the supported character limit.");
  }
  return text;
}

function validateTable(table: ParsedExportTable): ParsedExportTable {
  if (table.columns.length === 0 || table.columns.length > EXPORT_LIMITS.columnsPerTable) {
    throw new ExportParseError("table_limit", "A table has an unsupported number of columns.");
  }
  if (new Set(table.columns).size !== table.columns.length) {
    throw new ExportParseError("invalid_csv", "A table contains duplicate column names.");
  }
  if (table.rows.length > EXPORT_LIMITS.rowsPerTable) {
    throw new ExportParseError("table_limit", "A table exceeds the supported row limit.");
  }
  for (const column of table.columns) {
    if (!column || column.length > 160) {
      throw new ExportParseError("table_limit", "A column name is empty or too long.");
    }
  }
  for (const row of table.rows) {
    for (const column of table.columns) boundedCell(row[column]);
  }
  return table;
}

function parseCsv(path: string, text: string): ParsedExportTable {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const fatalError = parsed.errors.find((error) => error.type !== "FieldMismatch");
  if (fatalError || parsed.meta.aborted || parsed.meta.truncated) {
    throw new ExportParseError("invalid_csv", "The CSV export could not be parsed safely.");
  }
  const columns = parsed.meta.fields ?? [];
  if (parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length > 0) {
    throw new ExportParseError("invalid_csv", "The CSV export contains duplicate headers.");
  }
  const rows = parsed.data.map((source) =>
    Object.fromEntries(columns.map((column) => [column, boundedCell(source[column])])),
  );
  return validateTable({ path, format: "csv", columns, rows });
}

type JsonBudget = { nodes: number };

function inspectJson(value: unknown, depth: number, budget: JsonBudget): void {
  budget.nodes += 1;
  if (budget.nodes > EXPORT_LIMITS.jsonNodes || depth > EXPORT_LIMITS.jsonDepth) {
    throw new ExportParseError("json_limit", "The JSON export exceeds the supported complexity limit.");
  }
  if (typeof value === "string" && value.length > EXPORT_LIMITS.cellCharacters) {
    throw new ExportParseError("json_limit", "A JSON string exceeds the supported character limit.");
  }
  if (Array.isArray(value)) {
    if (value.length > EXPORT_LIMITS.rowsPerTable) {
      throw new ExportParseError("json_limit", "A JSON array exceeds the supported item limit.");
    }
    for (const item of value) inspectJson(item, depth + 1, budget);
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > EXPORT_LIMITS.columnsPerTable) {
      throw new ExportParseError("json_limit", "A JSON object has too many fields.");
    }
    for (const [key, item] of entries) {
      if (!key || key.length > 160) {
        throw new ExportParseError("json_limit", "A JSON field name is empty or too long.");
      }
      inspectJson(item, depth + 1, budget);
    }
  }
}

function flattenJsonObject(
  source: Record<string, unknown>,
  prefix = "",
  output: ExportRow = {},
): ExportRow {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      output[path] = boundedCell(JSON.stringify(value));
    } else if (value && typeof value === "object") {
      flattenJsonObject(value as Record<string, unknown>, path, output);
    } else {
      output[path] = boundedCell(value);
    }
  }
  return output;
}

function tableFromJsonObjects(
  path: string,
  values: readonly Record<string, unknown>[],
): ParsedExportTable {
  const rows = values.map((value) => flattenJsonObject(value));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  for (const row of rows) {
    for (const column of columns) if (!(column in row)) row[column] = null;
  }
  return validateTable({ path, format: "json", columns, rows });
}

function parseJson(path: string, text: string): ParsedExportTable[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new ExportParseError("invalid_json", "The JSON export is not valid JSON.");
  }
  inspectJson(decoded, 0, { nodes: 0 });

  if (Array.isArray(decoded)) {
    if (!decoded.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      throw new ExportParseError("invalid_json", "A top-level JSON array must contain objects.");
    }
    return [tableFromJsonObjects(path, decoded as Record<string, unknown>[])];
  }
  if (!decoded || typeof decoded !== "object") {
    throw new ExportParseError("invalid_json", "The JSON export must contain an object or object array.");
  }

  const root = decoded as Record<string, unknown>;
  const arrayTables = Object.entries(root)
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .map(([key, value]) => {
      const items = value as unknown[];
      if (!items.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
        throw new ExportParseError("invalid_json", "JSON record collections must contain objects.");
      }
      return tableFromJsonObjects(`${path}#/${key}`, items as Record<string, unknown>[]);
    });

  if (arrayTables.length > 0) return arrayTables;
  return [tableFromJsonObjects(path, [root])];
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function declaredExpandedBytes(entry: JSZip.JSZipObject): number | null {
  const internal = entry as unknown as {
    _data?: { uncompressedSize?: number };
  };
  const value = internal._data?.uncompressedSize;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

async function parseZip(
  packetName: string,
  bytes: Uint8Array,
): Promise<ParsedExportPacket> {
  let archive: JSZip;
  try {
    // CRC verification inflates every entry during load, before our declared
    // size budget can reject a high-ratio ZIP bomb. Read the central directory
    // first, enforce hard declared limits below, then extract entries one at a
    // time while enforcing the measured byte budget as a second guard.
    archive = await JSZip.loadAsync(bytes, {
      checkCRC32: false,
      createFolders: false,
    });
  } catch {
    throw new ExportParseError("invalid_zip", "The ZIP export could not be opened safely.");
  }

  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (entries.length === 0 || entries.length > EXPORT_LIMITS.archiveEntries) {
    throw new ExportParseError("archive_limit", "The ZIP export has an unsupported entry count.");
  }

  const normalizedPaths = new Set<string>();
  let declaredTotal = 0;
  for (const entry of entries) {
    // JSZip sanitizes traversal paths on load. Validate the preserved original
    // name as well so an unsafe archive is rejected rather than silently fixed.
    normalizeArchivePath(entry.unsafeOriginalName ?? entry.name);
    const normalized = normalizeArchivePath(entry.name);
    if (normalizedPaths.has(normalized)) {
      throw new ExportParseError("unsafe_archive_path", "The archive contains duplicate paths.");
    }
    normalizedPaths.add(normalized);
    const declared = declaredExpandedBytes(entry);
    if (declared === null || declared > EXPORT_LIMITS.entryBytes) {
      throw new ExportParseError("archive_limit", "A ZIP entry exceeds the supported size limit.");
    }
    declaredTotal += declared;
    if (declaredTotal > EXPORT_LIMITS.archiveExpandedBytes) {
      throw new ExportParseError("archive_limit", "The ZIP export expands beyond the supported limit.");
    }
  }

  const tables: ParsedExportTable[] = [];
  const attachments: ParsedExportAttachment[] = [];
  const warnings: string[] = [];
  let expandedBytes = 0;

  for (const entry of entries) {
    const path = normalizeArchivePath(entry.name);
    const content = await entry.async("uint8array");
    expandedBytes += content.byteLength;
    if (
      content.byteLength > EXPORT_LIMITS.entryBytes ||
      expandedBytes > EXPORT_LIMITS.archiveExpandedBytes
    ) {
      throw new ExportParseError("archive_limit", "The ZIP export expands beyond the supported limit.");
    }
    const extension = extensionOf(path);
    if (extension === "csv") {
      tables.push(parseCsv(path, decodeUtf8(content)));
    } else if (extension === "json") {
      tables.push(...parseJson(path, decodeUtf8(content)));
    } else {
      attachments.push({ path, byteLength: content.byteLength, sha256: await sha256Hex(content) });
    }
  }

  if (tables.length === 0) {
    warnings.push("No supported CSV or JSON record table was found in the archive.");
  }
  return {
    packetName,
    inputFormat: "zip",
    inputBytes: bytes.byteLength,
    expandedBytes,
    tables,
    attachments,
    warnings,
  };
}

export async function parseExportFile(file: File): Promise<ParsedExportPacket> {
  if (file.size > EXPORT_LIMITS.uploadBytes) {
    throw new ExportParseError("upload_too_large", "The export exceeds the 2 MiB prototype limit.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = extensionOf(file.name);
  if (extension === "zip") return parseZip(file.name, bytes);
  if (extension === "csv") {
    return {
      packetName: file.name,
      inputFormat: "csv",
      inputBytes: bytes.byteLength,
      expandedBytes: bytes.byteLength,
      tables: [parseCsv(file.name, decodeUtf8(bytes))],
      attachments: [],
      warnings: [],
    };
  }
  if (extension === "json") {
    return {
      packetName: file.name,
      inputFormat: "json",
      inputBytes: bytes.byteLength,
      expandedBytes: bytes.byteLength,
      tables: parseJson(file.name, decodeUtf8(bytes)),
      attachments: [],
      warnings: [],
    };
  }
  throw new ExportParseError("unsupported_format", "Use a CSV, JSON, or ZIP export.");
}

function shortEvidenceFingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function boundedEvidencePath(sourceFile: string, sourceField: string): string {
  const full = `${sourceFile}#/${sourceField.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  if (full.length <= 360) return full;
  const fingerprint = shortEvidenceFingerprint(full);
  return `${sourceFile.slice(0, 180)}#/${sourceField.slice(0, 155)}~${fingerprint}`;
}

export function packetToSourceEvidence(packet: ParsedExportPacket): SourceFieldEvidence[] {
  return packet.tables.flatMap((table) =>
    table.columns.map((column) => ({
      sourceFile: table.path,
      sourceField: column,
      evidencePath: boundedEvidencePath(table.path, column),
      sampleValues: table.rows
        .map((row) => row[column])
        .filter((value): value is Exclude<ExportCell, null> => value !== null)
        .map((value) => String(value).slice(0, 320))
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 5),
    })),
  );
}
