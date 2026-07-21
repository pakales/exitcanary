# Evidence contract

## Purpose

This contract defines what ExitCanary may claim from a bounded CRM export. It
keeps vendor-controlled files, model interpretation, human confirmation, and
deterministic truth separate.

The TypeScript/Zod schemas in the final implementation are authoritative when
they differ from examples in this document. Synchronize this document before
submission.

## Contract versions

The implemented contract identifiers are:

| Contract | Version |
| --- | --- |
| Canary truth | `crm-exit-canary@1.0.0` |
| Normalized evaluation packet | `normalized-crm-export@1.0.0` |
| Confirmed field mapping | `confirmed-field-mapping@1.0.0` |
| Evaluator | `exitcanary-evaluator@1.0.0` |
| Receipt | `exit-readiness-receipt@1.0.0` |
| GPT mapping prompt | `exitcanary-semantic-map@1.0.0` |

## Canonical canary profile

The competition profile represents one small, entirely synthetic CRM business
graph. It contains one company, contact, deal, activity, custom field, and
attachment plus two ordered activity-history entries. Values are intentionally
distinctive enough to reveal bounded export loss:

- companies;
- contacts linked to companies;
- deals or orders linked to contacts and companies;
- activities or history linked to parent records;
- custom fields;
- created and updated timestamps;
- Unicode and punctuation edge cases;
- attachment metadata and, where present in the bounded packet, content hashes.

All IDs, people, companies, messages, and attachments are fictional. The
profile must never contain copied customer or private user data.

`GET /api/canary-pack` materializes this profile as
`exitcanary-crm-canary-v1.zip`. The ZIP contains `companies.csv`,
`contacts.csv`, `deals.csv`, `activities.json`, `custom_fields.csv`, an
attachment manifest, and the exact synthetic attachment bytes. Its record
tables are vendor-neutral reference data, not a promise that every CRM accepts
the same import layout; a trial may require manual field adaptation.

## Browser-parsed evidence packet

The browser parser converts supported CSV/JSON/ZIP inputs into one bounded
packet. Its implemented TypeScript shape is represented below:

```json
{
  "packetName": "vendor-export.zip",
  "inputFormat": "zip",
  "inputBytes": 1240,
  "expandedBytes": 2980,
  "tables": [
    {
      "path": "contacts.csv",
      "format": "csv",
      "columns": ["contact_id", "company_ref", "full_name"],
      "rows": []
    }
  ],
  "attachments": [
    {
      "path": "attachments/proof.txt",
      "byteLength": 20,
      "sha256": "<64 lowercase hex characters>"
    }
  ],
  "warnings": []
}
```

Requirements:

- archive paths are normalized and unique, and no path may escape the archive
  root;
- uploads are at most 2 MiB;
- archives contain 1–40 file entries, expand to at most 5 MiB total, and contain
  no entry larger than 1 MiB;
- archive paths contain at most 12 segments and 360 characters;
- tables contain 1–100 columns and at most 500 rows;
- column names contain 1–160 characters and must be unique;
- cells contain at most 2,000 characters;
- JSON is bounded to depth 10 and 25,000 inspected nodes;
- unsupported content is identified explicitly;
- original values are treated as opaque data, not instructions;
- parsing errors cannot become empty successful files;
- attachment claims require evidence defined by the implemented profile, not a
  filename alone.

ZIP attachment entries record a SHA-256 hash of their bytes. This is content
comparison evidence inside the local packet, not malware scanning or provenance.
The checked-in canary attachment is 35 bytes and has SHA-256
`f2527ea2050b66c32e29b771d90640fbdec1c6fb0977c48578c5063a8be3117c`.

## Normalized CRM evaluation packet

The browser-parsed packet is not itself accepted by the deterministic evaluator.
After semantic mapping and confirmation, `normalizeParsedExport` in
`src/lib/normalize-export.ts` constructs the strict
`normalized-crm-export@1.0.0` shape:

