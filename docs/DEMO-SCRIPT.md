# 80–90 second demo script

Target runtime: **about 88 seconds**. Keep the final public video under three
minutes as required by Build Week. Narration must audibly explain the distinct
roles of Codex and GPT-5.6.

## Truth gate before recording

Use the preferred script only after the live synthetic-data smoke test passes
on the exact recorded build. The first upload must show the **Live ·
gpt-5.6-sol** badge and a complete proposal; never narrate fallback or bundled
mode as a live model response. If the live path is not verified, omit that
interaction, use the bundled-only backup below, and describe GPT's implemented
role without claiming it ran in the recording.

Pre-final status: the current worktree passed a bounded 33-field live smoke in
about 21.0 seconds with 33 proposals and zero unresolved targets under the
30-second timeout. Re-run it on the exact deployed/recorded build before using
the live narration.

The bundled scenario is deliberately different from the live upload path. It
uses a disclosed, versioned, pre-mapped fixture so judges can reproduce the
deterministic verdict without a model call. It starts with zero confirmed rows;
the presenter still reviews and confirms the map.

## Recording setup

- Use only the checked-in synthetic ZIPs or bundled synthetic fixtures.
- Equivalent generated judge ZIPs are also downloadable from
  `/api/demo-export?variant=flawed` and `?variant=complete` on the running app.
- Hide API keys, account identifiers, browser extensions, unrelated tabs, and
  notifications.
- Use only original or properly licensed visual/audio material. Do not add
  unlicensed music, footage, or third-party marks.
- Record the final deployed or locally verified build at readable zoom.
- Keep the cursor still while speaking; use deliberate clicks.
- Verify narration, focus, crop, and text-safe margins before uploading.

## Preferred shot list and narration

### 0–8 seconds — the procurement blind spot

**Screen:** ExitCanary opening view and exit-door visual.

> Teams test how data enters a SaaS product. Exit quality may stay untested
> until leaving is already urgent.

### 8–18 seconds — the known canary

**Screen:** Select **Download canary pack**; briefly show the bounded object
list.

> ExitCanary starts with a synthetic CRM business: records, relationships,
> history, Unicode, custom fields, and an attachment. Adapt it to the vendor's
> import format, then request the vendor's full export.

### 18–34 seconds — GPT-5.6 Sol's bounded role

**Screen:** Enable **Use GPT-5.6 semantic mapping**, show its consent text,
choose **Use my export**, upload the verified synthetic judge ZIP, then show the
live badge and mapping list. If a target is unresolved, choose only one of its
bounded candidates.

> With my consent, GPT-5.6 Sol maps unfamiliar export fields back to 33 known
> canary fields and cites supplied evidence. I can resolve only from bounded
> candidates, and every row still needs my confirmation. The model never
> decides the verdict.

### 34–43 seconds — repeatable judge scenario

**Screen:** Select **Reject & start over**, then **Run pre-mapped flawed demo**.
Hold on the pre-mapped disclosure and empty confirmation count.

> For a repeatable judge path, this bundled flawed fixture uses a disclosed,
> pre-mapped field set — no model call is claimed here, and nothing is confirmed
> until I review it.

### 43–58 seconds — deterministic truth

**Screen:** Select **Mark all reviewed**, then **Verify confirmed mapping**;
show `NOT_EXIT_READY` and the six failed checks.

> Server-side deterministic code finds six exact losses: Unicode, a relation,
> an activity timestamp, history, a custom field, and the attachment checksum.
> It refuses an exit-ready verdict.

### 58–70 seconds — disclosed simulation

**Screen:** Show the simulation note, then select **Apply fixed demo export**.

> This is explicitly simulated. It swaps in the bundled complete fixture and
> re-evaluates; it does not repair a vendor account or repository.

### 70–88 seconds — bounded proof and close

**Screen:** Show `EXIT_READY`, nine passes, changed digest, and the visible
receipt disclaimer.

> Now all nine bounded checks pass and a new digest detects changed receipt
> inputs. It is not a signature or proof of origin. Codex built and red-teamed
> the product; GPT-5.6 handles only semantic mapping. Before you enter, prove
> you can leave.

## Bundled-only backup

If the live model path is not verified, begin the product interaction at the
34-second shot and use this replacement sentence while the opening view shows
**Use my export**:

> Real uploads use GPT-5.6 Sol for evidence-referenced semantic mapping, with a
> clear consent gate and labeled exact-alias fallback. This recording uses the
> separate pre-mapped fixture so the verdict is reproducible without a paid
> model call; I still confirm every mapping.

Do not display a fallback badge while saying GPT ran. Keep the remainder of the
script unchanged and target 70–80 seconds.

## On-screen truth checklist

- [ ] Final UI labels match the narration exactly.
- [ ] Live, fallback, and bundled states are never conflated.
- [ ] The spoken six failures match the actual check results.
- [ ] The simulated fixture-swap disclosure is readable before the click.
- [ ] The complete fixture is actually re-evaluated.
- [ ] The full digest visibly changes.
- [ ] The digest disclaimer is legible beside the receipt.
- [ ] No “first,” “only,” “universal,” “tamper-proof,” or compliance guarantee.
- [ ] No real customer data, secret, private ID, or unrelated project is visible.
- [ ] Public YouTube visibility, audio, resolution, crop, and runtime are
  verified while logged out.

## Optional 15-second backup close

Use only if the core demo is comfortably below 90 seconds:

> ExitCanary does not replace migration testing or contract review. It gives
> operations and procurement a repeatable technical drill while they still
> have leverage — before an annual commitment or renewal.
