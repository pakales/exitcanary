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
pnpm test:public-preflight
pnpm test:public-smoke
pnpm build
pnpm audit:prod
```

The root build session ran the full gate against the current release candidate:
**`pnpm verify` passed** on 2026-07-21 UTC, including lint, typecheck, 12 Vitest
files / 86 tests, five independent public-preflight tests, seven independent
public-smoke tests, the production build, and a production dependency audit
with no known vulnerabilities. Tool versions were Node `v22.22.2` and pnpm
`10.33.2`. The exact committed SHA and final repeat time are recorded in the
operator handoff after the clean-commit rerun.

This commit adds fail-closed live-model activation, a keyless fallback-only
public deployment preflight, checked-in ZIP → fallback → human-confirmed
evaluation coverage, and adversarial parser/API regressions. Public URL,
provider configuration, and signed-out judge checks remain separate gates.

## Deterministic test matrix

| Case | Required assertion | Status |
| --- | --- | --- |
| Complete checked-in ZIP | Parser → normalizer → evaluator produces nine passes and `EXIT_READY` | PASS — `end-to-end-artifacts.test.ts` |
| Flawed checked-in ZIP | Parser → normalizer → evaluator produces six failures and `NOT_EXIT_READY` | PASS — `end-to-end-artifacts.test.ts` |
| Complete bundled export | Server API returns every required check as pass and verdict `EXIT_READY` | Production browser PASS: 9 pass / 0 fail, 64-char digest |
| Flawed bundled export | Server API returns six authoritative failures and `NOT_EXIT_READY` | Production browser PASS: 6 fail / 3 pass, 64-char digest |
| Ambiguous required mapping | Verdict is `NEEDS_REVIEW`; never a pass | PASS — missing, unconfirmed, and ambiguous evaluator cases |
| Missing required record | Stable failing check ID and `NOT_EXIT_READY` | PASS — missing-company evaluator case |
| Broken relationship | Parent/foreign-key check fails | PASS — flawed fixture asserts `relations.integrity` |
| Damaged Unicode | Value-integrity check fails | PASS — flawed fixture asserts `contacts.unicode` |
| Missing custom field | Custom-field check fails | PASS — flawed fixture asserts `custom_fields.value` |
| Missing history | History check fails | PASS — flawed fixture asserts `activities.history` |
| Missing or changed attachment evidence | Attachment check fails | PASS — flawed fixture plus missing-binary normalization case |
| Packet changes | Receipt digest changes | PASS — evaluator digest regression |
| Confirmed mapping changes | Receipt digest changes | PASS — evaluator digest regression |
| Property/key order changes only | Stable serialization is identical for canonical equivalents | PASS — property-order regression |
| Client attempts to redefine checks | Strict schema rejects the packet | PASS — client check-registry injection regression |
| Mapping target bridge | Produces exactly 33 fields and preserves parser-valid 360-character paths | PASS — mapping-target adapter regressions |
| Unknown model canonical ID | Model response rejected | PASS — model target regression |
| Invented model evidence path | Model response rejected | PASS — model evidence regression |
| Model attempts verdict output | Strict model schema rejects it; evaluator authority is unchanged | PASS — model verdict and evaluator injection regressions |
| Model attempts free-form prose | Strict model proposal has no rationale/summary fields; application builds displayed explanation | PASS — prose-free model schema and mapper-boundary regressions |
| Mapper mode/model contradiction | `live` requires exact model; `fallback` requires null model and warning | PASS — discriminated-response regression |
| Contradictory confirmation state | Confirmed mappings cannot retain ambiguity candidates or partial source evidence | PASS — field-mapping union regression |
| Model unavailable or disabled | Transparent fallback; no fabricated live output or false pass | PASS — mapper, route, and judge-posture regressions |

## Parser and request-boundary matrix

| Case | Required behavior | Status |
| --- | --- | --- |
| Valid bounded CSV | Formula-looking cells remain inert strings; no silent coercion | PASS — parser CSV regression |
| Valid bounded JSON | Parsed within depth and value limits | PASS — parser JSON regression |
| Valid bounded ZIP | Only supported safe entries are considered | PASS — parser ZIP regression |
| Unsupported file type | Explicit rejection | PASS — parser format regression |
| Oversized upload or mapping request | Rejected before parsing/model call | PASS — upload and route byte-limit regressions |
| Excess ZIP entries/decompressed bytes | Rejected before unsafe extraction | PASS — entry-count and declared-expansion regressions |
| High-ratio ZIP with declared expansion above budget | Rejected before entry inflation | PASS — compressed-bomb regression |
| `../`, absolute, or drive archive path | Rejected | PASS — three unsafe-path cases |
| Duplicate normalized archive path | Rejected | PASS — normalized-path collision regression |
| Duplicate CSV header | Rejected instead of silently renamed | PASS — duplicate-header regression |
| Invalid UTF-8 | Explicit parse error | PASS — direct parser and API regressions |
| More than 500 rows/100 columns/2,000 characters per cell | Explicit bounded parse error | PASS — table-limit regressions |
| JSON deeper than 10 or above 25,000 nodes | Explicit bounded parse error | PASS — JSON-complexity regressions |
| Attachment in ZIP | Local SHA-256 and byte length recorded | PASS — safe ZIP and canary-pack regressions |
| Malformed CSV/JSON | Explicit parse error, never empty success | PASS — malformed-input regressions |
| Wrong content type | API rejects request | PASS — map/evaluate route regressions |
| Wrong origin | API rejects request and ignores spoofed forwarding headers | PASS locally; deployed canonical-origin check remains public gate |
| Extra schema keys | Strict request and model-output validation rejects them | PASS — request, verdict, and model-output regressions |
| Body over 256 KiB, with or without `Content-Length` | API returns `413` before model call | PASS — advertised and streamed body regressions |
| Invalid UTF-8 or JSON | API returns sanitized `400` error | PASS — map/evaluate route regressions |
| More than 240 sources | Strict request rejection | PASS — source-count regression |
| Any caller-supplied `targets` field | Strict request rejection; route injects exactly 33 application targets | PASS — route and registry regressions |
| Live flag false or absent | Returns labeled fallback without invoking OpenAI, even if a key is inherited | PASS — fail-closed mapper regressions |
| Parser cell/path near its maximum | Adapter preserves bounded samples and source paths through confirmation | PASS — parser and long-path bridge regressions |
| One canonical entity split across source tables | Normalizer returns `split_entity`; evaluation is not called | Targeted regression PASS |
| Rate limit exceeded | API returns `429`, rate headers, and `Retry-After` | PASS — route regression |
| Mapping dependency throws unexpectedly | API returns sanitized `503` | PASS — route regression |
| `/api/evaluate` body over 512 KiB | API returns `413` before evaluation | PASS — advertised and streamed body regressions |
| `/api/evaluate` wrong type/origin/schema | API rejects with sanitized error | PASS — evaluation-route regressions |
| Client injects verdict into evaluation request or packet | Strict schema rejects before evaluator runs | PASS — route and evaluator regressions |
| Valid complete evaluation request | Server returns uncached `EXIT_READY` receipt with full digest | PASS — evaluation-route regression |
| Canary-pack JSON drift | Checked-in public JSON equals the application-owned profile | PASS — canary-pack regression |
| `GET /api/canary-pack` | ZIP has all expected tables, manifest, and exact attachment bytes | PASS — canary-pack regression |
| `GET /api/demo-export?variant=complete` | Generated ZIP traverses parser → normalizer → evaluator and reaches `EXIT_READY` | PASS — demo-export regression |
| `GET /api/demo-export?variant=flawed` | Generated ZIP traverses the same path and fails exactly six checks | PASS — demo-export regression |
| Invalid demo-export variant | Returns sanitized `400` JSON | PASS — demo-export regression |
| Configured production origin | Exact origin accepted; mismatched/malformed origin rejected; forwarded headers ignored | PASS locally; deployed-origin rerun remains public gate |
| Production security headers | HSTS, CSP, frame denial, same-origin resource/opener, and origin-agent headers present | PASS on local production server; deployed-origin rerun remains public gate |

## Public judge black-box verifier

The post-deployment verifier is deliberately separate from environment
preflight:

```bash
pnpm smoke:public-judge -- https://the-canonical-public-host.example
```

Its Node test suite injects bounded responses and proves fail-closed handling of
invalid/private origins, missing security headers, live or verdict-bearing
mapper responses, ZIP and API contracts, deterministic verdicts, and changed
digests. After deployment, the same CLI checks the real canonical host without
cookies, authorization, credentials, redirects, retries, or non-synthetic data.
It does not replace the signed-out browser/file-picker/accessibility/video pass
or provider-side environment inspection.

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

Status: **PASS on controlled bounded synthetic evidence.** The current
prose-free structured-output contract returned `mode: "live"`, exact model
`gpt-5.6-sol`, 33 proposals, zero unresolved targets, no warning, and no verdict
field. The API response contained only application-owned mapping explanation.
The explicit timeout remains 30 seconds and the server still requires the live
flag to equal `true`. The selected public judge deployment is keyless and
fallback-only, so no live public credential posture is claimed.

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

Current local production-browser result on the release candidate:

- desktop 1440 × 900: PASS, no horizontal overflow, no error overlay, zero
  warning/error logs;
- mobile 390 × 844: PASS, no clipped controls or horizontal overflow, 48 px
  minimum button height;
- 200% equivalent reflow at 720 × 450: PASS, no clipped controls or horizontal
  overflow;
- `prefers-reduced-motion: reduce`: PASS, no meaningful transition or animation
  above one millisecond;
- keyboard tab order and Space activation: PASS in `ui-flow.test.tsx`;
- bundled flawed → complete flow: PASS, exact six-failure/9-pass summaries,
  visible simulated-fixture disclosure, zero console warnings/errors, and
  different 64-character digests.
- actual checked-in complete ZIP via the real file input: PASS in keyless
  production mode; parser completed, fallback was visibly labeled, all 33 rows
  rendered, 18 were proposed, 15 remained unresolved, and verification stayed
  disabled until bounded human assignment;
- accessibility labels: PASS, 33 unique `Reviewed <canonical field>` names;
- console/network: PASS, zero warnings, errors, failed requests, or HTTP 4xx/5xx
  responses across the tested local flows.

The deployed signed-out upload remains a public-host gate even though the exact
local production file-input path is now exercised.

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

This record covers the final local product gate. Public provider and account
checks are recorded separately after publication.

```text
Source product commit: final release HEAD (resolve with `git rev-parse HEAD` in the operator handoff)
Validation date (UTC): 2026-07-21
Node: v22.22.2
pnpm: 10.33.2

