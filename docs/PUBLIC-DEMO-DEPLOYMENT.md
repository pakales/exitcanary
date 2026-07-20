# Public judge deployment

## Selected posture

The Build Week judge deployment is **fallback-only** unless a durable public
identity and quota layer is added and separately verified. This posture keeps
the full parser, human confirmation, deterministic evaluator, receipts, and
bundled judge scenarios available without putting a paid OpenAI credential on
an anonymous endpoint.

The controlled synthetic-data smoke test remains evidence that the same source
build can call `gpt-5.6-sol`. The public URL must state honestly when it uses the
deterministic exact-alias fallback.

## Required production environment

Remove `OPENAI_API_KEY` from the deployment and set:

```text
EXITCANARY_LIVE_MAPPING_ENABLED=false
EXITCANARY_PUBLIC_ORIGIN=https://the-canonical-public-host.example
```

`EXITCANARY_PUBLIC_ORIGIN` must be the exact public HTTPS origin, without a
path, query, fragment, credentials, or local/private address. Do not pin a
provider preview URL if judges will use a different canonical URL.

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
