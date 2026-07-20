# ExitCanary architecture

## System goal

ExitCanary evaluates a bounded evidence packet against an application-owned synthetic
CRM canary contract. The architecture intentionally separates semantic
interpretation from the release-style decision:

```text
CSV / JSON / ZIP
       │
       ▼
bounded parsing and normalization
       │
       ├──────────────► GPT-5.6 Sol proposes semantic mappings
       │                          │
       │                          ▼
       │                 human confirmation boundary
       │                          │
       └──────────────────────────┘
                                  ▼
                       deterministic evaluator
                                  │
              ┌───────────────────┼────────────────────┐
              ▼                   ▼                    ▼
         EXIT_READY        NOT_EXIT_READY       NEEDS_REVIEW
                                  │
                                  ▼
                     deterministic receipt digest
```

GPT-5.6 Sol adds value when export schemas vary in naming, nesting, and bounded
file organization. It can reason that, for example, `org_ref` may represent the
canonical company relationship and cite the supplied file/header that supports
that proposal. The current normalizer still requires all fields for one
canonical entity to come from one record table. Exact known aliases can use the
deterministic fallback. Neither path can decide whether the evidence is
sufficient.

## Architectural invariants

1. Only deterministic code creates a verdict.
2. An unresolved or unconfirmed required mapping cannot pass.
3. The canonical field and check registry is application-owned, versioned, and
   not redefinable by an upload or model response.
4. Model evidence references must point to supplied file paths and fields.
5. Model failure produces a transparent fallback, never fabricated live output.
6. Any change to the canary version, evaluator version, normalized packet,
   confirmed mapping, or assessment creates a new digest.
7. Export data and model output are not persisted by the application.

## Runtime components

The exact paths below must be checked against the final source tree before
submission.

| Component | Responsibility | Trust level |
| --- | --- | --- |
| Web client | File selection, bounded parsing, mapping review, result presentation | Untrusted input boundary |
| Normalizer | Converts supported CSV/JSON/ZIP contents into a stable manifest | Deterministic, schema-validated |
| Analysis API | Validates the manifest, calls the Responses API, validates model output, returns mapping proposals | Server trust boundary |
| Canary contract | Defines canonical objects, fields, relations, fixtures, and required checks | Authoritative |
| Evaluator | Compares confirmed mapping/evidence with the canonical contract | Authoritative |
| Receipt builder | Canonicalizes digest inputs and computes SHA-256 | Authoritative but not signing |
| UI fixtures | Demonstrate flawed and complete exports | Synthetic demo data only |

### Source map

| Area | Location |
| --- | --- |
| App shell | `src/app/page.tsx` and `src/app/layout.tsx` |
| Main interaction and judge flow | `src/components/ExitCanaryApp.tsx` |
| Bounded browser-side CSV/JSON/ZIP parser | `src/lib/export-parser.ts` |
| Strict evaluation, mapping, receipt, and record schemas | `src/lib/contracts.ts` |
| Application-owned synthetic CRM truth | `src/lib/canary-profile.ts` |
| Pure deterministic evaluator and digest | `src/lib/evaluator.ts` |
| Flawed, complete, and review-required fixtures | `src/lib/sample-exports.ts` |
| Canonical model targets, aliases, and proposal bridge | `src/lib/mapping-targets.ts` |
| Semantic mapping schemas and deterministic header fallback | `src/lib/model-mapping.ts` |
| Server-only GPT-5.6 Sol mapping client | `src/lib/openai-mapper.server.ts` |
| Pseudonymous in-memory demo rate limit | `src/lib/rate-limit.server.ts` |
| Semantic mapping API | `src/app/api/map/route.ts` (`POST /api/map`) |
| Deterministic evaluation API | `src/app/api/evaluate/route.ts` (`POST /api/evaluate`) |
| Generated canary ZIP | `src/app/api/canary-pack/route.ts` (`GET /api/canary-pack`) |
| Generated judge export ZIPs | `src/app/api/demo-export/route.ts` (`GET /api/demo-export`) |
| Parsed-packet to normalized-CRM adapter | `src/lib/normalize-export.ts` |
| Automated tests | `tests/**` |
| Public sample data | `examples/**` |

