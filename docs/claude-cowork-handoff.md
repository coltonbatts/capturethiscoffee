# Claude Co-Work handoff

## Goal

Come into this as a fresh product-minded dev and tighten the app around the story we actually want to show the client.

The clean story is:

- Capture This Coffee is a runner-first shoot-day workflow.
- The primary path is: sign in, open a production, confirm drinks fast, print labels when needed, and track delivery.
- The client should not feel like he is entering an internal ops tool, printer lab, or demo sandbox.

## Current diagnosis

The repo is not mainly suffering from visual/design issues. The larger problem is surface sprawl and product-story mismatch.

Right now the app is trying to be all of these at once:

- Runner workflow
- Client/contact CRM
- Production setup/admin tool
- Label workstation
- Remote print-station console
- Printer experiment/calibration environment
- Demo/local-data sandbox

That makes the presentation to the client fuzzy.

## Main findings

### 1. Auth and role logic conflict with the docs

Docs currently say any signed-in Supabase user can use the app and the client does not need staff/admin metadata.

Relevant docs:

- [docs/client-login-handoff.md](/Users/coltonbatts/Desktop/CaptureThisCoffee/docs/client-login-handoff.md)
- [docs/v1-readiness.md](/Users/coltonbatts/Desktop/CaptureThisCoffee/docs/v1-readiness.md)

But the code still treats several important surfaces as admin-only.

Relevant code:

- [src/proxy.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/proxy.ts)
- [src/lib/auth.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/lib/auth.ts)
- [src/app/productions/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/productions/page.tsx)
- [src/app/productions/[id]/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/productions/%5Bid%5D/page.tsx)

Specific mismatch:

- Proxy blocks `/people`, `/clients`, `/labels`, and `/productions/new` for non-admin users.
- Admin is derived from `app_metadata`.
- Production creation and several setup/edit actions are hidden behind `isAdmin`.
- Docs say the client should be able to create productions and use the app as a normal authenticated user.

This is the first thing to resolve. Decide which is true:

1. The client is meant to be a normal signed-in user.
2. The client is meant to be a privileged/admin user.

Then make docs, middleware, and UI all say the same thing.

### 2. Core runner actions are now coupled to service-role-backed label queue reconciliation

This is a bigger issue than it looks.

Order updates call `ensureLabelQueueForOrder()`, which hits an API route that uses a trusted server context requiring `SUPABASE_SERVICE_ROLE_KEY`.

Relevant code:

- [src/lib/data.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/lib/data.ts)
- [src/app/api/orders/[id]/label-queue/route.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/api/orders/%5Bid%5D/label-queue/route.ts)
- [src/lib/supabase-server.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/lib/supabase-server.ts)

Important local env observation from this review:

- `NEXT_PUBLIC_ENABLE_AUTH` is set
- `NEXT_PUBLIC_SUPABASE_URL` is set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- `SUPABASE_SERVICE_ROLE_KEY` is currently unset

That means a fresh dev should assume:

- Sign-in may work
- Basic reads may work
- But parts of the runner flow can fail because label queue sync is now part of normal order save/update behavior

This needs a product decision:

- If label queueing is optional, order edits should not fail because queue reconciliation is unavailable.
- If label queueing is required, the deployment/setup story must explicitly require service-role-backed server support.

### 3. Demo-mode behavior is leaking into product surfaces

The label workstation page still exposes demo reset behavior directly in the surface.

Relevant code:

- [src/app/labels/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/labels/page.tsx)
- [src/lib/data.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/lib/data.ts)

This is especially risky because:

- It makes the app feel like a sandbox
- It undermines trust in persistence
- It is exactly the kind of thing a demo audience notices even if they do not fully understand it

If the client is the audience, demo-reset affordances should not appear in client-facing flows.

### 4. Label-related surfaces are over-expanded

Labels exist in too many places:

- Top-level nav `/labels`
- `Labels` tab inside the production dashboard
- Print controls in the `Summary` tab
- `/labels/station` remote station

Relevant code:

