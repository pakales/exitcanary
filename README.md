# ExitCanary

> Before you enter, prove you can leave.

ExitCanary is a bounded SaaS exit-readiness prototype. It places a known,
synthetic CRM dataset inside a trial account, examines the vendor's exported
CSV, JSON, or ZIP packet, and produces a reproducible verdict about what
survived the exit.

GPT-5.6 Sol handles the part that benefits from semantic reasoning: mapping an
unfamiliar vendor export back to the known canary fields. Deterministic code —
not the model — evaluates the confirmed mapping and decides `EXIT_READY`,
`NOT_EXIT_READY`, or `NEEDS_REVIEW`.

## Why this exists

Teams often test whether a SaaS product can accept their data, while export
fidelity can remain untested until a migration is already urgent. An export
button is not enough if it silently drops
relationships, activity history, attachments, custom fields, timestamps, or
Unicode values.

ExitCanary turns that vague procurement question into a concrete pre-purchase
test:

1. Start with a versioned synthetic CRM canary pack.
2. Adapt its vendor-neutral tables to the SaaS import format and import them
   into the trial being evaluated.
3. Request the vendor's advertised full export.
4. Upload the returned CSV, JSON, or ZIP packet.
5. Review the proposed semantic mapping.
6. Receive a deterministic exit-readiness verdict and receipt.

## Competition scope

The Build Week prototype deliberately stays narrow:

- one bounded synthetic CRM profile;
- CSV and JSON evidence, optionally grouped inside ZIP archives;
- one source record table per canonical CRM entity in the current real-upload
  normalizer;
- manual import/export instead of live vendor integrations;
- semantic field mapping with GPT-5.6 Sol;
- deterministic checks over records, values, identifiers, relations,
  timestamps, Unicode, custom fields, history, and attachment evidence;
- bundled flawed and complete demo exports.

This is not a universal SaaS portability auditor, legal compliance guarantee,
source attestation, or proof that a vendor generated an export honestly.

## Quick start

### Prerequisites

- Node.js `>=22.13.0`
- pnpm `10.33.2` or a compatible pnpm 10 release
- an OpenAI API key with access to `gpt-5.6-sol` for live semantic mapping

### Install and run

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Set the server-only key in `.env.local` when testing the live model path:

```dotenv
OPENAI_API_KEY=your_key_here
EXITCANARY_LIVE_MAPPING_ENABLED=true
EXITCANARY_PUBLIC_ORIGIN=http://localhost:3000
```

`EXITCANARY_QUOTA_SALT` is optional for local demo use. When configured, use a
private random value of at least 16 characters and never commit it. The current
process-local rate limit is a demo guardrail, not a production quota.

Set `EXITCANARY_PUBLIC_ORIGIN` to the exact canonical HTTPS origin on a public
DNS hostname in production; the request boundary does not trust forwarded
headers. Live mapping runs only when
`EXITCANARY_LIVE_MAPPING_ENABLED` is exactly `true`; every other value forces a
labeled deterministic fallback even if a key is inherited. Do not expose a
public live key behind only the process-local limiter: durable identity/quota,
abuse monitoring, and an operational kill switch are pre-public gates.

