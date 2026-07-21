"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Box,
  Check,
  CheckCircle2,
  CircleDot,
  Database,
  Download,
  FileArchive,
  FileJson,
  FileUp,
  Fingerprint,
  History,
  Link2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  useId,
  useMemo,
  useState,
} from "react";

import {
  EvaluationReceiptSchema,
  FieldMappingSetSchema,
  type EvaluationReceipt,
  type ExitVerdict,
  type FieldMappingSet,
  type NormalizedCrmExport,
} from "@/lib/contracts";
import {
  ExportParseError,
  packetToSourceEvidence,
  parseExportFile,
  type ParsedExportPacket,
  type SourceFieldEvidence,
} from "@/lib/export-parser";
import {
  buildDeterministicHeaderFallback,
  SemanticMappingResponseSchema,
  type SemanticMappingResponse,
} from "@/lib/model-mapping";
import {
  CANONICAL_MAPPING_TARGETS,
  canonicalPathForTarget,
  mappingSetFromProposal,
} from "@/lib/mapping-targets";
import { normalizeParsedExport } from "@/lib/normalize-export";
import {
  COMPLETE_CONFIRMED_MAPPING,
  COMPLETE_NORMALIZED_EXPORT,
  FLAWED_CONFIRMED_MAPPING,
  FLAWED_NORMALIZED_EXPORT,
} from "@/lib/sample-exports";

export type EvidenceState = "pass" | "fail" | "review";
export type MapperMode = "bundled" | "live" | "fallback";

export type MappingView = {
  canonicalPath: string;
  evidencePath: string;
  confidence: number;
  state: "mapped" | "review";
  candidates?: MappingSourceChoice[];
};

type MappingSourceChoice = Pick<
  SourceFieldEvidence,
  "sourceFile" | "sourceField" | "evidencePath"
> & { key: string };

export type EvidenceView = {
  id: string;
  label: string;
  detail: string;
  state: EvidenceState;
};

export type BundledResultView = {
  verdict: ExitVerdict;
  summary: string;
  digest: string;
  digestDisclaimer: string;
  evidence: EvidenceView[];
};

type MappingSession = {
  packetName: string;
  mapping: MappingView[];
  unresolved: number;
  mapperMode: MapperMode;
  model: string | null;
  warning?: string;
  summary: string;
  source: "bundled" | "upload";
  requestId: string;
  normalizedPacket?: NormalizedCrmExport;
  confirmedMapping?: FieldMappingSet;
  parsedPacket?: ParsedExportPacket;
  proposal?: SemanticMappingResponse;
  exportedAt?: string;
  confirmedFields: string[];
};

function mappingViewFromConfirmedSet(mapping: FieldMappingSet): MappingView[] {
  return mapping.mappings.map((item) => ({
    canonicalPath: item.canonicalField,
    evidencePath:
      item.sourceTable && item.sourceField
        ? `${item.sourceTable} → ${item.sourceField}`
        : "No supplied evidence",
    confidence: item.confirmation === "confirmed" ? 1 : 0,
    state: item.confirmation === "confirmed" ? "mapped" : "review",
  }));
}

function createBundledSession(
  packet: NormalizedCrmExport,
  confirmedMapping: FieldMappingSet,
): MappingSession {
  return {
    packetName: packet.sourceExportName,
    mapping: mappingViewFromConfirmedSet(confirmedMapping),
    unresolved: confirmedMapping.mappings.filter(
      (item) => item.confirmation !== "confirmed",
    ).length,
    mapperMode: "bundled",
    model: null,
    summary:
      "Bundled fixture mapping is versioned and pre-mapped for the competition demonstration.",
    source: "bundled",
    requestId: packet.packetId,
    normalizedPacket: packet,
    confirmedMapping,
    confirmedFields: [],
  };
}

function sourceChoiceKey(
  source: Pick<SourceFieldEvidence, "sourceFile" | "sourceField">,
): string {
  return `${encodeURIComponent(source.sourceFile)}::${encodeURIComponent(source.sourceField)}`;
}

