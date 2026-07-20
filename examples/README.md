# ExitCanary sample data

Everything in this directory is synthetic. It contains no real customer,
account, vendor, API, or private project data.

## Public canary pack

- [`canary-pack/exitcanary-canary-profile.json`](canary-pack/exitcanary-canary-profile.json)
  mirrors the bounded `crm-exit-canary@1.0.0` reference graph.
- [`canary-pack/exit-canary–sutartis.txt`](canary-pack/exit-canary–sutartis.txt)
  is the 35-byte attachment canary. Its expected SHA-256 is
  `f2527ea2050b66c32e29b771d90640fbdec1c6fb0977c48578c5063a8be3117c`.

The JSON is a vendor-neutral reference contract, not a claim that every CRM can
import this exact nested shape. The competition flow keeps vendor import/export
manual and tests only the bounded data represented here.

The executable source of truth remains `src/lib/canary-profile.ts`; the public
copy must pass a drift comparison before submission.

## Demo exports

The application-owned fixtures in `src/lib/sample-exports.ts` define:

- `COMPLETE_NORMALIZED_EXPORT`: all nine required checks pass;
- `FLAWED_NORMALIZED_EXPORT`: six checks fail — Unicode, relation integrity,
  activity timestamp, activity history, custom field, and attachment checksum;
- `REVIEW_REQUIRED_FIELD_MAPPING`: one semantic field remains ambiguous, so the
  deterministic verdict is `NEEDS_REVIEW`.

The public judge artifacts are:

- [`exports/acme-crm-export-complete.zip`](exports/acme-crm-export-complete.zip)
  — SHA-256
  `345b8c0cb79addafb2896427a2692de0478dbaa22126ff8c4f576507813bf8e8`;
- [`exports/acme-crm-export-flawed.zip`](exports/acme-crm-export-flawed.zip) —
  SHA-256
  `ce758d053240c90858d0b44df42e6a911f192e451de4a57d494bdd1f59f184fe`.

Their readable source trees are in [`exports/complete/`](exports/complete/) and
[`exports/flawed/`](exports/flawed/). The targeted
`tests/end-to-end-artifacts.test.ts` gate parses each checked-in ZIP, normalizes
it with the fixed 33-field mapping, and evaluates it. On the 2026-07-21
worktree, the documentation workstream re-ran this test together with the
canary/demo download-route tests: 3 files and 7 tests passed. The complete ZIP
produced `EXIT_READY` with nine passes and the flawed ZIP produced
`NOT_EXIT_READY` with six failures. The repository-wide verification record is
bound to local product commit `5e463be7ced72b36f5dbd8bdbcb51ea7a94203c1`.

Use **Use my export** to exercise the parser and live/fallback mapper path. The
separate **Run pre-mapped flawed demo** button uses an in-app normalized fixture
and a disclosed pre-mapped field set; it does not parse these ZIPs or call GPT,
and the user still must review and confirm all 33 rows.

On a running instance, equivalent generated judge inputs are available at:

- `/api/demo-export?variant=complete`;
- `/api/demo-export?variant=flawed`.

Those endpoints produce real ZIP inputs for **Use my export**. Their targeted
route test runs the returned bytes through parser → normalizer → evaluator and
expects the same nine-pass versus six-failure outcomes.

## Required fixture disclosure

The flawed-to-complete transition in the demo is a **simulated fixture swap**.
It demonstrates server re-evaluation; it does not claim that ExitCanary repaired
a vendor export, modified a repository, or changed a SaaS account.

## Safety gate

Before publication:

- validate the public JSON against `CanonicalCanaryProfileSchema`;
- verify the attachment byte length and SHA-256;
- run the evaluator and fixture tests;
- review filenames, people, companies, messages, IDs, and attachments for
  accidental secrets or copied private data.