```json
{
  "formatVersion": "normalized-crm-export@1.0.0",
  "packetId": "packet_canary_complete_001",
  "sourceExportName": "acme-crm-export-complete.zip",
  "exportedAt": "2026-07-18T10:00:00.000Z",
  "sourceFiles": ["companies.csv", "contacts.csv"],
  "tables": {
    "companies": [],
    "contacts": [],
    "deals": [],
    "activities": [],
    "customFields": [],
    "attachments": []
  }
}
```

The schemas strictly bound identifiers, strings, timestamps, array sizes,
currency, attachment metadata, and SHA-256 values. Client-supplied verdicts and
unknown fields are rejected.

For the competition prototype, every required field of one canonical entity
must map to the same source record table. A mapping that splits, for example,
`contacts.*` across multiple tables is rejected by the normalizer with
`split_entity`; it does not produce a partial record or verdict. Attachment
binary bytes are the deliberate exception: metadata comes from its record table
and the matching archive entry supplies measured size and SHA-256.

The evaluation boundary is `POST /api/evaluate` with `Content-Type:
application/json`. It accepts only:

```json
{
  "packet": { "formatVersion": "normalized-crm-export@1.0.0" },
  "confirmedMapping": { "version": "confirmed-field-mapping@1.0.0" }
}
```

The abbreviated objects above are illustrative; the actual request must satisfy
the complete strict nested schemas. The route streams at most 512 KiB, rejects a
foreign browser origin, runs deterministic evaluation on the server, and
returns uncached JSON. In production, the expected origin should be pinned with
`EXITCANARY_PUBLIC_ORIGIN`; caller-controlled forwarded headers are not trusted.

The current UI connects selected files to the parser, mapper, confirmation,
normalizer, and server evaluator. The checked-in example archives have also
passed a parser → normalizer → evaluator artifact test. Browser and live-model
validation remain separately recorded release evidence: the local real-upload
path passed, the public bundled path and black-box contract passed, and the
current prose-free structured model contract passed a bounded synthetic live
smoke. The public judge deployment intentionally remains fallback-only.

## Semantic mapping input

`packetToSourceEvidence` projects parsed table columns into semantic-mapping
evidence. Each source field includes only its file, field, evidence path, and up
to five distinct non-null sample values. The full archive and attachment bytes
are never sent to `/api/map`. The UI defaults to local exact-alias mapping, so
none of this evidence crosses the OpenAI boundary unless the user first enables
the explicit GPT-5.6 consent control.

The projection truncates each model sample to 320 characters and bounds each
evidence path to 360 characters. A deterministic eight-character fingerprint is
added when truncation is required to reduce accidental collisions between long
field paths.

The implemented semantic mapper works over bounded source evidence and the
application-owned target registry. Callers supply only source evidence; the
server route injects all 33 canonical targets from `mapping-targets.ts`.

When GPT mapping is consented, the public server boundary is `POST /api/map`
with `Content-Type: application/json`. The entire body is limited to 256 KiB
and must have this strict top-level shape:

```json
{
  "requestId": "mapping-demo-001",
  "sources": []
}
```

`requestId` contains 8–80 characters, starts with an ASCII letter or digit, and
after that permits ASCII letters, digits, `.`, `_`, `:`, and `-`. Unknown
top-level or nested fields — including a caller-supplied `targets` registry —
are rejected.

### Source evidence field

```json
{
  "sourceFile": "contacts.csv",
  "sourceField": "Email Address",
  "evidencePath": "contacts.csv#/Email Address",
  "sampleValues": ["ada@example.test"]
}
```

Limits in the current source:

- at most 240 source fields per model request;
- source/evidence paths: 1–360 characters;
- source field names: 1–160 characters;
- at most five sample values, each at most 320 characters.

### Application-owned canonical mapping target

```json
{
  "canonicalEntity": "contacts",
  "canonicalField": "email",
  "aliases": ["email", "email address", "contact email"],
  "required": true
}
```

The server constructs exactly 33 targets from the evaluator field registry and
a versioned alias table. They are internal model input, not accepted from the
caller. The reusable internal schema permits up to 160 targets, but the public
route always injects the fixed 33-field registry. Other limits in the current
source are:

- canonical names must match `^[a-z][a-z0-9_]*$` and contain at most 80
  characters;
- one to 16 aliases, each at most 160 characters.

## Semantic mapping proposal

GPT-5.6 Sol proposes a mapping from supplied evidence to application-owned
canonical fields. It may not invent new canonical fields or checks.

Each proposed field mapping must include:

- one authoritative canonical entity/field pair;
- one supplied source file and source field;
- one to three evidence paths that all match that source field's supplied
  evidence path;
- a confidence number from 0 to 1;
- one closed basis enum: `header_semantics`, `sample_value_semantics`, or
  `combined_evidence`;
- no free-form rationale, summary, verdict, score, or policy instruction field.

Example:

```json
{
  "sourceFile": "people.csv",
  "sourceField": "org_ref",
  "canonicalEntity": "contacts",
  "canonicalField": "company_id",
  "evidencePaths": ["people.csv#/org_ref"],
  "confidence": 0.92,
  "basis": "combined_evidence"
}
```

An unresolved target uses one of `not_found`, `ambiguous`, or `unsupported` and
may cite up to six supplied candidate evidence paths. A proposal includes at
most 160 proposed mappings and 160 unresolved targets. It contains no
model-authored prose field.

The application validates both shape and references. It rejects duplicate
source or target mappings, unknown canonical targets, invented evidence paths,
extra prose, and a response that does not represent every target exactly once.
Only after that validation does application code construct bounded rationale
and mapping-count summary text from the closed basis enum and observed counts.

The API response uses a discriminated origin contract:

- `mode: "live"` and `model: "gpt-5.6-sol"` for a validated model proposal;
- `mode: "fallback"`, `model: null`, and a required bounded warning for
  deterministic header matching after a missing key, operator-disabled live
  mapping, refusal, timeout, invalid output, or provider failure.

Contradictory combinations such as `live` with a null model or `fallback` with
the GPT model identifier are schema-invalid. The route revalidates the complete
response before serializing it, and the UI presents only application-owned
mapping explanation.

The server attempts a live model call only when
`EXITCANARY_LIVE_MAPPING_ENABLED` is exactly `true`. Every other value is a
fail-closed fallback state, including when an API key is present in the parent
environment. Confirmed mapping source-table paths preserve the parser's same
360-character bound instead of narrowing valid evidence after parsing.

Successful responses are JSON with `Cache-Control: no-store, max-age=0` and
rate-limit headers. Boundary failures use stable HTTP statuses and an
`{ "error": { "code", "message" } }` object; they do not echo supplied
evidence.

The fallback normalizes headers and aliases for exact comparison. One unique
match can be proposed; duplicates remain ambiguous and missing fields remain
unresolved. The browser uses the same deterministic fallback locally when GPT
consent is off, without calling `/api/map` or OpenAI. Confirmation is still
required for a complete proposal.

## Confirmation boundary

A required semantic mapping has a contract lifecycle such as:

```text
unmapped → proposed → confirmed
                   ↘ rejected
                   ↘ ambiguous
```

Only a confirmed, schema-valid mapping can be evaluated as evidence for a
required check. The current UI offers bounded, unused source-field candidates
for unresolved targets. After every target is assigned, the user must review
each row or use the visible “mark all reviewed” action before verification is
enabled. The UI does not silently emit `NEEDS_REVIEW`: it keeps evaluation
blocked until resolution and confirmation, while the evaluator retains the
three-state contract for direct inputs. The bundled judge scenario uses a
visibly disclosed pre-mapped fixture, starts with zero confirmed rows, and does
not call the mapper.

The three confirmation states are structurally exclusive. `confirmed` requires
one selected source plus evidence paths and forbids candidates; `ambiguous`
requires no selected source and at least two candidates; `unconfirmed` contains
either one complete proposal or no source evidence. A contradictory state is
rejected before evaluation.

The evaluator requires exactly one confirmed mapping for each of 33 canonical
fields. Missing, duplicated, unconfirmed, or ambiguous entries make
`mapping.required_fields` a `review` result.

