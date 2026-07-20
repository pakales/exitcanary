# Product brief

## One-line thesis

Before committing to a SaaS product, run a small synthetic business through its
export and prove what comes back.

## Problem

An export button proves only that a file can be generated. It does not prove
that the file preserves the data a company would need to leave: record
identities, relationships, activity history, attachments, custom fields,
timestamps, and edge-case values.

That gap can be discovered late because teams evaluate feature fit and import
quality during a trial, while export quality can remain untested until an urgent
migration. At that point switching cost and vendor leverage may already be
high.

## Customer and buying moment

### Primary buyer

- SMB or mid-market operations lead;
- IT or SaaS portfolio owner;
- procurement or vendor-risk lead;
- privacy/data protection lead who needs technical evidence;
- implementation consultant evaluating tools for a client.

### User

The person running the trial or coordinating vendor due diligence. They do not
need to understand the vendor's export schema, but they can review a proposed
mapping, recognize their business objects, and confirm only a complete map.

### Payment moment

- before an annual SaaS contract is signed;
- before a renewal that increases commitment or price;
- before standardizing a tool across a team;
- when negotiating export and exit-assistance clauses.

The product earns its fee when a failed drill changes a buying decision,
creates a concrete contract requirement, or exposes paid migration work before
the commitment.

## Job to be done

> When I evaluate a SaaS product that will hold important business data, help me
> test the real exit path before I commit, so I can compare vendors and negotiate
> from evidence rather than promises.

## Product loop

1. Select a bounded synthetic profile.
2. Import it into a vendor trial.
3. Trigger the vendor's advertised full export.
4. Upload the returned CSV, JSON, or ZIP packet.
5. Review GPT-5.6 Sol's proposed semantic mappings.
6. Let deterministic code compare returned evidence with the original canary.
7. Share a receipt containing exact failures and a bounded digest.

## Where GPT-5.6 adds value

Deterministic code is excellent at comparing known values once their meaning is
known. It is brittle when every vendor names and structures the same concept
differently. After explicit user consent, GPT-5.6 Sol interprets that schema
variation and produces reviewable, evidence-referenced mapping proposals. The
default path keeps exact-alias matching local.

It is not used to judge export quality. The model cannot set, override, upgrade,
or downgrade the verdict.

## Deterministic core

The engine owns:

- the versioned canary profile;
- authoritative canonical fields and check IDs;
- mapping reference validation;
- exact record/value/relationship comparisons;
- required-check pass/fail/review rules;
- receipt construction and digest inputs.

This boundary gives judges and future buyers a clear answer to “what happens if
the model is wrong?” Ambiguous mappings require review; the model cannot talk a
missing relationship into existence.

## Competition prototype

### In scope

- one synthetic CRM profile;
- CSV and JSON evidence inside direct files or ZIP;
- manual vendor import/export;
- bundled flawed and complete scenarios;
- human mapping confirmation;
- deterministic verdict and receipt;
- 60–90 second no-account demo.

### Out of scope

- arbitrary SaaS compatibility;
- live credentials or vendor connectors;
- production customer data;
- automatic migration into another vendor;
- legal/compliance guarantees;
- cryptographic signing or origin attestation;
- proprietary workflow and UI behavior portability.

## Value proposition

ExitCanary replaces a binary procurement question — “does it export?” — with
evidence a buyer can act on:

- which business objects returned;
- which required fields or relationships disappeared;
- whether history and attachment evidence survived;
- which semantic mappings need human review;
- whether the result changed after the vendor fixed its export.

No speculative ROI percentage is used. The credible value test is whether one
identified failure can prevent or renegotiate a high-friction annual commitment.

## Adjacent solutions and positioning

| Approach | What it does well | ExitCanary wedge |
| --- | --- | --- |
| Procurement/export checklists | Make lock-in questions visible | Executes a bounded technical drill against the vendor's returned data |
| Data-migration platforms | Transform and load real customer data between systems | Tests the exit before commitment; does not perform the migration |
| Cloud-exit assessment tools | Assess workload/service portability and exit planning | Focuses on SaaS business-record fidelity in a synthetic trial |
| Vendor-specific export validators | Can deeply understand one product | Uses a generic bounded manifest plus semantic mapping for a CRM prototype |
| Manual consultant review | Adds domain judgment and contract context | Produces repeatable machine checks and a shareable receipt |