function mappingViewFromResponse(
  response: SemanticMappingResponse,
  sources: readonly SourceFieldEvidence[],
): MappingView[] {
  const usedSourceKeys = new Set(response.proposedMapping.map(sourceChoiceKey));
  const mapped = response.proposedMapping.flatMap((item) => {
    const canonicalPath = canonicalPathForTarget(
      item.canonicalEntity,
      item.canonicalField,
    );
    if (!canonicalPath) return [];
    return [
      {
        canonicalPath,
        evidencePath: `${item.sourceFile} → ${item.sourceField}`,
        confidence: item.confidence,
        state: "mapped" as const,
      },
    ];
  });
  const unresolved = response.unresolved.flatMap((item) => {
    const canonicalPath = canonicalPathForTarget(
      item.canonicalEntity,
      item.canonicalField,
    );
    if (!canonicalPath) return [];
    const preferredPaths = new Set(item.candidateEvidencePaths);
    const candidatePool =
      preferredPaths.size > 0
        ? sources.filter((source) => preferredPaths.has(source.evidencePath))
        : sources;
    const candidates = candidatePool
      .filter((source) => !usedSourceKeys.has(sourceChoiceKey(source)))
      .slice(0, 240)
      .map((source) => ({
        key: sourceChoiceKey(source),
        sourceFile: source.sourceFile,
        sourceField: source.sourceField,
        evidencePath: source.evidencePath,
      }));
    return [
      {
        canonicalPath,
        evidencePath:
          item.reason === "not_found"
            ? "No supplied field found"
            : `${item.reason} · ${item.candidateEvidencePaths.join(", ") || "no bounded candidate"}`,
        confidence: 0,
        state: "review" as const,
        candidates,
      },
    ];
  });
  return [...mapped, ...unresolved].sort((left, right) =>
    left.canonicalPath.localeCompare(right.canonicalPath, "en-US"),
  );
}

function receiptToView(receipt: EvaluationReceipt): BundledResultView {
  return {
    verdict: receipt.assessment.verdict,
    summary: receipt.assessment.summary,
    digest: receipt.digest,
    digestDisclaimer: receipt.digestDisclaimer,
    evidence: receipt.assessment.checks.map((check) => ({
      id: check.id,
      label: check.label,
      detail: check.detail,
      state: check.status,
    })),
  };
}

function createRequestId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `map:${random.replace(/[^A-Za-z0-9._:-]/g, "-")}`.slice(0, 80);
}

function materializeNormalizedPacket(
  session: MappingSession,
  confirmedMapping: FieldMappingSet,
): NormalizedCrmExport {
  if (!session.parsedPacket || !session.proposal) {
    throw new Error("The parsed export is unavailable.");
  }
  return normalizeParsedExport(session.parsedPacket, confirmedMapping, {
    packetId: `packet_${confirmedMapping.mappingId}`.slice(0, 120),
    exportedAt: session.exportedAt ?? "1970-01-01T00:00:00.000Z",
  });
}

async function evaluationInputForSession(session: MappingSession) {
  if (session.unresolved > 0) {
    throw new Error("Every required semantic mapping must be resolved first.");
  }

  const baseMapping =
    session.confirmedMapping ??
    (session.proposal
      ? mappingSetFromProposal(session.proposal, {
          mappingId: `mapping_${session.requestId}`.slice(0, 120),
          confirmProposals: false,
        })
      : null);
  if (!baseMapping) {
    throw new Error("The reviewed mapping is unavailable.");
  }

  const reviewedFields = new Set(session.confirmedFields);
  const confirmedMapping = FieldMappingSetSchema.parse({
    ...baseMapping,
    mappings: baseMapping.mappings.map((mapping) => ({
      ...mapping,
      confirmation: reviewedFields.has(mapping.canonicalField)
        ? "confirmed"
        : "unconfirmed",
    })),
  });
  if (
    confirmedMapping.mappings.some(
      (mapping) => mapping.confirmation !== "confirmed",
    )
  ) {
    throw new Error("Review and confirm every required field before verification.");
  }

  if (session.normalizedPacket) {
    return {
      packet: session.normalizedPacket,
      confirmedMapping,
    };
  }
  return {
    packet: materializeNormalizedPacket(session, confirmedMapping),
    confirmedMapping,
  };
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
    };
    return typeof payload.error?.message === "string"
      ? payload.error.message
      : fallback;
  } catch {
    return fallback;
  }
}

async function evaluateThroughServer(session: MappingSession): Promise<EvaluationReceipt> {
  const input = await evaluationInputForSession(session);
  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await apiErrorMessage(
        response,
        "Deterministic verification is temporarily unavailable.",
      ),
    );
  }
  return EvaluationReceiptSchema.parse(await response.json());
}

const CANARY_OBJECTS = [
  { key: "contacts", label: "Contacts", icon: Database },
  { key: "companies", label: "Companies", icon: Box },
  { key: "relations", label: "Relations", icon: Link2 },
  { key: "attachments", label: "Attachments", icon: FileArchive },
  { key: "history", label: "History", icon: History },
  { key: "custom", label: "Custom fields", icon: Fingerprint },
] as const;

