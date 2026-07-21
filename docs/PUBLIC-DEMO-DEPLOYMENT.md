# Public judge deployment

## Selected posture

The published Build Week judge deployment at
[https://exitcanary.vercel.app](https://exitcanary.vercel.app) is intentionally
**keyless and fallback-only**. This posture keeps the full parser, human
confirmation, deterministic evaluator, receipts, and bundled judge scenarios
available without putting a paid OpenAI credential on an anonymous endpoint.

The controlled synthetic-data smoke test remains evidence that the same source
build can call `gpt-5.6-sol`. The public URL must state honestly when it uses the
deterministic exact-alias fallback.

## Required production environment

Remove `OPENAI_API_KEY` from the deployment and set:

```text
EXITCANARY_LIVE_MAPPING_ENABLED=false
EXITCANARY_PUBLIC_ORIGIN=https://exitcanary.vercel.app
```

`EXITCANARY_PUBLIC_ORIGIN` must be the exact public HTTPS origin on a DNS
hostname, without a path, query, fragment, credentials, or literal IP address.
Do not pin a provider preview URL if judges will use a different canonical URL.

## Fail-closed preflight

Run this with the exact planned deployment environment before every public
release:

```bash
pnpm preflight:public-fallback
```

The command blocks when live mapping is not explicitly disabled, any OpenAI or
key-like public credential is populated, or the canonical public origin is not
a public HTTPS origin. It reports variable names and control results only; it
never prints secret values.

The preflight validates configuration. It does not deploy, inspect provider
settings, or prove that a deployed host received those settings.

## Post-deployment judge check

First run the bounded, credential-free black-box verifier against the exact
canonical origin:

```bash
pnpm smoke:public-judge -- https://exitcanary.vercel.app
```

It follows no redirects, sends no cookies, authorization, or API keys, caps
every response and ZIP entry before extraction, and uses only the public
synthetic canary. It checks the page security headers, canary pack, both judge
ZIP variants, the exact 33-target registry, effective fallback-only mapper
identity, foreign-origin rejection on mapping and evaluation, `EXIT_READY`,
`NOT_EXIT_READY`, and `NEEDS_REVIEW`, deterministic digest stability and
separation, and caller-verdict rejection. Any mismatch exits non-zero and
blocks publication.

The black-box verifier proves observable deployed behavior. It cannot prove the
provider's stored environment, actual file-picker experience, layout,
accessibility, console state, or public video playback; those remain separate
manual checks. The public video check is recorded below.

## Current publication record

- Public source: [github.com/pakales/exitcanary](https://github.com/pakales/exitcanary)
- Tested runtime source snapshot:
  `a178969062a631aa669dcdf664b9c05f4a297d28`
- Public judge URL:
  [https://exitcanary.vercel.app](https://exitcanary.vercel.app)
- Public black-box result: **PASS** for the bounded judge contract, including
  the observable fallback-only mapper identity.
- Public YouTube demo:
  [https://youtu.be/-x6M4nCIX3k](https://youtu.be/-x6M4nCIX3k) — signed-out
  1080p HD, unmuted audio, English (United States) captions, title, duration,
  crop, and public visibility verified.
- Public Build Week submission:
  [https://devpost.com/software/exitcanary](https://devpost.com/software/exitcanary)
  — **Submitted** and verified signed out with the correct demo, repository,
  video, gallery, and OpenAI Build Week association.
- Submitted Codex `/feedback` session ID:
  `019f813d-fdfb-7e93-8365-783b07ade86f`.

The Devpost submission and session ID were verified at the account boundary;
the source repository alone is not evidence of either fact.

In a signed-out, isolated browser session:

1. Open the canonical URL and confirm there is no login or payment wall.
2. Download both generated judge ZIP variants.
3. Upload a synthetic ZIP with GPT consent enabled and confirm the response is
   visibly labeled **Deterministic fallback**, never live GPT.
4. Run the bundled flawed scenario and confirm `NOT_EXIT_READY` with six failed
   and three passed checks.
5. Apply the visibly disclosed simulated fixture swap and confirm `EXIT_READY`
   with nine passed checks and a different digest.
6. Confirm desktop and mobile layouts, keyboard operation, reduced motion, and
   a clean console.
7. Verify HSTS, CSP, frame denial, same-origin resource/opener policy, and
   `Origin-Agent-Cluster` on the deployed response.
8. Re-run `pnpm preflight:public-fallback` against the provider's effective
   production environment without printing its values.

If a provider cannot prove that the key is absent and the kill switch is
`false`, do not expose the URL.

## Live GPT promotion gate

Do not change the public deployment to live GPT merely by adding an API key.
Live public mapping requires persistent identity or a deliberately approved
anonymous policy, durable quota, abuse monitoring, content-safe operational
logging, and a tested emergency kill switch. The current process-local limiter
is a demo guardrail only.