Relevant examples include the
[SpotSaaS export-readiness checklist](https://www.spotsaas.com/resources/no-code-development-platforms-software/lockin-export-checklist),
[Vern](https://vern.so/), [ExitCloud](https://exitcloud.io/), and
[EscapeCloud](https://escapecloud.io/). They demonstrate that lock-in,
migration, and exit readiness are active problem spaces. They are not presented
as exhaustive competitors or exact substitutes.

ExitCanary's defensible claim is narrow: its real-upload path combines a known
synthetic business graph, the vendor's returned export, semantic mapping,
bounded human resolution, explicit confirmation, and deterministic comparison.
Its repeatable bundled demo is different: it uses a disclosed pre-mapped
synthetic fixture, still requires review, and uses a simulated fixture swap.
ExitCanary does not claim to be the first or only product with this pattern.

## Business model hypothesis

### Entry product

A paid one-off “exit drill” per vendor/profile, suitable for a procurement event
or consultant engagement.

### Expansion

- team workspace for comparing multiple vendors;
- recurring re-test before renewal or after export changes;
- additional canary profiles by product category;
- evidence-pack export for procurement and legal review;
- consultant and MSP portfolio plans.

Pricing is deliberately **TBD** until buyer interviews establish whether the
budget sits in procurement, IT operations, privacy, or implementation services.

## Go-to-market hypothesis

1. Start with consultants and fractional operations/IT leaders who evaluate
   several SaaS products per quarter.
2. Publish vendor-neutral exit-drill templates and anonymized failure patterns.
3. Sell the test at the annual-contract or renewal decision, not as another
   always-on dashboard.
4. Build vendor import guidance only after repeated demand; keep the export
   assessment independent.

## Success measures

### Prototype

- a first-time user understands the value and reaches a verdict in under two
  minutes with bundled data;
- the model never controls verdict state;
- ambiguous mappings cannot pass silently;
- flawed and complete fixtures produce the intended deterministic results;
- judges can run the project without a vendor account.

### Product discovery

- due-diligence professionals agree the test belongs before signature/renewal;
- buyers can name a recent decision this evidence would have changed;
- teams are willing to request an export during a trial;
- at least one customer pays for a vendor/profile drill or consultant report.

Do not invent target percentages or customer evidence before interviews occur.

## Key risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Import friction | A buyer may not be able to seed the canary cleanly | Small profile, vendor-specific import instructions later, manual trial-first flow |
| Vendor export variation | One parser cannot cover every product | Bounded formats, one record table per canonical entity, strict unsupported state, semantic mapping plus confirmation |
| False confidence | A small canary may be mistaken for full migration proof | Persistent scope language and explicit non-goals |
| Model mapping error | Plausible fields may be mapped incorrectly | Evidence references, schema validation, human confirmation, deterministic checks |
| Sensitive data use | Real exports may contain regulated data | Synthetic demo, no persistence, `store: false`, privacy review before production |
| Buyer inertia | Teams may not request exports during trials | Position as a contract/renewal gate and consultant-delivered service |
| Easy copyability | The visible flow can be replicated | Build proprietary profile quality, vendor patterns, evidence history, and trusted workflow over time |

## Roadmap after the competition

### Phase 1 — validate the wedge

- interview procurement, IT operations, privacy, and implementation consultants;
- run supervised drills against three CRM trials using only synthetic data;
- refine the smallest check set that changes a buying decision.

### Phase 2 — repeatable service

- vendor-specific seed instructions and saved mapping templates;
- authenticated workspaces, quotas, and privacy-reviewed retention choices;
- shareable procurement report with explicit evidence limitations;
- recurring renewal re-test.

### Phase 3 — broader product

- additional bounded canaries for support desks, project tools, and HR systems;
- API/CLI for enterprise procurement workflows;
- external signing/timestamping if buyers require attestation;
- partner program for consultants and MSPs.

Every expansion must preserve the rule that an AI model interprets evidence but
does not create the authoritative verdict.