type Phase = "prepare" | "mapping" | "review" | "verdict";

function verdictKind(verdict: ExitVerdict | undefined) {
  if (verdict === "EXIT_READY") return "ready";
  if (verdict === "NOT_EXIT_READY") return "blocked";
  if (verdict === "NEEDS_REVIEW") return "review";
  return "waiting";
}

function verdictLabel(verdict: ExitVerdict) {
  if (verdict === "EXIT_READY") return "EXIT READY";
  if (verdict === "NOT_EXIT_READY") return "NOT EXIT-READY";
  return "NEEDS REVIEW";
}

function evidenceIcon(state: EvidenceState): ReactNode {
  if (state === "pass") return <Check aria-hidden="true" />;
  if (state === "fail") return <X aria-hidden="true" />;
  return <AlertTriangle aria-hidden="true" />;
}

function statusForObject(
  objectKey: (typeof CANARY_OBJECTS)[number]["key"],
  result: BundledResultView | null,
): EvidenceState | "waiting" {
  if (!result) return "waiting";

  const matchingTerms: Record<typeof objectKey, string[]> = {
    contacts: ["contact"],
    companies: ["company"],
    relations: ["relations"],
    attachments: ["attachment"],
    history: ["history", "timeline", "activities"],
    custom: ["custom"],
  };
  const check = result.evidence.find((item) =>
    matchingTerms[objectKey].some((term) =>
      `${item.id} ${item.label}`.toLowerCase().includes(term),
    ),
  );
  return check?.state ?? "waiting";
}

function ModelBadge({ demo }: { demo: MappingSession | null }) {
  if (!demo) {
    return (
      <span className="model-badge" data-mode="idle">
        Mapper waiting
      </span>
    );
  }

  if (demo.mapperMode === "live") {
    return (
      <span className="model-badge" data-mode="live">
        Live · {demo.model ?? "GPT-5.6 Sol"}
      </span>
    );
  }

  if (demo.mapperMode === "fallback") {
    return (
      <span className="model-badge" data-mode="fallback">
        Fallback · deterministic aliases
      </span>
    );
  }

  return (
    <span className="model-badge" data-mode="idle">
      Bundled · mapped
    </span>
  );
}

