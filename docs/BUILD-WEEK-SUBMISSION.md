# OpenAI Build Week submission draft

Status: **draft — do not submit without completing every marked gate.**

Official references checked on 2026-07-21:

- [OpenAI Build Week overview](https://openai.com/build-week/)
- [Devpost challenge page](https://openai.devpost.com/)
- [Official rules](https://openai.devpost.com/rules)

The Devpost page lists a deadline of **July 21, 2026 at 5:00 PM PDT**, requires a
working project built with Codex using GPT-5.6, a category, description, a free
working demo/test URL, a public demo video under three minutes with audio
covering both Codex and GPT-5.6, and a testable code repository with relevant
licensing and setup/sample guidance. A private repository must be shared with
`testing@devpost.com` and `build-week-event@openai.com`. The submission also
needs the primary build thread's Codex `/feedback` session ID. Re-check the live
page immediately before submission.

The official rules define the submission period as July 13, 2026 at 9:00 AM PT
through July 21, 2026 at 5:00 PM PT and the judging period as July 22 at 10:00
AM PT through August 5 at 5:00 PM PT. If an overview page shows a different
judging date, the official rules control.

## Submission identity

| Field | Draft |
| --- | --- |
| Project name | ExitCanary |
| Tagline | Before you enter, prove you can leave. |
| Category | **Work & Productivity** |
| Repository URL | TBD / verify before submission |
| Demo URL | TBD / public YouTube, audio and runtime verified |
| Free working demo/test URL | TBD / verify while logged out before submission |
| Codex `/feedback` session ID | TBD / real core-build session only |
| License | MIT |
| Team/member details | TBD / match Devpost account |

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
- automated contracts for verdicts, mapping references, and digest behavior.

`TBD / verify before submission:` update this list to match the final source and
only mention controls that have been tested.

### How GPT-5.6 is used

GPT-5.6 Sol handles the semantic step: understanding that different
vendors may call the same concept `company_id`, `org_ref`, `account`, or nest it
inside another object. It proposes a bounded mapping and explains the supplied
evidence for review.

The model is intentionally denied verdict authority. This makes the AI useful
where rigid code is brittle without asking it to be authoritative where exact,
reproducible checks matter.

Pre-final synthetic smoke evidence: with the mapper timeout set to 30 seconds,
the full 33-field request returned `mode: "live"`, model `gpt-5.6-sol`, 33
proposals, zero unresolved targets, and no warning in about 21.0 seconds. Re-run
this on the exact committed/deployed build before recording or submission.

### How Codex was used

Codex was used as the primary build environment to:

- turn the product thesis into explicit decision and security invariants;
- implement the deterministic contract and adversarial fixtures;
- build the semantic-mapping boundary and fallback behavior;
- iterate the responsive product experience;
- generate and run targeted validation, review failure modes, and synchronize the
  architecture, threat model, demo, and submission package.

`TBD / verify before submission:` add two or three concrete examples from the
actual core-build session and supply that session's real `/feedback` ID.

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
| Technological implementation | Real CSV/JSON/ZIP intake, structured GPT-5.6 mapping, strict authority boundary, deterministic checks, tests | Current worktree: `pnpm verify` passed 11 files / 60 tests plus build/audit; final-commit rerun TBD |
| Design | Coherent 60–90s start-to-verdict flow, clear exit-door metaphor, accessible desktop/mobile UI | Production browser QA passed at 1440×900 and 390×844; screenshots captured; final deployed-origin rerun TBD |
| Potential impact | Named buyer and buying/renewal moment; exact failures the product exposes | Draft complete; validate demo evidence |
| Quality of idea | Executable pre-purchase exit drill positioned against adjacent checklists, migration, and cloud-exit tools | Draft complete; avoid novelty overclaim |

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

- [ ] Re-read the current Devpost rules and eligibility requirements.
- [ ] Confirm the entrant/team/organization is eligible and, if applicable, has
      an authorized representative.
- [ ] Preserve evidence that this project was newly created during the July
      13–21 submission period; otherwise document only the meaningful extension
      made with Codex/GPT-5.6 after the period opened, using dated commits and
      session evidence.
- [ ] Confirm the project is entered under **Work & Productivity**.
- [ ] Confirm a working project built with Codex and GPT-5.6.
- [ ] Confirm the running project functions exactly as the video and submission
      text depict.
- [ ] Run and record `pnpm verify` on the final commit.
- [ ] Run the live GPT-5.6 Sol synthetic-data smoke test.
- [ ] Choose and document the public credential posture: verified durable
      quota/auth/kill switch for live GPT, or an explicitly fallback-only judge
      deployment with the live synthetic smoke demonstrated separately.
- [ ] Verify the no-key/failure fallback is transparent and safe.
- [ ] Verify the UI and video clearly distinguish live, fallback, and bundled
      pre-mapped modes, including the explicit GPT consent gate.
- [ ] Verify flawed → not ready/review, complete → ready, and digest change.
- [ ] Verify the receipt disclaimer is visible beside the digest.
- [ ] Verify both `/api/demo-export` variants download and traverse the real
      parser/normalizer/evaluator lane.
- [ ] Pin and verify `EXITCANARY_PUBLIC_ORIGIN` on the deployed canonical URL.
- [ ] Exercise `EXITCANARY_LIVE_MAPPING_ENABLED=false` and confirm no model call
      occurs.
- [ ] Verify desktop/mobile/keyboard/reduced-motion behavior and zero console errors.
- [ ] Provide a free working demo/test URL and test its full judge path while
      logged out in a clean browser session.
- [ ] Scan repository, client bundle, video, and screenshots for secrets/private data.
- [ ] Confirm the repository URL is accessible to judges.
- [ ] Confirm MIT license, README setup, Codex collaboration story, and sample
      data are present whether the judging repository is public or private.
- [ ] If private, share repository access with `testing@devpost.com` and
      `build-week-event@openai.com`, then verify the invitations.
- [ ] Record a public YouTube demo under three minutes with audible narration
      explaining both Codex and GPT-5.6.
- [ ] Remove unlicensed music, footage, copyrighted material, and third-party
      marks unless their use is permitted; keep a source/license note for every
      external asset.
- [ ] Watch the uploaded video end-to-end while logged out.
- [ ] Add the verified free working demo/test URL to Devpost.
- [ ] If the demo is private, include working judge credentials and test them in
      a clean session.
- [ ] Keep the project available free of charge and without restriction through
      August 5, 2026 at 5:00 PM PT, the official judging-period end.
- [ ] Confirm the description, video, test instructions, and all submission
      materials are in English or include the required English translation.
- [ ] Confirm original ownership, privacy/publicity rights, third-party SDK/API
      authorization, and open-source license compliance.
- [ ] Confirm the repository and downloadable artifacts contain no malicious or
      disabling code.
- [ ] Capture the real `/feedback` Codex session ID from the session where most
      core functionality was built.
- [ ] If other projects are submitted by the same entrant, document that each is
      unique and substantially different.
- [ ] Remove every `TBD` that affects judge access or factual claims.
- [ ] Submit before the live deadline; confirm Devpost shows the project as submitted.
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

## Suggested tags

`productivity`, `procurement`, `data-portability`, `saas`, `vendor-lock-in`,
`gpt-5.6`, `codex`, `structured-outputs`
