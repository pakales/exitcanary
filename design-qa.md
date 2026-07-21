# ExitCanary photoreal machine design QA

## Evidence

- Source visual truth: `/Users/vigelis/Documents/Codex/BuildWeekVideoSystem/concepts/cgi/exitcanary/photoreal-keyframes/exitcanary-state-01-start.png`
- Source manifest: `/Users/vigelis/Documents/Codex/BuildWeekVideoSystem/concepts/cgi/exitcanary/photoreal-keyframes/KEYFRAME-MANIFEST.json`
- Source manifest SHA-256: `8d534e9b8327a87f5a6880817b8c3c4e2f647ec9ad78cd8cb7712fc3af3b14a9`
- Desktop browser screenshot, 1440x1000, `start`: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/desktop-1440x1000-start.png`
- Desktop full-page browser screenshot, `start`: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/desktop-1440-full-start.png`
- Desktop full-page browser screenshot, `blocked`: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/desktop-1440-full-blocked.png`
- Mobile browser screenshot, 390x844, `start`: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/mobile-390x844-start.png`
- Mobile full-page browser screenshot, `blocked`: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/mobile-390-full-blocked.png`
- Browser assertions: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/browser-checks.json`

The implementation was rendered in an isolated headless Chrome profile against
the local Next.js server. The in-app browser bridge was unavailable in this
agent and the shared Playwright profile was correctly left untouched because it
was owned by another workstream.

## Comparison evidence

- Full-view desktop comparison: source and implementation were normalized to
  the same 1358x763 machine-stage region.
- Side-by-side composite: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/desktop-source-vs-browser-composite.png`
- Focused machine-stage capture: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/desktop-1360x765-stage-start.png`
- Focused mobile-stage capture: `/Users/vigelis/Documents/Codex/2026-07-21/exitcanary-design-qa/mobile-366-stage-start.png`

The focused comparison was required because the full page makes the machine's
surface detail, crop, and title-to-subject separation too small to judge. The
small `N` control visible at the lower-left of dev captures is the Next.js
development toolbar, not product UI; the optimized production build does not
ship it.

## Browser interaction and console check

- Desktop: `Run 60-second demo` changed the machine from `start` to `review`;
  all 33 review confirmations rendered; `Mark all reviewed` enabled
  verification; `Verify confirmed mapping` returned `NOT EXIT-READY`, changed
  the machine to `blocked`, rendered nine evidence rows, and exposed the receipt
  digest.
- Mobile 390x844: the same flow passed; all 33 confirmations and all nine
  verdict evidence rows remained present; no evidence row was `display:none`.
- Responsive assets: desktop loaded the 1600px source; mobile selected
  `/exit-machine/start-820.webp` with natural width 820px.
- Layout: mobile page overflow was `0px`; no CTA, upload control, or EV1 link
  crossed the viewport edge. Desktop had no positive horizontal overflow.
- Console: no runtime exception or new application console error appeared in
  the final same-origin runs. The log collector retained one expected 403 from
  an earlier deliberate `127.0.0.1` origin probe; switching to the canonical
  local `localhost` origin produced HTTP 200 for both desktop and mobile
  `/api/evaluate` calls. This confirms the origin gate rather than a product
  failure.

## Required fidelity surfaces

### Fonts and typography

Passed. Existing Geist sans and mono families remain intact. The desktop title
uses the photograph's negative space without touching the machine; the mobile
title reflows above the image with no clipped line, control, or body copy.
Hierarchy remains clear across the display headline, status rail, progress,
control deck, and deterministic verdict.

### Spacing and layout rhythm

Passed. Desktop preserves the source 16:9 composition and black left field;
mobile deliberately changes hierarchy to copy, CTA, 4:3 machine crop, status,
progress, then controls. Header, stage, progress, control deck, and footer form
one continuous product surface. No detached marketing hero or duplicate visual
system remains.

### Colors and visual tokens

Passed. Canary yellow is confined to the synthetic capsule, key action,
headline emphasis, and active state. Ivory text and graphite surfaces match the
locked CGI palette. Ready, review, and blocked colors remain semantic status
accents outside the photograph and cannot modify the verdict.

### Image quality and asset fidelity

Passed. The browser shows the locked photoreal machine, not CSS/SVG mechanism
art. Seven manifest-backed states are delivered as discrete responsive WebP
pairs (1600x900 and 820x462). There is no crossfade, optical flow, radar, HUD,
orbit, corridor drawing, or data-token illustration. The exact official EV1
mark is used at SHA-256
`d1074b27463fb95e6ccfe07e1e7cba65528a08fe6e1af79919427bdd81b41032`.

### Copy and content

Passed. The first screen states the job in plain language and offers one primary
demo CTA. Machine status explicitly separates semantic mapping, human review,
deterministic evaluation, and verdict. Existing privacy, consent, simulation,
digest, and evidence disclosures remain visible in the flow.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Capture-only note: the Next.js development toolbar appears in local dev
  screenshots. `pnpm build` passed and production output does not include it.

## Iteration history

1. Pre-capture P1 — the page used a separate marketing hero plus a synthetic
   CSS corridor/gate/orbit system, so the selected photoreal source was not the
   working product. Fix: removed the legacy visual system and made one
   `ExitMachineStage` the first paint and state projection. Post-fix evidence:
   `desktop-source-vs-browser-composite.png`.
2. Pre-capture P2 — mobile CSS hid later decorative tokens and mapping
   confidence, weakening the evidence story. Fix: removed fake tokens entirely,
   kept mapping confidence in the mobile grid, expanded verdict evidence into
   readable wrapped rows, and verified zero hidden evidence rows. Post-fix
   evidence: `mobile-390-full-blocked.png` and `browser-checks.json`.
3. Capture check — the first automated probe intentionally used
   `127.0.0.1`, which the origin gate rejected. Fix: repeated the same browser
   flows at the canonical `localhost` origin. Both deterministic evaluate calls
   returned 200 and every expected state rendered. This was a QA-host mismatch,
   not an application defect.

## Implementation checklist

- [x] Locked photoreal image is first paint and remains the same physical machine.
- [x] `phase`, `busyStage`, and deterministic `result` select the visual state.
- [x] Animation never gates or creates product truth.
- [x] Official EV1 mark and one compact header collection link are present.
- [x] Desktop and 390x844 mobile layouts have browser evidence.
- [x] Primary demo, confirmation, evaluator, receipt, and evidence flow works.
- [x] No actionable P0/P1/P2 issue remains.
- [x] `CI=true pnpm verify` passed: 13 test files, 88 tests, public gates,
  optimized production build, and production dependency audit.

## Follow-up polish

No blocking follow-up. A production-host screenshot can replace the local-dev
captures after the separately approved deployment step; it would only remove
the development toolbar artifact.

final result: passed