## Data flow

### 1. Select and parse

The browser accepts only the supported prototype formats. The current parser
limits an upload to 2 MiB. ZIP handling permits at most 40 file entries, 5 MiB
total expanded content, 1 MiB per entry, 12 path segments, and 360 path
characters. It rejects oversized declared entry/total expansion before
inflation, then enforces the measured byte budget during extraction. JSZip CRC
verification is intentionally disabled because it inflates entries before those
declared-size gates; the parser does not claim archive integrity. CSV
and JSON tables permit at most 500 rows, 100 columns, and 2,000 characters per
cell. JSON additionally permits depth 10 and 25,000 inspected nodes.

The normalized packet records input and expanded byte counts, bounded tables,
attachment paths/sizes/SHA-256 hashes, and parser warnings. By default the
browser uses deterministic aliases locally and sends no export evidence to
OpenAI. If the user explicitly enables GPT mapping, only source file, field,
evidence path, and up to five distinct sample values per column are sent to
`/api/map`. The full local file is not posted to that API. Unsupported
archive entries are treated as attachment evidence; an archive with no
supported CSV or JSON table carries an explicit warning and cannot silently
become proof of record preservation.

The parsed packet is not yet the evaluator's strict normalized CRM input.
`normalizeParsedExport` applies the confirmed mapping, binds attachment bytes,
and validates the result as `normalized-crm-export@1.0.0`. The UI calls this
adapter only after a complete proposal is explicitly confirmed. Final browser
validation of this real-upload path remains a pre-submission gate.

The adapter deliberately supports one source record table per canonical entity.
If, for example, contact fields are split across two source tables, it raises a
`split_entity` normalization error and does not call `/api/evaluate`. This is a
prototype support boundary, not evidence of export loss.

### 2. Propose semantic mappings

The server accepts a strict `application/json` semantic-mapping envelope at
`POST /api/map`. The route enforces a 256 KiB streamed body limit, validates a
bounded request ID and up to 240 source fields, rejects every caller-supplied
target registry, rejects foreign `Origin` headers, applies the demo rate limit,
and returns uncached JSON with `nosniff`. The route injects exactly 33 canonical
targets. Untrusted filenames, keys, headers, and cell values are wrapped as data
before the Responses API call, which uses:

- exact model slug `gpt-5.6-sol`;
- structured output validated by a strict schema;
- reasoning effort `low` for the bounded mapping task;
- maximum output of 4,096 tokens;
- a 30-second client timeout and zero automatic retries;
- `store: false`;
- no authority over checks or verdicts.

Each proposed mapping identifies a canonical entity/field pair, a supplied file
and source field, one to three evidence paths, a `0..1` confidence value, and a
bounded rationale. Every canonical target must appear exactly once across the
proposal and unresolved lists. The implemented schema is documented in
[EVIDENCE-CONTRACT.md](EVIDENCE-CONTRACT.md).

The mapping route accepts only a request ID and bounded source evidence. It
injects all 33 canonical targets from the application-owned registry and rejects
a caller-supplied target registry. The bridge converts only recognized target
pairs back to evaluator field paths; the client cannot define a field or
verdict.

### 3. Confirm mappings

Human confirmation is a deliberate safety boundary. A convincing explanation
does not count as proof. The current competition UI shows a bounded source-field
selector for unresolved targets, permits per-row review or a visible “mark all
reviewed” action, and enables verification only after all 33 mappings are
resolved and explicitly confirmed. The evaluator contract represents missing,
ambiguous, or unconfirmed mappings as `NEEDS_REVIEW` when such a mapping set is
evaluated directly.

The confirmed set uses `confirmed-field-mapping@1.0.0` and covers 33 canonical
fields. A confirmed field requires a source table, source field, and at least
one evidence path. An ambiguous field requires at least two candidates.

### 4. Evaluate

