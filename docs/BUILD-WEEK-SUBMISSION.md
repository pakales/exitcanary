# OpenAI Build Week submission record

Status: **submitted and publicly verified on 2026-07-21** at
[devpost.com/software/exitcanary](https://devpost.com/software/exitcanary).
Devpost still permits edits until the live deadline; substantive materials
must be frozen at the deadline.

Official references checked on 2026-07-21:

- [OpenAI Build Week overview](https://openai.com/build-week/)
- [Devpost challenge page](https://openai.devpost.com/)
- [Official rules](https://openai.devpost.com/rules)

The Devpost page lists a deadline of **July 21, 2026 at 5:00 PM PDT**
(**July 22 at 3:00 AM EEST**), requires a
working project built with Codex using GPT-5.6, a category, description, a free
working demo/test URL, a public YouTube demo video (not unlisted) under three
minutes with audio
covering both Codex and GPT-5.6, and a testable code repository with relevant
licensing and setup/sample guidance. A private repository must be shared with
`testing@devpost.com` and `build-week-event@openai.com`. The submission also
needs the primary build thread's Codex `/feedback` session ID. The live page and
account-side values were rechecked on 2026-07-21 before the final submit action.

The official rules define the submission period as July 13, 2026 at 9:00 AM PT
through July 21, 2026 at 5:00 PM PT and the judging period as July 22 at 10:00
AM PT through August 5 at 5:00 PM PT. The OpenAI overview currently names
August 7 instead. Treat the official rules as authoritative and operationally
keep the public artifacts available through at least August 12.

## Submission identity

| Field | Submitted value |
| --- | --- |
| Project name | ExitCanary |
| Tagline | Before you enter, prove you can leave. |
| Category | **Work & Productivity** |
| Repository URL | [github.com/pakales/exitcanary](https://github.com/pakales/exitcanary) — public; tested runtime source snapshot `a178969062a631aa669dcdf664b9c05f4a297d28` |
| Public YouTube demo video | [youtu.be/FWoRiuhg8sY](https://youtu.be/FWoRiuhg8sY) — public on EV1 Labs; signed-out 1080p HD, unmuted audio, English (United States) captions, title, duration, and crop verified |
| Free working demo/test URL | [exitcanary.vercel.app](https://exitcanary.vercel.app) — public, intentionally keyless/fallback-only; bounded black-box judge smoke passed on the tested runtime snapshot |
| Codex `/feedback` session ID | `019f813d-fdfb-7e93-8365-783b07ade86f` — confirmed as the primary build thread and entered in Devpost |
| License | MIT |
| Submitter | Individual — Evaldas Vigelis (`@e-vigelis`), country of residence Lithuania |
| Devpost status | **Submitted** — confirmed both by the post-submit success notice and the OpenAI Build Week **My projects** page |
| Public Devpost page | [devpost.com/software/exitcanary](https://devpost.com/software/exitcanary) — verified in an isolated signed-out browser |

Publication checkpoint on 2026-07-21: the Devpost entry, repository,
fallback-only judge URL, and 93-second YouTube demo above are public, and
`pnpm smoke:public-judge -- https://exitcanary.vercel.app` passed against source snapshot
`a178969062a631aa669dcdf664b9c05f4a297d28`. The signed-out Devpost page exposed
the correct video, demo URL, GitHub repository, three-image gallery, project
story, and **Submitted to OpenAI Build Week** association without an
**Incomplete submission** marker.

## Short description

ExitCanary tests a SaaS vendor's claimed export before a company commits. It
plants a known synthetic CRM dataset, uses GPT-5.6 Sol to map unfamiliar export
schemas, and lets deterministic code identify which bounded records,
relationships, history, custom fields, timestamps, Unicode values, and
attachments are present in the supplied packet.

## Full project description

### Inspiration

SaaS trials are optimized around getting data in. The painful discovery that
data cannot come back out — or returns without relationships, history, custom
fields, and attachments — can happen only after the tool is embedded and the
vendor has renewal leverage.

ExitCanary moves that discovery to the buying moment. Instead of trusting an
“Export” button or a checklist answer, a team performs a small, repeatable exit
drill while the account is still a trial.

### What it does

ExitCanary provides a versioned synthetic CRM canary with contacts, companies,
deals or orders, relationships, activities, custom fields, timestamps, Unicode
edge cases, and attachment evidence. A buyer imports the canary into a SaaS
trial, requests the vendor's advertised full export, and uploads the returned
CSV, JSON, or ZIP packet.

GPT-5.6 Sol proposes how the vendor's unfamiliar files and fields correspond to
the canonical canary and cites the supplied evidence. After explicit consent,
the user may resolve an uncertain target from bounded source candidates, then
must review every mapping; unresolved or unconfirmed targets block UI
evaluation. Deterministic code owns the three-state contract:
`EXIT_READY`, `NOT_EXIT_READY`, or `NEEDS_REVIEW`.

The resulting receipt includes stable check results and a SHA-256 digest bound
to the canary version, evaluator version, normalized packet, mapping, and
assessment. The digest detects changes to those bounded inputs; it is not a
signature, trusted timestamp, or proof of export origin.

### How we built it

ExitCanary is a TypeScript/Next.js application with a strict data boundary:

- bounded CSV/JSON/ZIP parsing and normalization;
- an explicit one-source-table-per-canonical-entity normalization boundary;
- application-owned, versioned CRM canary and check definitions;
- OpenAI Responses API with `gpt-5.6-sol`, structured output, and `store: false`;
- opt-in model data sharing, bounded ambiguity resolution, and explicit review
  of all 33 mappings;
- pure deterministic evaluation and receipt generation;
- synthetic flawed and complete fixtures for a no-account judge demo;
- downloadable synthetic judge ZIP endpoints for the real parser/mapper lane;
- automated contracts for verdicts, mapping references, digest behavior, and
  hostile parser/request boundaries;
- a fail-closed public posture: live mapping runs only when the server flag is
  exactly `true`, while the judge deployment preflight requires no API key and
  an explicit fallback-only configuration.

### How GPT-5.6 is used

GPT-5.6 Sol handles the semantic step: understanding that different
vendors may call the same concept `company_id`, `org_ref`, `account`, or nest it
inside another object. It proposes a bounded mapping and explains the supplied
evidence for review.

The model is intentionally denied verdict authority. This makes the AI useful
where rigid code is brittle without asking it to be authoritative where exact,
reproducible checks matter.

Controlled synthetic smoke evidence: with the mapper timeout set to 30 seconds,
the full 33-field request returned `mode: "live"`, model `gpt-5.6-sol`, 33
proposals, zero unresolved targets, and no warning in about 21.0 seconds. The
locked video visibly identifies that run as live. The public judge URL is
intentionally keyless and fallback-only, so it does not claim public live-model
availability.

### How Codex was used

Codex was used as the primary build environment to:

- turn the product thesis into explicit decision and security invariants;
- implement the deterministic contract and adversarial fixtures;
- build the semantic-mapping boundary and fallback behavior;
- iterate the responsive product experience;
- generate and run targeted validation, review failure modes, and synchronize the
  architecture, threat model, demo, and submission package.

Concrete examples from the build session include finding and fixing a
parser-to-confirmation path-length mismatch, proving ZIP expansion limits
before unsafe inflation, and red-teaming an inherited API key into an explicit
exact-`true` live flag plus a deployment preflight. The primary build thread ID
`019f813d-fdfb-7e93-8365-783b07ade86f` was confirmed at the account boundary
and entered in the submitted Devpost form; it was not inferred from source code.

### Challenges

The hardest design problem was separating “the model found a plausible field”
from “the export demonstrably preserved the business relationship.” ExitCanary
solves this with an explicit confirmation boundary, a hard unresolved state,
and a deterministic evaluator.

The second challenge was keeping the claim honest. A synthetic CRM canary can
expose specific portability loss, but it cannot prove universal export quality,
legal compliance, or data origin. The product makes that boundary visible.

### Potential impact

The initial buyer is an operations, IT, procurement, privacy, or implementation
lead evaluating a CRM-like SaaS tool. The payment moment is before an annual
contract or renewal — when one failed exit drill can still change the decision,
strengthen an export clause, or justify a migration-support commitment.

The prototype's value is not predicting every future migration. It turns an
otherwise vague lock-in risk into concrete missing objects and relationships
while the buyer still has leverage.

### What is different

There are valuable adjacent products: procurement and lock-in checklists,
cloud-exit assessment tools, and data-migration platforms. ExitCanary's narrower
wedge is an executable pre-purchase drill: seed known synthetic business data,
retrieve the vendor's own export, map its schema, and deterministically compare
what returned.

This is a positioning statement, not a claim that ExitCanary is the first or
only product to use canary data or test portability.

### What is next

- vendor-specific import templates while keeping the export test independent;
- recurring re-tests before renewal and after vendor export changes;
- signed organizational receipts and external timestamping, clearly separate
  from the current unsigned digest;
- additional bounded profiles for support desks, project management, and HR;
- procurement evidence packs and contract-export requirements;
- privacy-reviewed enterprise deployment and durable quota controls.

## Judging-criteria evidence map

Devpost lists the four criteria with equal weighting. The submission must make
all four independently visible; technical depth cannot compensate for an
unclear product experience or unsupported impact claim.

| Criterion | What the submission should show | Gate |
| --- | --- | --- |
| Technological implementation | Real CSV/JSON/ZIP intake, prose-free structured GPT-5.6 mapping, strict authority boundary, deterministic checks, tests | Source snapshot `a178969062a631aa669dcdf664b9c05f4a297d28` passed 12 Vitest files / 86 tests, five public-preflight tests, seven public-smoke tests, the production build, and dependency audit; its public fallback-only deployment passed the bounded judge smoke |
| Design | Coherent 93-second start-to-verdict story, clear exit-door metaphor, accessible desktop/mobile UI | Local production QA passed at 1440×900, 390×844, 200% equivalent reflow, reduced motion, keyboard flow, and zero console errors; the public black-box origin check passed, while signed-out browser/file-picker QA remains a separate manual gate |
| Potential impact | Named buyer and buying/renewal moment; exact failures the product exposes | Submission copy and deterministic flawed/complete evidence are complete locally |
| Quality of idea | Executable pre-purchase exit drill positioned against adjacent checklists, migration, and cloud-exit tools | Analog red-team is documented without a first/only claim |

## Honest analog positioning

- [SpotSaaS export-readiness checklist](https://www.spotsaas.com/resources/no-code-development-platforms-software/lockin-export-checklist)
  frames the procurement risk and recommends testing exports.
- [Vern](https://vern.so/) focuses on AI-assisted customer data migration and
  onboarding into SaaS products.
- [ExitCloud](https://exitcloud.io/) and
  [EscapeCloud](https://escapecloud.io/) assess cloud workload exit readiness.

ExitCanary does not claim these products are direct substitutes or that the
market lacks other approaches. The demonstrated distinction is the bounded
seed-export-compare loop before purchase or renewal.

## Required submission gates

- [x] Re-read the current Devpost rules and eligibility requirements.
- [x] Record the submitter as Individual — Evaldas Vigelis, country of residence
      Lithuania. The entrant explicitly accepted the Official Rules and
      Devpost Terms at submission; eligibility remains entrant-attested.
- [x] Preserve evidence that this project was newly created during the July
      13–21 submission period; otherwise document only the meaningful extension
      made with Codex/GPT-5.6 after the period opened, using dated commits and
      session evidence.
- [x] Confirm the project is entered under **Work & Productivity**.
- [x] Confirm a working project built with Codex and GPT-5.6.
- [x] Confirm the running public project functions as the video and submission
      text depict: signed-out flawed → `NOT_EXIT_READY` → disclosed fixture swap
      → `EXIT_READY` passed with 33 reviewed mappings and a changed digest.
- [x] Run and record `pnpm verify` on the local product commit.
- [x] Run the live GPT-5.6 Sol synthetic-data smoke test.
- [x] Choose and document the public credential posture: keyless,
      fallback-only judge deployment with live synthetic GPT evidence shown
      separately; see `docs/PUBLIC-DEMO-DEPLOYMENT.md`.
- [x] Verify the no-key/failure fallback is transparent and safe.
- [x] Verify the UI and local video candidate clearly distinguish live,
      fallback, and bundled pre-mapped modes, including the explicit GPT
      consent gate.
- [x] Verify flawed → not ready/review, complete → ready, and digest change.
- [x] Verify the receipt disclaimer is visible beside the digest.
- [x] Verify both `/api/demo-export` variants download and traverse the real
      parser/normalizer/evaluator lane.
- [x] Pin and verify `EXITCANARY_PUBLIC_ORIGIN` on the deployed canonical URL,
      `https://exitcanary.vercel.app`.
- [x] Run `pnpm smoke:public-judge -- https://exitcanary.vercel.app`; the
      bounded black-box contract passed for source snapshot
      `a178969062a631aa669dcdf664b9c05f4a297d28`.
- [x] Exercise `EXITCANARY_LIVE_MAPPING_ENABLED=false` and confirm no model call
      occurs.
- [x] Verify desktop/mobile/keyboard/reduced-motion behavior and zero console errors.
- [x] Provide the free working demo/test URL
      `https://exitcanary.vercel.app`; the credential-free black-box judge path
      passed. Signed-out browser/file-picker accessibility QA remains separate.
- [x] Scan repository, client bundle, local video candidate, and screenshots for
      secrets/private data.
- [x] Confirm the public repository URL is accessible at
      `https://github.com/pakales/exitcanary`.
- [x] Confirm MIT license, README setup, Codex collaboration story, and sample
      data are present whether the judging repository is public or private.
- [x] Private-repository sharing is not applicable; the repository is public.
- [x] Upload the verified 93-second candidate to public YouTube (not unlisted)
      at `https://youtu.be/FWoRiuhg8sY`; it includes audible narration
      explaining Codex and GPT-5.6.
- [x] Remove unlicensed music, footage, copyrighted material, and third-party
      marks unless their use is permitted; keep a source/license note for every
      external asset.
- [x] Verify the uploaded video while logged out: correct EV1 Labs channel,
      public visibility, 1:33 duration, 1080p HD availability, unmuted audio,
      English (United States) captions, title, description, and crop.
- [x] Add the verified free working demo/test URL to Devpost and confirm it is
      exposed on the signed-out public project page.
- [x] Private-demo credentials are not applicable; the public fallback-only URL
      passed the bounded black-box check without cookies or authorization.
- [ ] Keep the project available free of charge and without restriction through
      at least August 12, covering the official August 5 judging end and the
      overview page's later August 7 date.
- [x] Confirm the local description, video, captions, and test instructions are
      in English; recheck the pasted Devpost fields before submission.
- [x] Confirm original ownership, privacy/publicity rights, third-party SDK/API
      authorization, and open-source license compliance through the entrant's
      explicit Official Rules/Devpost Terms acceptance. This is an
      entrant-attested legal representation, not an independent legal audit.
- [x] Confirm the repository and downloadable artifacts contain no malicious or
      disabling code in the reviewed local source and locked media candidate.
- [x] Capture and enter the real primary Codex session ID:
      `019f813d-fdfb-7e93-8365-783b07ade86f`.
- [x] Document the separation from the entrant's other submissions: ExitCanary
      is a SaaS procurement/data-portability product; Gatehold coordinates
      local coding agents, and ProofLatch evaluates software release evidence.
- [x] Replace factual placeholders with verified evidence or explicit
      publication/human-confirmation gates.
- [x] Submit before the live deadline; confirm the success notice, the OpenAI
      Build Week **My projects** status **Submitted ExitCanary**, and the
      signed-out public page at `https://devpost.com/software/exitcanary`.
- [ ] Freeze the submitted materials at the deadline; the official rules do not
      permit ordinary substantive submission changes afterward.

## Claims gate

Do not publish any of the following without new evidence and review:

- first, only, unique, or no competitors;
- universal SaaS or CRM compatibility;
- tamper-proof, verified origin, or signed receipt;
- legal, GDPR, security, procurement, or migration certification;
- proof that a vendor actually ran an export;
- guarantee that all customer data can be migrated;
- production-safe handling of sensitive data.

## Local video candidate evidence

The exact local upload candidate is `exitcanary-build-week-demo-1080p.mp4` with
SHA-256
`0008054d917baa8a08d13cef791cb69f8f1008975c5abf97b8e38028a999477e`
and size 14,120,268 bytes. The final SRT SHA-256 is
`e77efca6efbd25f13750c98c1198b742471f91cf55b73854f6888baf79e7fa45`;
the final thumbnail SHA-256 is
`044c2389917513fe56759c1076fa8536d4a90a821b857d92c1671b0a7ac1013c`.
This exact candidate is public at
`https://youtu.be/FWoRiuhg8sY`. Its deterministic production audit passed:

- 93.000 seconds, 1920 × 1080, H.264, `yuv420p`, 30 fps;
- AAC stereo at 48 kHz, -15.99 LUFS, -4.50 dBTP;
- 0 decode errors and no trimmed speech;
- 25 caption cues preserving the locked narration exactly;
- live mapping, bundled judge path, deterministic verdict, simulated fixture
  swap, and digest limitations are visually distinct;
- synthetic OpenAI `marin` voice disclosure is visible and embedded in MP4
  metadata;
- secret/account-identifier scan passed;
- two independent transcription passes preserved the complete intended product
  meaning, the specific Codex build contribution, the GPT-5.6 role, and the
  closing tagline.

This closes local video production, upload, signed-out technical playback, and
Devpost publication. The verified video and demo URLs resolve from the public
submitted project page.

## Suggested tags

`productivity`, `procurement`, `data-portability`, `saas`, `vendor-lock-in`,
`gpt-5.6`, `codex`, `structured-outputs`