pnpm lint: PASS via pnpm verify
pnpm typecheck: PASS via pnpm verify
pnpm test: PASS - 12 Vitest files, 86 tests
pnpm test:public-preflight: PASS - 5 tests
pnpm test:public-smoke: PASS - 7 tests
pnpm build: PASS - production routes generated
pnpm audit:prod: PASS - no known vulnerabilities
pnpm verify: PASS

Live GPT-5.6 Sol smoke: PASS - prose-free model contract, exact model, 33 proposals, 0 unresolved, no verdict
Flawed fixture verdict: PASS - NOT_EXIT_READY, 6 fail / 3 pass
Complete fixture verdict: PASS - EXIT_READY, 9 pass / 0 fail
Desktop browser QA: PASS at 1440x900; no overflow
Mobile browser QA: PASS at 390x844; 48px minimum CTA, no overflow
200% equivalent reflow: PASS at 720x450; no overflow or clipped controls
Reduced motion: PASS - no meaningful transition/animation above 1ms
Keyboard flow: PASS - tab order and Space activation regression
Actual keyless file input: PASS - fallback labeled, 18 mapped / 15 unresolved, verification locked
Console/network: PASS - 0 warnings, 0 errors, 0 failed requests, 0 HTTP 4xx/5xx
Secret scan: PASS - ignored .env.local; no key-shaped value in tracked source
Fallback-only API smoke: PASS - mode fallback, model null, no verdict, live disabled
Public fallback preflight: PASS with synthetic canonical HTTPS environment
Local production black-box smoke: PASS - headers, bounded ZIPs, exact target registry, both origin gates, three verdict states, digest checks

Local demo video: PASS - 93.000s, 1920x1080 H.264/yuv420p/30fps,
AAC 48kHz stereo, -16.01 LUFS, -4.50 dBTP, 0 decode errors, no trimmed speech
Captions: PASS - 25 cues, max 2 lines, exact locked narration, final cue at 93.000s
Video SHA-256: 5c354bea113fbf59269b9f4c1365a55efa89e308b30df9dbb466f94f4e180204
Video privacy/claims audit: PASS - synthetic data only; live/bundled/simulated
states separated; AI voice disclosed; no secret or account identifier found

Skipped checks: deployed public URL, effective provider environment, signed-out
judge upload, and public-video playback remain submission gates.
Residual risk accepted for submission: receipt binds self-supplied normalized
evidence rather than attesting vendor origin. The public judge posture therefore
ships no API key and disables live mapping; process-local model rate limiting is
not sufficient for a public paid endpoint.
```