The evaluator is a pure function over versioned, schema-validated inputs. It
compares the known canary values with the confirmed evidence across the bounded
check set. It consumes `normalized-crm-export@1.0.0`, uses
`exitcanary-evaluator@1.0.0`, and is testable without network access or an API
key. The check registry contains nine required checks.

The UI sends only `{ packet, confirmedMapping }` to `POST /api/evaluate`. The
server enforces JSON, same-origin browser requests, a streamed 512 KiB body
limit, and the strict evaluation schema. It runs the evaluator and returns the
uncached receipt. A client-supplied verdict or unknown contract field is
rejected; the UI does not calculate the authoritative verdict or digest.

### 5. Build receipt

Receipt truth fields are deterministic. Model prose may be displayed alongside
the receipt but must not be embedded as authoritative truth.

The server-returned receipt contract is `exit-readiness-receipt@1.0.0` and includes the canary
and evaluator versions, packet and mapping IDs/versions, algorithm, full digest,
disclaimer, and deterministic assessment.

The SHA-256 digest binds a canonical serialization of at least:

- canary version;
- evaluator version;
- normalized evidence packet;
- confirmed semantic mapping;
- deterministic assessment.

The digest is a change detector for these bounded inputs. It is not a signature,
trusted timestamp, source attestation, or proof that an export command ran.

### Canary-pack delivery

`GET /api/canary-pack` creates a synthetic ZIP from the application-owned
profile at request time. It contains CSV/JSON record tables, an attachment
manifest, and the exact attachment bytes; it returns `application/zip`,
`Cache-Control: no-store`, a bounded filename, and the canary-version response
header. The tables are vendor-neutral and may require manual adaptation to a
specific SaaS import format.

`GET /api/demo-export?variant=flawed` and `?variant=complete` create real
synthetic vendor-export ZIPs from the versioned demo fixtures. They are the
downloadable judge inputs for the parser and live/fallback mapper lane. The
faster in-app **Run pre-mapped flawed demo** lane remains separate: it starts from
a normalized fixture with a disclosed pre-mapped field set, still requires
visible human review, and makes no model-call claim.

## Failure semantics

| Failure | Required behavior |
| --- | --- |
| Unsupported file | Explain the unsupported boundary; do not infer success |
| Invalid content type, JSON, schema, or oversized mapping request | Reject before the model call |
| Ambiguous mapping | Require review; do not pass the related check |
| Model timeout/error/invalid output | Label fallback and preserve deterministic behavior |
| Missing required field | Deterministic failure |
| Missing relationship/history/attachment evidence | Deterministic failure for its required check |
| One canonical entity mapped across multiple source tables | Explicit `split_entity` normalization error; no verdict |
| Digest input changes | Re-evaluate and issue a new receipt |

## Deployment assumptions

The prototype is designed for a standard Next.js server runtime with a
server-only OpenAI credential. No database is required for the bounded demo.
Any future persistence, authentication, multi-tenant workspace, live vendor
integration, or scheduled re-test changes the privacy and threat model and must
be designed before implementation.

The current mapper fallback performs only exact normalized header/alias
matching. It deliberately leaves duplicates or missing fields unresolved. The
current demo rate limiter is process-local (12 requests per pseudonymous
IP/user-agent bucket per 10 minutes); it is not a durable production quota and
resets with the server process.

Production deployments should pin `EXITCANARY_PUBLIC_ORIGIN`; origin checks do
not trust forwarded headers. `EXITCANARY_LIVE_MAPPING_ENABLED=false` is the
operator kill switch that forces a labeled deterministic fallback even if an
API key exists. The production Next.js configuration adds HSTS, same-origin
resource/opener isolation, an origin-agent cluster, and a restrictive baseline
content-security policy. These controls do not replace durable per-identity
quota before a public paid model endpoint is enabled.

## Non-goals

- universal support for all SaaS products or export formats;
- automated access to vendor accounts;
- legal or regulatory certification;
- malware scanning or forensic file provenance;
- validating proprietary workflows, formulas, or application behavior;
- proving that the vendor included all production data;
- migrating data into a replacement system.