function ProgressSteps({ phase }: { phase: Phase }) {
  const activeIndex = {
    prepare: 0,
    mapping: 1,
    review: 2,
    verdict: 3,
  }[phase];

  return (
    <ol className="exit-steps" aria-label="Exit test progress">
      {["Canary pack", "Export", "Confirm", "Verdict"].map((label, index) => {
        const state =
          index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
        return (
          <li className="exit-step" data-state={state} key={label}>
            <span className="exit-step-index" aria-hidden="true">
              {state === "complete" ? <Check /> : index + 1}
            </span>
            <span className="exit-step-label">{label}</span>
            <span className="sr-only">{state}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ExitScene({
  phase,
  result,
}: {
  phase: Phase;
  result: BundledResultView | null;
}) {
  const gateState =
    phase === "mapping" || phase === "review"
      ? "scanning"
      : result
        ? verdictKind(result.verdict)
        : "waiting";

  return (
    <div className="exit-scene" aria-label="Canary business data exit corridor">
      <section className="exit-zone exit-zone--source" aria-label="Known canary data">
        <div className="exit-zone-label">
          <Database aria-hidden="true" />
          <span>Known input</span>
        </div>
        <ul className="data-stack">
          {CANARY_OBJECTS.map(({ key, label, icon: Icon }) => (
            <li className="data-token" data-state="pass" key={key}>
              <Icon aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      <div className="exit-gate-wrap" aria-hidden="true">
        <div className="exit-gate" data-state={gateState}>
          <span className="gate-scan" />
          <span className="gate-word">Exit</span>
        </div>
        <span className="gate-orbit" />
      </div>

      <section className="exit-zone exit-zone--destination" aria-label="Exported data">
        <div className="exit-zone-label">
          <ShieldCheck aria-hidden="true" />
          <span>Verified exit</span>
        </div>
        <ul className="data-stack">
          {CANARY_OBJECTS.map(({ key, label, icon: Icon }) => {
            const state = statusForObject(key, result);
            return (
              <li className="data-token" data-state={state} key={key}>
                <Icon aria-hidden="true" />
                {label}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export function ExitCanaryApp() {
  const fileInputId = useId();
  const [phase, setPhase] = useState<Phase>("prepare");
  const [activeDemo, setActiveDemo] = useState<MappingSession | null>(null);
  const [result, setResult] = useState<BundledResultView | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [busyStage, setBusyStage] = useState<"mapping" | "evaluating">(
    "mapping",
  );
  const [allowOpenAiMapping, setAllowOpenAiMapping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    "ExitCanary is ready. Download the canary pack or run the bundled demo.",
  );

  const mappedCount = useMemo(
    () => activeDemo?.mapping.filter((item) => item.state === "mapped").length ?? 0,
    [activeDemo],
  );
  const confirmedCount = activeDemo?.confirmedFields.length ?? 0;

  const revealWorkbench = () => {
    window.requestAnimationFrame(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";
      document.getElementById("exit-workbench")?.scrollIntoView({
        behavior,
        block: "start",
      });
    });
  };

  const downloadCanaryPack = () => {
    setError(null);
    const anchor = document.createElement("a");
    anchor.href = "/api/canary-pack";
    anchor.download = "exitcanary-crm-canary-v1.zip";
    anchor.click();
    setAnnouncement("Canary ZIP downloaded. Import it into the SaaS trial, then export it back.");
  };

  const runBundledDemo = () => {
    const session = createBundledSession(
      FLAWED_NORMALIZED_EXPORT,
      FLAWED_CONFIRMED_MAPPING,
    );
    setError(null);
    setResult(null);
    setActiveDemo(session);
    setPhase("review");
    setAnnouncement(
      "Bundled flawed export loaded with a disclosed demonstration map. Review every field before verification.",
    );
    revealWorkbench();
  };

  const confirmMapping = async () => {
    if (
      !activeDemo ||
      activeDemo.unresolved > 0 ||
      activeDemo.confirmedFields.length !== activeDemo.mapping.length
    ) {
      return;
    }
    setIsBusy(true);
    setBusyStage("evaluating");
    setError(null);
    setPhase("mapping");

    try {
      const receipt = await evaluateThroughServer(activeDemo);
      const nextResult = receiptToView(receipt);
      setResult(nextResult);
      setPhase("verdict");
      setAnnouncement(
        `Deterministic verdict: ${verdictLabel(nextResult.verdict)}. ${nextResult.summary}`,
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Deterministic verification failed safely.";
      setError(message);
      setPhase("review");
      setAnnouncement(message);
    } finally {
      setIsBusy(false);
    }
  };

  const applyFixedDemo = async () => {
    const previousSession = activeDemo;
    const fixedSession = createBundledSession(
      COMPLETE_NORMALIZED_EXPORT,
      COMPLETE_CONFIRMED_MAPPING,
    );
    const session: MappingSession = {
      ...fixedSession,
      confirmedFields: [...(previousSession?.confirmedFields ?? [])],
    };
    setError(null);
    setActiveDemo(session);
    setBusyStage("evaluating");
    setIsBusy(true);
    setPhase("mapping");
    revealWorkbench();

    try {
      const receipt = await evaluateThroughServer(session);
      const nextResult = receiptToView(receipt);
      setResult(nextResult);
      setPhase("verdict");
      setAnnouncement(
        `Simulated fixture swap re-evaluated. Deterministic verdict: ${verdictLabel(nextResult.verdict)}.`,
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "The fixed fixture could not be re-evaluated.";
      setActiveDemo(previousSession);
      setError(message);
      setPhase("verdict");
      setAnnouncement(message);
    } finally {
      setIsBusy(false);
    }
  };

  const reset = () => {
    setPhase("prepare");
    setActiveDemo(null);
    setResult(null);
    setError(null);
    setBusyStage("mapping");
    setAnnouncement("Exit test reset.");
  };

  const handleFile = async (file: File | undefined) => {
    setIsDragging(false);
    if (!file) return;

    const requestId = createRequestId();
    setError(null);
    setResult(null);
    setActiveDemo(null);
    setBusyStage("mapping");
    setIsBusy(true);
    setPhase("mapping");
    setAnnouncement(
      `${file.name} is being parsed locally and ${allowOpenAiMapping ? "prepared for consented GPT-5.6 mapping" : "mapped with local deterministic aliases"}.`,
    );
    revealWorkbench();

    try {
      const parsedPacket = await parseExportFile(file);
      const sources = packetToSourceEvidence(parsedPacket);
      if (sources.length === 0) {
        throw new Error("No supported CSV or JSON record fields were found.");
      }

      let proposal: SemanticMappingResponse;
      if (allowOpenAiMapping) {
        const response = await fetch("/api/map", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId, sources }),
        });
        if (!response.ok) {
          throw new Error(
            await apiErrorMessage(
              response,
              "Semantic mapping is temporarily unavailable.",
            ),
          );
        }
        proposal = SemanticMappingResponseSchema.parse(await response.json());
      } else {
        proposal = SemanticMappingResponseSchema.parse({
          ...buildDeterministicHeaderFallback(
            sources,
            CANONICAL_MAPPING_TARGETS,
          ),
          mode: "fallback",
          model: null,
          warning:
            "Local deterministic mapping selected. No field evidence was sent to OpenAI.",
        });
      }
      const mappingSummary = `${proposal.mode === "live" ? "GPT-5.6 Sol" : "Deterministic fallback"} proposed ${proposal.proposedMapping.length} mappings; ${proposal.unresolved.length} remain unresolved. Human confirmation is required.`;
      const session: MappingSession = {
        packetName: parsedPacket.packetName,
        mapping: mappingViewFromResponse(proposal, sources),
        unresolved: proposal.unresolved.length,
        mapperMode: proposal.mode,
        model: proposal.model,
        warning: proposal.mode === "fallback" ? proposal.warning : undefined,
        summary: mappingSummary,
        source: "upload",
        requestId,
        parsedPacket,
        proposal,
        confirmedFields: [],
        exportedAt:
          Number.isFinite(file.lastModified) && file.lastModified > 0
            ? new Date(file.lastModified).toISOString()
            : "1970-01-01T00:00:00.000Z",
      };
      setActiveDemo(session);
      setPhase("review");
      setAnnouncement(mappingSummary);
    } catch (caught) {
      const message =
        caught instanceof ExportParseError || caught instanceof Error
          ? caught.message
          : "The export could not be processed safely.";
      setError(message);
      setPhase("prepare");
      setAnnouncement(message);
    } finally {
      setIsBusy(false);
    }
  };

  const resolveMapping = (canonicalPath: string, choiceKey: string) => {
    const session = activeDemo;
    if (
      !session ||
      session.source !== "upload" ||
      !session.parsedPacket ||
      !session.proposal
    ) {
      return;
    }

    const sources = packetToSourceEvidence(session.parsedPacket);
    const source = sources.find(
      (candidate) => sourceChoiceKey(candidate) === choiceKey,
    );
    const unresolvedTarget = session.proposal.unresolved.find(
      (candidate) =>
        canonicalPathForTarget(
          candidate.canonicalEntity,
          candidate.canonicalField,
        ) === canonicalPath,
    );
    if (!source || !unresolvedTarget) return;

    const sourceIsAlreadyMapped = session.proposal.proposedMapping.some(
      (candidate) => sourceChoiceKey(candidate) === choiceKey,
    );
    if (sourceIsAlreadyMapped) {
      const message = "That source field is already assigned to another canonical field.";
      setError(message);
      setAnnouncement(message);
      return;
    }

    const nextUnresolved = session.proposal.unresolved.filter(
      (candidate) => candidate !== unresolvedTarget,
    );
    const nextProposal = SemanticMappingResponseSchema.parse({
      ...session.proposal,
      proposedMapping: [
        ...session.proposal.proposedMapping,
        {
          sourceFile: source.sourceFile,
          sourceField: source.sourceField,
          canonicalEntity: unresolvedTarget.canonicalEntity,
          canonicalField: unresolvedTarget.canonicalField,
          evidencePaths: [source.evidencePath],
          confidence: 1,
          rationale: "Human-selected bounded source evidence.",
        },
      ],
      unresolved: nextUnresolved,
      summary:
        nextUnresolved.length === 0
          ? "Every required field now has bounded source evidence. Human confirmation is required before verification."
          : `${nextUnresolved.length} required mapping${nextUnresolved.length === 1 ? " remains" : "s remain"} unresolved.`,
    });

    setError(null);
    setActiveDemo({
      ...session,
      proposal: nextProposal,
      mapping: mappingViewFromResponse(nextProposal, sources),
      unresolved: nextUnresolved.length,
      summary: nextProposal.summary,
      confirmedFields: session.confirmedFields.filter(
        (field) => field !== canonicalPath,
      ),
    });
    setAnnouncement(
      `${canonicalPath} assigned to ${source.sourceFile} → ${source.sourceField}. ${nextUnresolved.length} mappings remain unresolved.`,
    );
  };

  const toggleMappingConfirmation = (canonicalPath: string) => {
    const session = activeDemo;
    const row = session?.mapping.find(
      (candidate) => candidate.canonicalPath === canonicalPath,
    );
    if (!session || row?.state !== "mapped") return;

    const isConfirmed = session.confirmedFields.includes(canonicalPath);
    const confirmedFields = isConfirmed
      ? session.confirmedFields.filter((field) => field !== canonicalPath)
      : [...session.confirmedFields, canonicalPath];
    setActiveDemo({ ...session, confirmedFields });
    setAnnouncement(
      `${canonicalPath} ${isConfirmed ? "returned to review" : "human-confirmed"}.`,
    );
  };

  const confirmAllReviewedMappings = () => {
    const session = activeDemo;
    if (!session || session.unresolved > 0) return;
    const confirmedFields = session.mapping
      .filter((item) => item.state === "mapped")
      .map((item) => item.canonicalPath);
    setActiveDemo({ ...session, confirmedFields });
    setAnnouncement(
      `${confirmedFields.length} visible field mappings marked as human-reviewed. Deterministic verification is now available.`,
    );
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) setIsDragging(true);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const focusWorkbench = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const workbench = document.getElementById("exit-workbench");
    workbench?.focus({ preventScroll: true });
    workbench?.scrollIntoView({ block: "start" });
  };

  const verdict = result?.verdict;
  const workbenchState = verdictKind(verdict);

  return (
    <main className="exit-app" onDragLeave={() => setIsDragging(false)} onDragOver={onDragOver} onDrop={onDrop}>
      <a className="skip-link" href="#exit-workbench" onClick={focusWorkbench}>
        Skip to exit test
      </a>
      <div className="exit-ambient" aria-hidden="true" />

      <div className="exit-shell">
        <header className="exit-header">
          <a className="exit-brand" href="#top" aria-label="ExitCanary home">
            <span className="exit-mark" aria-hidden="true">
              <CircleDot />
            </span>
            <span>ExitCanary</span>
          </a>
          <div className="exit-header-meta" aria-label="Privacy and test scope">
            <span>
              <LockKeyhole aria-hidden="true" /> No export retained
            </span>
            <span>
              <Sparkles aria-hidden="true" /> CRM canary · v1
            </span>
          </div>
        </header>

        <section className="exit-hero" id="top" aria-labelledby="exit-title">
          <div className="exit-hero-copy">
            <p className="exit-kicker">Portability test before the contract</p>
            <h1 id="exit-title">
              Before you enter,
              <br />
              <em>prove you can leave.</em>
            </h1>
            <p className="exit-hero-description">
              Plant known business data in a SaaS trial. Export it back. ExitCanary maps the files,
              then deterministic checks reveal what survives the exit—and what gets trapped.
            </p>
            <button
              className="exit-button exit-button--primary exit-hero-cta"
              onClick={runBundledDemo}
              type="button"
            >
              <FileArchive aria-hidden="true" /> Run 60-second demo
            </button>
          </div>

          <div className="exit-proof-loop" aria-label="Known input becomes a verified exit">
            <span>
              Plant
              <strong>Known input</strong>
            </span>
            <ArrowRight aria-hidden="true" />
            <span>
              Prove
              <strong>Verified exit</strong>
            </span>
          </div>
        </section>

        <section
          className="exit-workbench"
          data-state={workbenchState}
          id="exit-workbench"
          aria-busy={isBusy}
          aria-labelledby="workbench-title"
          tabIndex={-1}
        >
          <h2 className="sr-only" id="workbench-title">
            Exit readiness test
          </h2>

          <div className="exit-workbench-top">
            <ProgressSteps phase={phase} />
            <ModelBadge demo={activeDemo} />
          </div>

          <ExitScene phase={phase} result={result} />

          <div className="exit-dock">
            {phase === "prepare" ? (
              <section className="exit-dock-panel" aria-labelledby="prepare-title">
                <div className="exit-dock-copy">
                  <p className="exit-dock-eyebrow">
                    <Fingerprint aria-hidden="true" /> Step 1 · Known synthetic data
                  </p>
                  <h2 id="prepare-title">Run the exit drill.</h2>
                  <p>
                    Download the canary pack for a real trial, or use the bundled flawed CRM export
                    to see the complete decision flow in under a minute.
                  </p>
                  <label className="mapper-consent">
                    <input
                      checked={allowOpenAiMapping}
                      onChange={(event) =>
                        setAllowOpenAiMapping(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>
                      <strong>Use GPT-5.6 semantic mapping</strong>
                      <small>
                        Consent to send file paths, field names, and up to five bounded sample values per field to OpenAI. Raw files stay local. Leave off for deterministic local aliases only.
                      </small>
                    </span>
                  </label>
                  <div className="judge-samples" aria-label="Judge sample exports">
                    <span>Exercise the real parser:</span>
                    <a download href="/api/demo-export?variant=flawed">
                      <Download aria-hidden="true" /> Flawed sample ZIP
                    </a>
                    <a download href="/api/demo-export?variant=complete">
                      <Download aria-hidden="true" /> Complete sample ZIP
                    </a>
                  </div>
                  {error ? (
                    <p className="exit-error" role="alert">
                      <AlertTriangle aria-hidden="true" /> {error}
                    </p>
                  ) : null}
                </div>
                <div className="exit-actions">
                  <button className="exit-button exit-button--secondary" onClick={downloadCanaryPack} type="button">
                    <Download aria-hidden="true" /> Download canary pack
                  </button>
                  <input
                    accept=".csv,.json,.zip,text/csv,application/json,application/zip"
                    className="exit-file-input"
                    id={fileInputId}
                    onChange={onFileChange}
                    type="file"
                  />
                  <label className="exit-file-label" htmlFor={fileInputId}>
                    <FileUp aria-hidden="true" /> Use my export
                  </label>
                  <button className="exit-button exit-button--primary" onClick={runBundledDemo} type="button">
                    <FileArchive aria-hidden="true" /> Run pre-mapped flawed demo
                  </button>
                </div>
              </section>
            ) : null}

            {phase === "mapping" ? (
              <section className="exit-dock-panel" aria-labelledby="mapping-progress-title">
                <div className="exit-dock-copy">
                  <p className="exit-dock-eyebrow">
                    <Bot aria-hidden="true" />{
                      busyStage === "mapping"
                        ? "Semantic mapping · no verdict"
                        : "Deterministic verification"
                    }
                  </p>
                  <h2 id="mapping-progress-title">
                    {busyStage === "mapping"
                      ? "Mapping the returned export…"
                      : "Checking what crossed the gate…"}
                  </h2>
                  <p>
                    {busyStage === "mapping"
                      ? allowOpenAiMapping
                        ? "With your consent, only bounded paths, field names, and up to five sample values per field may be sent to OpenAI. GPT-5.6 cannot set the authoritative exit-readiness verdict."
                        : "Local deterministic aliases are mapping fields. No export evidence is sent to OpenAI, and no model can set the authoritative exit-readiness verdict."
                      : "The confirmed semantic map is fixed. The model cannot set or change this verdict."}
                  </p>
                </div>
                <div className="exit-actions" aria-hidden="true">
                  <span className="exit-button exit-button--primary">
                    <span className="busy-spinner" />{
                      busyStage === "mapping" ? "Mapping fields" : "Verifying evidence"
                    }
                  </span>
                </div>
              </section>
            ) : null}

            {phase === "review" && activeDemo ? (
              <section className="mapping-panel" aria-labelledby="mapping-title">
                <div className="mapping-summary">
                  <p className="exit-dock-eyebrow">
                    <Bot aria-hidden="true" /> Human confirmation gate
                  </p>
                  <h2 id="mapping-title">Confirm what each field means.</h2>
                  <p>
                    {activeDemo.source === "bundled"
                      ? "This bundled demo uses a disclosed pre-mapped fixture. It is not confirmed until you review the rows below."
                      : activeDemo.summary}
                  </p>
                  {activeDemo.warning ? (
                    <p className="mapping-alert" role="status">
                      <AlertTriangle aria-hidden="true" /> {activeDemo.warning}
                    </p>
                  ) : null}
                  {error ? (
                    <p className="exit-error" role="alert">
                      <AlertTriangle aria-hidden="true" /> {error}
                    </p>
                  ) : null}
                  <div className="exit-actions">
                    <button className="exit-button exit-button--ghost" onClick={reset} type="button">
                      <RotateCcw aria-hidden="true" /> Reject &amp; start over
                    </button>
                    <button
                      className="exit-button exit-button--secondary"
                      disabled={activeDemo.unresolved > 0}
                      onClick={confirmAllReviewedMappings}
                      type="button"
                    >
                      <CheckCircle2 aria-hidden="true" /> Mark all reviewed
                    </button>
                    <button
                      className="exit-button exit-button--primary"
                      disabled={
                        activeDemo.unresolved > 0 ||
                        confirmedCount !== activeDemo.mapping.length
                      }
                      onClick={confirmMapping}
                      type="button"
                    >
                      <ShieldCheck aria-hidden="true" /> Verify confirmed mapping
                    </button>
                  </div>
                </div>

                <div className="mapping-review">
                  <div className="mapping-review-head">
                    <strong>Canonical field → export evidence</strong>
                    <span>
                      {mappedCount}/{activeDemo.mapping.length} mapped · {confirmedCount} confirmed
                    </span>
                  </div>
                  <dl className="mapping-list">
                    {activeDemo.mapping.map((item) => (
                      <div className="mapping-row" data-state={item.state} key={item.canonicalPath}>
                        <dt title={item.canonicalPath}>{item.canonicalPath}</dt>
                        <ArrowRight aria-hidden="true" />
                        <dd title={item.evidencePath}>
                          {item.state === "review" && item.candidates?.length ? (
                            <select
                              aria-label={`Choose source evidence for ${item.canonicalPath}`}
                              className="mapping-select"
                              defaultValue=""
                              onChange={(event) =>
                                resolveMapping(item.canonicalPath, event.target.value)
                              }
                            >
                              <option disabled value="">
                                Choose bounded source field…
                              </option>
                              {item.candidates.map((candidate) => (
                                <option key={candidate.key} value={candidate.key}>
                                  {candidate.sourceFile} → {candidate.sourceField}
                                </option>
                              ))}
                            </select>
                          ) : (
                            item.evidencePath
                          )}
                        </dd>
                        <span className="mapping-confidence">
                          {item.state === "mapped"
                            ? `${Math.round(item.confidence * 100)}%`
                            : `${item.candidates?.length ?? 0} options`}
                        </span>
                        <label className="mapping-confirm">
                          <input
                            aria-label={`Reviewed ${item.canonicalPath}`}
                            checked={activeDemo.confirmedFields.includes(
                              item.canonicalPath,
                            )}
                            disabled={item.state !== "mapped"}
                            onChange={() =>
                              toggleMappingConfirmation(item.canonicalPath)
                            }
                            type="checkbox"
                          />
                          <span>Reviewed</span>
                        </label>
                      </div>
                    ))}
                  </dl>
                  {activeDemo.unresolved > 0 ? (
                    <p className="mapping-alert" role="alert">
                      <AlertTriangle aria-hidden="true" /> Choose bounded source evidence for {activeDemo.unresolved} unresolved mapping{activeDemo.unresolved === 1 ? "" : "s"} before verification.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {phase === "verdict" && result ? (
              <section className="verdict-panel" aria-labelledby="verdict-title">
                <div className="verdict-summary" data-verdict={verdictKind(result.verdict)}>
                  <p className="exit-dock-eyebrow">
                    {result.verdict === "EXIT_READY" ? (
                      <CheckCircle2 aria-hidden="true" />
                    ) : result.verdict === "NOT_EXIT_READY" ? (
                      <XCircle aria-hidden="true" />
                    ) : (
                      <AlertTriangle aria-hidden="true" />
                    )}
                    Deterministic verdict
                  </p>
                  <h2 className="verdict-label" id="verdict-title">
                    {verdictLabel(result.verdict)}
                  </h2>
                  <p className="verdict-detail">{result.summary}</p>
                  <div className="exit-actions">
                    <button className="exit-button exit-button--ghost" onClick={reset} type="button">
                      <RotateCcw aria-hidden="true" /> New test
                    </button>
                    {result.verdict !== "EXIT_READY" &&
                    activeDemo?.source === "bundled" ? (
                      <button className="exit-button exit-button--primary" onClick={applyFixedDemo} type="button">
                        <Sparkles aria-hidden="true" /> Apply fixed demo export
                      </button>
                    ) : null}
                  </div>
                  {result.verdict !== "EXIT_READY" &&
                  activeDemo?.source === "bundled" ? (
                    <p className="simulation-note">
                      <FileJson aria-hidden="true" /> Simulated fixture swap — replaces this bundled demo packet only.
                    </p>
                  ) : null}
                </div>

                <div className="evidence-panel">
                  <div className="evidence-head">
                    <strong>Exact exit evidence</strong>
                    <span
                      aria-label={`SHA-256 receipt digest ${result.digest}`}
                      className="receipt-digest"
                      title={result.digest}
                    >
                      <span aria-hidden="true">sha256:</span>
                      {result.digest}
                    </span>
                  </div>
                  <p className="receipt-disclaimer">
                    <LockKeyhole aria-hidden="true" /> {result.digestDisclaimer}
                  </p>
                  <ul className="evidence-list">
                    {result.evidence.map((item) => (
                      <li className="evidence-row" data-state={item.state} key={item.id}>
                        <span className="evidence-icon">{evidenceIcon(item.state)}</span>
                        <strong title={item.id}>{item.label}</strong>
                        <span title={item.detail}>{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}
          </div>

          {isDragging ? (
            <div className="drop-active" role="status">
              <div>
                <UploadCloud aria-hidden="true" />
                <strong>Drop the export at the gate.</strong>
                <span>CSV, JSON, or ZIP · bounded local parsing</span>
              </div>
            </div>
          ) : null}

          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </section>
      </div>
    </main>
  );
}

export default ExitCanaryApp;
