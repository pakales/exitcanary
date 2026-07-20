# Testing and verification

## Evidence rule

A documented test is not a passed test. Record results only after running the
command against the exact source state being submitted.

## Automated gate

```bash
pnpm verify
```

The repository script is expected to run, in order:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit:prod
```

`TBD / verify before submission:` paste the final UTC timestamp, commit SHA,
Node/pnpm versions, command result, and any accepted residual risk into the
validation record below.

Current targeted evidence reported by the root build session on 2026-07-21:
the bounded parser suite passed 7/7, the deterministic core suite passed 12/12,
the repository typecheck passed at those source points, and the two checked-in
judge ZIPs passed parser → normalizer → evaluator coverage: complete produced
`EXIT_READY` with 9/9 passes; flawed produced `NOT_EXIT_READY` with six
failures. The root session also reported a clean production dependency audit
after pinning PostCSS 8.5.20. These targeted results are not bound to a final
commit and are not the final `pnpm verify` record; rerun them against the exact
submission source.

The documentation workstream re-ran the current artifact/download gate on
2026-07-21:

```bash
pnpm exec vitest run tests/end-to-end-artifacts.test.ts \
  tests/demo-export-route.test.ts tests/canary-pack.test.ts
```

Result: **3 test files passed, 7 tests passed**. This verifies both checked-in
ZIPs, both generated demo-export variants, invalid-variant rejection, public
canary JSON drift, and generated canary ZIP contents on that worktree state. It
still has no final commit SHA and does not replace `pnpm verify`.

The root build session subsequently ran the full repository gate on the current
worktree: **`pnpm verify` passed**, including lint, typecheck, 11 test files / 60
tests, production build, and production dependency audit. Local tool versions
observed after that report are Node `v22.22.2` and pnpm `10.33.2`. The repository
still has no commit, so this is strong pre-final evidence, not the required
final-commit record.

## Deterministic test matrix

| Case | Required assertion | Status |
| --- | --- | --- |
| Complete checked-in ZIP | Parser → normalizer → evaluator produces nine passes and `EXIT_READY` | Targeted artifact test passed; final suite TBD |
| Flawed checked-in ZIP | Parser → normalizer → evaluator produces six failures and `NOT_EXIT_READY` | Targeted artifact test passed; final suite TBD |
| Complete bundled export | Server API returns every required check as pass and verdict `EXIT_READY` | Production browser PASS: 9 pass / 0 fail, 64-char digest |
| Flawed bundled export | Server API returns six authoritative failures and `NOT_EXIT_READY` | Production browser PASS: 6 fail / 3 pass, 64-char digest |
| Ambiguous required mapping | Verdict is `NEEDS_REVIEW`; never a pass | TBD |
| Missing required record | Stable failing check ID and `NOT_EXIT_READY` | TBD |
| Broken relationship | Parent/foreign-key check fails | TBD |
| Damaged Unicode | Value-integrity check fails | TBD |
| Missing custom field | Custom-field check fails | TBD |
| Missing history | History check fails | TBD |
| Missing or changed attachment evidence | Attachment check fails | TBD |
| Packet changes | Receipt digest changes | TBD |
| Confirmed mapping changes | Receipt digest changes | TBD |
| Property/key order changes only | Digest remains stable if canonical data is equivalent | TBD |
| Client attempts to redefine checks | Strict schema rejects the packet | TBD |
| Mapping target bridge | Produces exactly the 33 application-owned canonical fields | TBD |
| Unknown model canonical ID | Model response rejected | TBD |
| Invented model evidence path | Model response rejected | TBD |
| Model attempts verdict output | Schema rejects or ignores it; deterministic verdict unchanged | TBD |
| Model unavailable | Transparent fallback; no fabricated live output or false pass | TBD |

## Parser and request-boundary matrix

| Case | Required behavior | Status |
| --- | --- | --- |
| Valid bounded CSV | Parsed without formula execution or silent coercion | TBD |
| Valid bounded JSON | Parsed within depth and value limits | TBD |
| Valid bounded ZIP | Only supported safe entries are considered | TBD |
| Unsupported file type | Explicit rejection or unsupported label | TBD |
| Oversized request | Rejected before model call | TBD |
| Excess ZIP entries/decompressed bytes | Rejected before full extraction | TBD |
| High-ratio ZIP with declared expansion above budget | Rejected before entry inflation | Root-reported regression pass; final suite TBD |
| `../` or absolute archive path | Rejected | TBD |
| Duplicate normalized archive path | Rejected | TBD |
| Duplicate CSV header | Rejected instead of silently renamed | TBD |
| Invalid UTF-8 | Explicit parse error | TBD |
| More than 500 rows/100 columns/2,000 characters per cell | Explicit bounded parse error | TBD |
| JSON deeper than 10 or above 25,000 nodes | Explicit bounded parse error | TBD |
| Attachment in ZIP | Local SHA-256 and byte length recorded | TBD |
| Malformed CSV/JSON | Explicit parse error, never empty success | TBD |
| Wrong content type | API rejects request | TBD |
| Wrong origin in production | API rejects request | TBD |
| Extra schema keys | Strict validation rejects request/output | TBD |
| Body over 256 KiB, with or without `Content-Length` | API returns `413` before model call | TBD |
| Invalid UTF-8 or JSON | API returns sanitized `400` error | TBD |
| More than 240 sources | Strict request rejection | TBD |
| Any caller-supplied `targets` field | Strict request rejection; route still injects exactly 33 application targets | Root-reported targeted test pass; final suite TBD |
| `EXITCANARY_LIVE_MAPPING_ENABLED=false` | Returns labeled fallback without invoking OpenAI | Root-reported targeted test pass; final suite TBD |
| Parser cell/path near its maximum | Adapter produces mapper-valid samples/paths without silent semantic corruption | TBD |
| One canonical entity split across source tables | Normalizer returns `split_entity`; evaluation is not called | Targeted regression PASS |
| Rate limit exceeded | API returns `429`, rate headers, and `Retry-After` | TBD |
| Mapping dependency throws unexpectedly | API returns sanitized `503` | TBD |
| `/api/evaluate` body over 512 KiB | API returns `413` before evaluation | TBD |
| `/api/evaluate` wrong type/origin/schema | API rejects with sanitized error | TBD |
| Client injects verdict into evaluation request or packet | Strict schema rejects before evaluator runs | TBD |
| Valid complete evaluation request | Server returns uncached `EXIT_READY` receipt with full digest | TBD |
| Canary-pack JSON drift | Checked-in public JSON equals the application-owned profile | Current targeted gate passed; final suite TBD |
| `GET /api/canary-pack` | ZIP has all expected tables, manifest, and exact attachment bytes | Current targeted gate passed; final suite TBD |
| `GET /api/demo-export?variant=complete` | Generated ZIP traverses parser → normalizer → evaluator and reaches `EXIT_READY` | Current targeted gate passed; final suite TBD |
| `GET /api/demo-export?variant=flawed` | Generated ZIP traverses the same path and fails exactly six checks | Current targeted gate passed; final suite TBD |
| Invalid demo-export variant | Returns sanitized `400` JSON | Current targeted gate passed; final suite TBD |
| Configured production origin | Exact origin accepted; mismatched/malformed origin rejected; forwarded headers ignored | TBD final suite/deployment |
| Production security headers | HSTS, CSP, frame denial, same-origin resource/opener, and origin-agent headers present | Local production server PASS; deployed-origin rerun TBD |

## Live GPT-5.6 Sol smoke test

Run only with a server-only credential and synthetic data.

1. Start from a clean shell without printing the key.
2. Confirm `.env.local` is ignored by git.
3. Set `EXITCANARY_LIVE_MAPPING_ENABLED=true`, start the development server,
   and leave the key server-only.
4. In the opening UI, explicitly enable **Use GPT-5.6 semantic mapping** and
   confirm the displayed data-sharing scope.
5. Submit `examples/exports/acme-crm-export-flawed.zip` through **Use my
   export** in the actual UI. Do not use the pre-mapped bundled button for this
   model smoke.
6. Confirm network/server evidence identifies `gpt-5.6-sol` and
   `store: false` without exposing the key or payload in logs.
7. Confirm the response is labeled live rather than fallback.
8. Validate all mapping references against the supplied manifest.
9. Resolve any bounded candidate, mark every row reviewed, and confirm the
   deterministic verdict matches the offline expected result.
10. Remove any local screenshots or logs that contain request data.

Status: **PASS on bounded synthetic evidence in the current worktree.** A
single-field request returned `mode: "live"` with model `gpt-5.6-sol`. The first
full 33-field request hit the shorter pre-adjustment timeout and safely returned
a labeled fallback. After setting the explicit timeout to 30 seconds, the repeat
completed live in about 21.0 seconds with 33 proposals, zero unresolved targets,
and no warning. The exact recorded/deployed build must still repeat this gate;
no live-public credential posture is claimed yet.

The production UI upload lane was also exercised through the isolated in-app
browser with `acme-crm-export-complete.zip`: the badge showed
`Live · gpt-5.6-sol`, all 33 mappings returned with zero unresolved targets,
verification remained locked until explicit human review, and the server then
returned `EXIT READY` with 9/9 checks and a 64-character digest.

## Manual product verification

### Flawed path

- Start the bundled flawed scenario.
- Confirm it is labeled as a bundled, pre-mapped fixture and makes no live-GPT
  claim.
- Confirm the product explains the import/export context before asking for a
  file.
- Confirm the pre-mapped rows show the source table and field for all 33
  canonical fields.
- Confirm the user must select **Mark all reviewed** (or review rows
  individually) before **Verify confirmed mapping** is enabled.
- Confirm the deterministic result is visible before supporting prose.
- Confirm every failure references an authoritative check.
- Confirm the result is not described as legal, universal, or tamper-proof.

### Real-upload mapping path

- Upload a checked-in synthetic ZIP through **Use my export**.
- Confirm the mode badge truthfully says live GPT-5.6 Sol or deterministic
  fallback.
- Confirm a complete 33-field proposal can be explicitly confirmed and sent to
  `/api/evaluate`.
- Confirm any unresolved target remains visible, offers only bounded unused
  source-field candidates, and disables verification until resolved.
- Confirm manual selection does not auto-confirm the row; every mapping still
  requires review.
- Exercise `NEEDS_REVIEW` through the evaluator contract test. The product UI
  resolves or blocks ambiguity before submitting to `/api/evaluate`.

### Simulated fix path

- Activate the demo fix action.
- Confirm the UI explicitly says it swaps to a bundled fixture.
- Confirm no copy implies that a repository, vendor account, or export was
  repaired.
- Confirm the complete fixture produces a new digest.
- Confirm the receipt displays its full disclaimer beside the digest: it is not
  a signature, trusted timestamp, or proof of origin.

### Responsive and accessibility path

Verify at minimum:

- desktop viewport around 1440 × 900;
- mobile viewport around 390 × 844;
- 200% browser zoom;
- keyboard-only navigation;
- visible focus rings;
- semantic heading order and control labels;
- sufficient contrast for verdicts and body text;
- `prefers-reduced-motion` behavior;
- no horizontal scrolling, clipped dialog content, or unreachable actions;
- no browser console errors or failed resource requests.

Use the Codex in-app browser or an isolated Playwright/browser session; do not
borrow another project's Chrome tab or development server.

## Security verification

```bash
git status --short
git grep -nE 'sk-[A-Za-z0-9_-]+' -- . ':!pnpm-lock.yaml'
git grep -n 'NEXT_PUBLIC_.*KEY\|OPENAI_API_KEY' -- . ':!.env.example'
pnpm audit:prod
```

Also inspect:

- browser client chunks for secret names or values;
- server logs for evidence values and model output;
- API response headers and content types;
- request-size, timeout, and output-size behavior;
- fallback labeling;
- dependency and license state.

Never paste a real secret into a report.

## Submission validation record

Complete this only after the final run.

```text
Source commit: TBD
Validation time (UTC): TBD
Node: TBD
pnpm: TBD

pnpm lint: TBD
pnpm typecheck: TBD
pnpm test: TBD
pnpm build: TBD
pnpm audit:prod: TBD
pnpm verify: TBD

Live GPT-5.6 Sol smoke: TBD
Flawed fixture verdict: TBD
Complete fixture verdict: TBD
Desktop browser QA: current production build PASS at 1440x900; no overflow
Mobile browser QA: current production build PASS at 390x844; 48px minimum CTA, no overflow
Console errors: 0 warnings / 0 errors after bundled and real-upload flows
Secret scan: TBD

Skipped checks: TBD
Residual risk accepted for submission: TBD
```