## Deterministic checks

The bounded profile has exactly nine required checks:

| Check ID | Question answered |
| --- | --- |
| `mapping.required_fields` | Are all 33 canonical fields uniquely confirmed? |
| `companies.record` | Is the exact canonical company record preserved? |
| `contacts.unicode` | Are contact identity, email, and exact Unicode names preserved? |
| `deals.record` | Are the bounded deal values preserved? |
| `relations.integrity` | Do company, contact, deal, activity, and attachment links use the canonical IDs? |
| `activities.timestamp` | Are activity type, subject, and exact timestamp preserved? |
| `activities.history` | Are both ordered history transitions and timestamps preserved? |
| `custom_fields.value` | Is the required custom field and exact Unicode value preserved? |
| `attachments.checksum` | Do attachment identity, metadata, size, and SHA-256 match? |

The evaluator must not weaken a required check to make a fixture pass.

## Verdict rules

### `EXIT_READY`

Every required check passes and no required semantic mapping remains unresolved.

### `NOT_EXIT_READY`

At least one required check deterministically fails against confirmed evidence.

### `NEEDS_REVIEW`

The packet cannot yet produce a defensible pass/fail because a required mapping
or supported interpretation remains unresolved. It is never a softer synonym
for `EXIT_READY`.

`NEEDS_REVIEW` has precedence when any check is in review, even if a separate
data check also fails. With no review state, any required failure produces
`NOT_EXIT_READY`; only nine passes produce `EXIT_READY`.

## Receipt

The server-generated receipt keeps deterministic truth separate from model commentary. It
includes:

- receipt, canary, and evaluator versions;
- packet ID and normalized packet format version;
- mapping ID and confirmed-mapping version;
- digest algorithm and full SHA-256 digest;
- an explicit digest disclaimer;
- deterministic verdict, summary, and all nine required check results.

The full confirmed mapping and normalized packet are bound inside the digest but
are not copied into the receipt body; their IDs and versions are included.

Changing any bound input requires re-evaluation and a new digest. The digest is
not a digital signature, trusted timestamp, source attestation, or guarantee
that a vendor produced the packet.

## Fixture contract

The public demo contains at least two synthetic scenarios:

| Fixture | Expected purpose | Expected verdict |
| --- | --- | --- |
| `FLAWED_NORMALIZED_EXPORT` + confirmed mapping | Damages contact Unicode, one relation, activity time/history, custom field, and attachment checksum | `NOT_EXIT_READY` with six failures |
| `COMPLETE_NORMALIZED_EXPORT` + confirmed mapping | Preserves all bounded required evidence | `EXIT_READY` with nine passes |
| Complete export + `REVIEW_REQUIRED_FIELD_MAPPING` | Leaves `customFields.value` ambiguous between two candidates | `NEEDS_REVIEW` |

The action that moves between these scenarios is a simulated fixture swap. It
must remain disclosed in the UI, demo narration, and submission copy.

The checked-in judge artifacts are
`examples/exports/acme-crm-export-complete.zip` and
`examples/exports/acme-crm-export-flawed.zip`. The targeted artifact test parses
and normalizes both archives before evaluation; the complete artifact produces
`EXIT_READY` with nine passes, and the flawed artifact produces
`NOT_EXIT_READY` with six failures. This targeted result does not replace the
final repository-wide `pnpm verify` gate.

A running instance also serves generated copies at
`GET /api/demo-export?variant=complete` and
`GET /api/demo-export?variant=flawed`. These route outputs traverse the same
parser → normalizer → evaluator contract in their targeted test. They are real
ZIP inputs for **Use my export**, not the normalized in-app fast-demo lane.

## Unsupported claims

This contract does not establish:

- that the vendor's export is complete for any data outside the canary profile;
- that the export came from a specific account or time;
- that a command actually ran;
- that the archive is safe to open outside the bounded parser;
- legal compliance or contractual conformity;
- migration readiness for a replacement system;
- universal compatibility with arbitrary SaaS products.
