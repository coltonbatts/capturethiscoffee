# Frozen web dependency risk record

Prepared: 2026-07-27
System: frozen Next.js web fallback
Decision status: **owner/security acceptance still required**
Next review: 2026-08-03, or immediately when a stable Next.js release changes
the bundled `postcss`/`sharp` versions

## Current result

`npm audit --omit=dev` reports three high-severity dependency findings and exits
nonzero:

| Path | Installed | Affected | Finding |
|---|---:|---:|---|
| `next > postcss` | `8.4.31` | `<=8.5.17` | Unescaped style output, attacker-controlled source-map file read, and source-map path traversal (`GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`) |
| `next > sharp` | `0.34.5` | `<0.35.0` | inherited libvips vulnerabilities (`GHSA-f88m-g3jw-g9cj`) |
| `next` | `16.2.11` | transitive | aggregate of the two paths above |

The audit tool suggests `next@9.3.3`. That is a destructive framework downgrade
and is not an acceptable fix. `npm audit fix --force` must not be run.

## Upstream-fix investigation

Checked against the npm registry on 2026-07-27 and rechecked on 2026-07-28:

- latest stable Next.js: `16.2.12`;
- stable Next.js still bundles `postcss 8.4.31` and declares optional
  `sharp ^0.34.5`;
- latest canary checked: `16.3.0-canary.97`;
- that canary uses `postcss 8.5.10`, which is still affected by the newest
  `<=8.5.17` source-map advisory, and `sharp ^0.35.3`.

PostCSS `8.5.18` is the upstream-patched release for the newest source-map
finding. Sharp `0.35.0` is the first nonaffected line in the current advisory.
There is no stable supported Next.js release that brings both fixed dependency
lines as of this review. An npm override would replace Next's private dependency
contract; overriding Sharp crosses its `0.x` minor boundary and is not treated
as a safe release fix without Next.js support and full web regression.

Primary references:

- Next.js July 2026 security release:
  <https://nextjs.org/blog>
- PostCSS `8.5.18`:
  <https://github.com/postcss/postcss/releases/tag/8.5.18>
- PostCSS path-traversal advisory:
  <https://github.com/advisories/GHSA-r28c-9q8g-f849>
- Sharp/libvips advisory:
  <https://github.com/advisories/GHSA-f88m-g3jw-g9cj>

## Reachability

### PostCSS

PostCSS is used during the trusted application build. No deployed route accepts
or compiles user-supplied CSS, source maps, project paths, or source files.
The production app serves compiled assets. This makes the reported runtime
network attack path low-reachability for Capture This.

The remaining risk is in the build environment: a malicious repository change,
dependency, or untrusted CSS/source-map artifact could be processed with access
to files visible to that build worker. Repository and deployment access
therefore remain material controls.

### Sharp

The only `next/image` call site is the checked-in local Capture This smiley. Crew
photos use ordinary `<img>` elements and do not pass through Next image
optimization. `next.config.ts` nevertheless allows HTTPS images from
`images.unsplash.com`, so the optimizer route is not characterized as
unreachable. The allowed host is narrow and no Capture This feature lets an
operator upload an arbitrary image into `next/image`, but server-side image
decoding is still an exposed framework surface.

The app's top-level `sharp` is `0.35.3`; the audit is for Next's nested optional
`0.34.5`, so the top-level package does not erase the finding.

## Compensating controls

- The web product is frozen: no feature expansion or new media ingestion in
  this release.
- Build inputs are the reviewed repository and locked dependencies; do not build
  untrusted branches or accept user-supplied CSS/source maps.
- GitHub, deployment, and production-environment access must remain
  least-privilege with individual accounts.
- The application has no route that compiles uploaded CSS and no arbitrary
  image-upload path feeding `next/image`.
- The local brand image is the only current optimized image call site.
- Supabase authentication/RLS and token-scoped fallbacks remain independent
  authorization boundaries; do not expose service-role credentials.
- Preserve sanitized server errors and hosting isolation; review Vercel runtime
  logs for abnormal image-optimizer or build activity.
- Monitor every stable Next.js security/patch release and rerun the complete web
  suite plus `npm audit --omit=dev` before upgrading.

These controls reduce reachability; they do not claim the vulnerable packages
are patched.

## Proposed temporary disposition

For the iOS external pilot, keep the currently deployed frozen web fallback
unchanged and accept the dependency finding temporarily only if the named risk
owner approves this record. Do not deploy the privacy/support source edits or a
dependency change merely to silence the audit. Upgrade to the first supported
stable Next.js release whose installed dependency graph clears these findings,
then run the full web and fallback verification suite before deployment.

| Decision item | Owner-supplied value |
|---|---|
| Risk owner | _____ |
| Accept through date | _____ (proposed no later than 2026-08-10) |
| Upgrade engineer | _____ |
| Deployment approver | _____ |
| Monitoring owner | _____ |
| Final decision: accept / block / mitigate differently | _____ |

If no owner accepts the residual risk, the permanent App Store release is
blocked on an approved mitigation or compatible upstream release. The iOS
binary itself does not bundle Next.js, PostCSS, or Sharp.