The published Build Week judge URL is
[https://exitcanary.vercel.app](https://exitcanary.vercel.app). It is
intentionally keyless and fallback-only. Its fail-closed environment check and
signed-out verification procedure are in
[docs/PUBLIC-DEMO-DEPLOYMENT.md](docs/PUBLIC-DEMO-DEPLOYMENT.md). Run
`pnpm preflight:public-fallback` with the exact production environment before
every future public release.

Never expose the key through a `NEXT_PUBLIC_` variable. The no-key path for a
real upload defaults to local deterministic exact-alias mapping unless the user
explicitly consents to the GPT path. The bundled judge demo is separate: it
uses a disclosed, pre-mapped synthetic fixture and never calls GPT. The mapping
is not confirmed until the user reviews it. Confirm all three modes in the
final build before a public handoff.

## Run the bundled demo

1. Open the app and start the bundled flawed CRM export.
2. Verify the interface labels its versioned mapping as bundled and pre-mapped;
   this repeatable path does not claim a GPT call.
3. Inspect the 33 mapped fields, select **Mark all reviewed**, then
   **Verify confirmed mapping**.
4. Observe six deterministic failures and `NOT_EXIT_READY`.
5. Use the simulated demo fix action. It swaps to a bundled complete fixture;
   it does not modify a vendor account or repository.
6. Re-run the evaluation and observe `EXIT_READY` with a new digest.

To exercise semantic mapping, choose **Use my export** and upload a supported
CSV, JSON, or ZIP. That path parses locally. By default, it maps exact aliases
in the browser and sends no export evidence to OpenAI. If the user selects the
explicit GPT-5.6 consent control, bounded field evidence and up to five sample
cell values per field are sent to `/api/map`. The result is labeled live or
fallback. Unresolved targets can be assigned from bounded source candidates;
every mapping must then be reviewed before evaluation.

The current normalizer rejects a mapping that spreads one canonical entity's
required fields across multiple source tables. That bounded support limit is an
explicit error, not a partial or successful verdict.

Public synthetic judge ZIPs are checked in under [`examples/exports`](examples/exports)
and are also available from `GET /api/demo-export?variant=flawed` and
`GET /api/demo-export?variant=complete` on a running instance.

See [the recording script](docs/DEMO-SCRIPT.md) for the locked 93-second
walkthrough and its claim gates.

## Built with Codex and GPT-5.6

This repository was created in Codex during the Build Week submission period.
Codex was the primary engineering workspace: it turned the product
thesis into explicit invariants, split implementation into bounded core,
parser/API, interface, and documentation workstreams, and was used for
contract tests, integration review, UI verification, and claim red-teaming.

The entrant retained the key product and risk decisions:

- test a narrow synthetic CRM export instead of claiming universal SaaS support;
- keep vendor import/export manual in the prototype;
- use GPT-5.6 Sol only for evidence-referenced semantic mapping;
- fail closed when meaning is ambiguous and require confirmation of a complete
  mapping before evaluation;
- reserve `EXIT_READY`, `NOT_EXIT_READY`, and `NEEDS_REVIEW` for deterministic
  code;
- enter Work & Productivity rather than reuse a developer-tool framing.

One concrete Codex review already caught a parser-to-mapper size-boundary
mismatch; the adapter and targeted test were tightened before integration.
GPT-5.6 Sol's runtime contribution is different from Codex's build role: the
model interprets unfamiliar export field names under a strict structured-output
contract and has no verdict field.

The source is public at
[github.com/pakales/exitcanary](https://github.com/pakales/exitcanary), and the
bounded public judge smoke passed against the fallback-only deployment. The
93-second demo is public at
[youtu.be/-x6M4nCIX3k](https://youtu.be/-x6M4nCIX3k). The Build Week entry is
submitted at [devpost.com/software/exitcanary](https://devpost.com/software/exitcanary)
with primary Codex session ID
`019f813d-fdfb-7e93-8365-783b07ade86f`; signed-out access and the Devpost
**Submitted** state were verified on 2026-07-21.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:public-preflight
pnpm test:public-smoke
pnpm build
pnpm audit:prod
pnpm verify
```

`pnpm verify` is the repository gate. Tested runtime source snapshot
`a178969062a631aa669dcdf664b9c05f4a297d28` passed lint, typecheck, 12 Vitest
files / 86 tests, five public-preflight tests, seven public-smoke tests, the
production build, and the production audit. The full manual and automated
matrix is in [docs/TESTING.md](docs/TESTING.md).

The bounded synthetic live-mapping smoke also passed on the current prose-free
model contract: `gpt-5.6-sol` returned 33 proposals, zero unresolved targets,
no warning, and no verdict field. This does not authorize a public paid endpoint
or change the public deployment's separately verified fallback-only posture.

The bounded black-box verifier passed against the published canonical origin
for the tested runtime snapshot. It sends only checked-in synthetic canary
data, rejects redirects, and never sends credentials:

```bash
pnpm smoke:public-judge -- https://exitcanary.vercel.app
```

The command verified the public security headers, bounded canary and judge ZIPs,
the exact 33-target registry, fallback-only mapper identity, foreign-origin
rejection on both APIs, all three deterministic verdict states,
injected-verdict rejection, digest stability, and digest separation. Browser
accessibility, signed-out file upload, and provider environment remain separate
manual gates.

## How the decision boundary works

| Layer | Responsibility | May set the verdict? |
| --- | --- | --- |
| Browser parser | Builds a bounded normalized manifest from supplied files | No |
| GPT-5.6 Sol | Proposes semantic mappings with evidence references | No |
| Human review | Resolves bounded candidates and explicitly confirms every mapped field | No |
| Server evaluator | Compares confirmed evidence with the application-owned canary contract | **Yes** |
| Server receipt builder | Binds versions, packet, mapping, and result into a SHA-256 digest | No |

The digest detects changes to the bounded receipt inputs. It is not a digital
signature, trusted timestamp, tamper-proof seal, or proof of evidence origin.

## Privacy and security posture

- `OPENAI_API_KEY` remains server-only.
- Uploaded values are untrusted data, never model instructions.
- OpenAI Responses API requests use `store: false`.
- The application is designed not to persist export packets or model output.
- After explicit GPT consent, `/api/map` receives field paths and up to five
  bounded sample values per field; `/api/evaluate` receives the full normalized
  packet and confirmed map.
- Model output is schema-constrained, bounded, and never rendered as raw HTML.
- A model failure cannot upgrade or downgrade the deterministic truth.
- Production responses add HSTS, frame denial, same-origin isolation, and a
  restrictive baseline content-security policy.

Review [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) before changing parsing,
model prompts, request handling, persistence, or receipt generation.

## Documentation

- [Product brief](docs/PRODUCT-BRIEF.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Evidence contract](docs/EVIDENCE-CONTRACT.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Testing](docs/TESTING.md)
- [Public judge deployment](docs/PUBLIC-DEMO-DEPLOYMENT.md)
- [Demo script](docs/DEMO-SCRIPT.md)
- [Build Week submission record](docs/BUILD-WEEK-SUBMISSION.md)
- [Public sample data](examples/README.md)

## Build Week

ExitCanary is submitted in the **Work & Productivity** category. The official
challenge evaluates technological implementation, design, potential impact,
and idea quality. The source repository, fallback-only judge URL, public
YouTube demo, and public Devpost page are live. The exact Codex `/feedback`
session ID and the verified submission evidence are recorded in
[docs/BUILD-WEEK-SUBMISSION.md](docs/BUILD-WEEK-SUBMISSION.md).

## License

MIT — see [LICENSE](LICENSE).