- [src/components/app-shell.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/components/app-shell.tsx)
- [src/app/productions/[id]/components.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/productions/%5Bid%5D/components.tsx)
- [src/app/labels/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/labels/page.tsx)
- [src/app/labels/station/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/labels/station/page.tsx)

Fresh-eyes product take:

- `/labels/station` makes sense as a separate station/operator surface
- The main app probably should not elevate labels to the same level as jobs/people/clients unless printing is the primary product
- The runner dashboard already has enough complexity

### 5. The production dashboard is powerful, but broad

Current tabs:

- People
- Groups
- Drinks
- Status
- Summary
- Labels

Relevant code:

- [src/app/productions/[id]/components.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/productions/%5Bid%5D/components.tsx)

This feels more like a full internal command center than a sharply scoped runner tool.

That may be fine long-term, but for the client presentation it dilutes the story.

## Recommended product stance

If optimizing for the client, center the product around:

- `/productions`
- `/productions/[id]`

Everything else should be treated as one of:

- Admin/setup-only
- Secondary/back-office
- Printer-operator-only
- Hidden from the main demo path

## Recommended order of attack

### Phase 1: Align the story

Make explicit decisions on:

1. Is the client a normal authenticated user or an admin?
2. Is printing a support feature inside the runner flow, or a separate workstation product?
3. Is `/labels` meant for the client, staff, or only the printer operator?
4. What is the single demo path we want the client to remember?

### Phase 2: Remove contradictions

Fix the mismatch between:

- docs
- middleware
- auth helpers
- UI gating

Likely files:

- [src/proxy.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/proxy.ts)
- [src/lib/auth.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/lib/auth.ts)
- [src/app/productions/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/productions/page.tsx)
- [src/app/productions/[id]/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/productions/%5Bid%5D/page.tsx)
- [docs/client-login-handoff.md](/Users/coltonbatts/Desktop/CaptureThisCoffee/docs/client-login-handoff.md)
- [docs/v1-readiness.md](/Users/coltonbatts/Desktop/CaptureThisCoffee/docs/v1-readiness.md)

### Phase 3: Decouple runner flow from printer infrastructure where possible

Review whether these should be hard dependencies for normal runner behavior:

- trusted label queue reconciliation
- service role env requirements
- remote station availability

Likely files:

- [src/lib/data.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/lib/data.ts)
- [src/lib/supabase-server.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/lib/supabase-server.ts)
- [src/app/api/orders/[id]/label-queue/route.ts](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/api/orders/%5Bid%5D/label-queue/route.ts)

### Phase 4: Simplify client-facing surfaces

Candidates:

- hide/remove top-level `Labels` nav for client-facing demo
- keep label actions inside the production context
- keep `/labels/station` as an operator surface only
- remove demo-reset and experimental printer controls from the main presentation path

Likely files:

- [src/components/app-shell.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/components/app-shell.tsx)
- [src/app/productions/[id]/components.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/productions/%5Bid%5D/components.tsx)
- [src/app/labels/page.tsx](/Users/coltonbatts/Desktop/CaptureThisCoffee/src/app/labels/page.tsx)

## Suggested demo path

If the goal is “show the client something coherent,” the path should probably be:

1. Sign in
2. Open Productions
3. Open active production
4. Search/select a person
5. Confirm or edit drink
6. Mark ordered
7. Optionally print a label
8. Mark picked up
9. Mark delivered
10. Show summary if needed

That is a strong story.

This is a weaker story:

- create clients
- create people
- manage rosters
- discuss BLE checks
- explain browser print vs queue vs USB serial
- explain station mode

That second path may be operationally true, but it is not the right first impression.

## Repo verification already done

From this review:

- `npm run lint` passed
- `npm run build` passed
- local dev server started successfully

## Bottom line for Co-Work

Treat this as a product-boundary cleanup, not just a UI cleanup.

The key question is not “does every feature exist?”

The key question is:

"What should the client believe this product is after 3 minutes?"

Right now the answer is muddled. The next pass should make that answer obvious.
