# Exit machine visual asset contract

The web product uses the same locked photoreal ExitCanary machine as the demo
film. These images are a presentation layer only. They may reflect the current
application phase, but they never create, delay, upgrade, or downgrade the
deterministic verdict.

## Source lock

- Source set: `BuildWeekVideoSystem/concepts/cgi/exitcanary/photoreal-keyframes`
- Ten-state manifest SHA-256: `8d534e9b8327a87f5a6880817b8c3c4e2f647ec9ad78cd8cb7712fc3af3b14a9`
- Official EV1 mark SHA-256: `d1074b27463fb95e6ccfe07e1e7cba65528a08fe6e1af79919427bdd81b41032`

Only manifest-backed source files are allowed. The superseded non-`v2` iris,
inserting, received, and closed images must not be used.

| UI state | Locked source | Source SHA-256 |
| --- | --- | --- |
| `start` | `exitcanary-state-01-start.png` | `1483fccac89895b1a580307443a79d366da3b9808006bab83cf265b03fdf7d9d` |
| `mapping` | `exitcanary-state-02-lift-mid.png` | `eef34ddc740fc6d9d05610d2e0466cbdd15d83415960381ac0af4b06ef6c7452` |
| `review` | `exitcanary-state-03-iris-aligned-v2.png` | `b3df2642e9bc64b7283ab082c1560d92a0cdf3d30858c969c32fbd9b4f16f97c` |
| `evaluating` | `exitcanary-state-04-inserting-v2.png` | `25098b8dfb6a45d98f657ff2f1b56fdafaf514d1ae75e24a1b3b4c80b4c048a1` |
| `ready` | `exitcanary-state-05a-retracted-open.png` | `5ef8b0d01e5992fdb3ea7e166109ae44861e8c8a1380ac91ba2932419792da3f` |
| `needs-review` | `exitcanary-state-05b-iris-half-closed.png` | `ab6fc5f9bac75fc6b095e69ffb4feeb00206afd58dd7424362eb1556eb8b0d2a` |
| `blocked` | `exitcanary-state-06-closed-v2.png` | `80ccb3abffab7923953994efea3bede3513aa51720d9069e204abb627c858d19` |

## Delivery contract

Each source is pre-optimized as a 1600x900 desktop WebP and an 820x462 mobile
WebP under `public/exit-machine/`. The initial `start` frame is eager/high
priority; subsequent states load on demand. State changes are discrete: no
crossfade, optical-flow interpolation, radar, HUD, or synthetic gate layer.

Desktop copy may occupy the photograph's black left negative space. On mobile,
copy appears above a 4:3 crop of the machine, followed by status and the full
control/evidence deck. Authoritative result text always remains outside the
photograph and readable without animation.

