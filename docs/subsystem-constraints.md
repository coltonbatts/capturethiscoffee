# Subsystem constraints

Task-specific reference for rules that are easy to lose during maintenance.
Start with [AGENTS.md](../AGENTS.md); use the [index](README.md) for status evidence.
These are design and security constraints, not claims about a deployed build.

## Mobile interface and labels

For UI tasks, use the existing [theme](../mobile/lib/theme.dart) and
[mobile architecture guide](../mobile/README.md#screen-structure).

- Keep shared design tokens consistent with the web's `--capture-*` properties
  in [globals.css](../src/app/globals.css). Controls, panels, and sheets have
  distinct radii; the home primary action is deliberately square.
- Use full-strength yellow for the available primary action, once per screen;
  unavailable actions do not get yellow. Selection and input focus are exceptions.
- Geist/GeistMono are interface fonts; bundled Arial is label type. Explicit
  label font selection must prevent the interface theme from changing paper.
  Use matching `fontWeight` and variable `fontVariations`; Flutter tracking is
  logical pixels, so recompute size × web em when changing type sizes.
  [Interface font tests](../mobile/test/interface_font_test.dart) and
  [label goldens](../mobile/test/label_golden_test.dart) guard this separation.
- The deck and home's print entry share actionable count, next-person, and
  blocking state. Route a blocker to the screen that clears it; do not replace
  this with a generic menu label or a stack of competing status cards.
- Keep printer controllers independent of `BuildContext` and dialogs; screens
  obtain explicit retry/reprint confirmation.
- Resolve uncertain prints only on the recovery screen. Other surfaces point
  there. Sync-only recovery must never transmit another label.
- Keep rosters dense and lazily built, with one expanded row at a time. Expose
  needs-order, captured, no-drink, and printed state, not the legacy delivery
  pipeline enum. See [order progress](../src/lib/order-progress.ts).
- Reduced Motion resolves entrances to their visible end state. Route animation
  durations through [motionDuration](../mobile/lib/widgets/motion.dart); stagger
  with intervals in a controller instead of delayed timers.
- Animate the supplied smiley bitmap as a whole; do not trace a replacement.
- Preserve haptic meaning: medium on connection, heavy on completed printing,
  double-beat on uncertainty. Do not add a second celebration impact after a
  print; that would mimic the uncertainty signal. Device testing is needed to
  establish the actual feel and physical outcome.
- Preview uses the print renderer, not a separate widget reconstruction. Follow
  the [golden workflow](../mobile/README.md#visual-regression-and-renderer-comparison)
  before changing any baseline.

## Data access and offline behavior

For data work, use the [mobile data and offline guide](../mobile/README.md#data-access).

- Creation/setup stays online; capture and printing work offline. Do not turn
  setup into a general-purpose synchronization engine incidentally.
- Preserve the shared projected board, per-user cache isolation, durable outbox,
  sparse revision-checked edits, visible conflicts, and independent replay of
  confirmed print facts. Realtime is a refresh signal, not the sole sync path.
- Distinguish unreachable service from explicit refusal. An old cached Active
  status must not override a server refusal. Recovery evidence survives restart
  and auth failure; corrupt storage is not permission to erase uncertainty.
- Supabase is the runtime backend; missing configuration must not silently
  activate seed data. Web local storage is for harmless UI preferences.
- Web operator reads/mutations use the authenticated server DAL and request-scoped
  user session in [operator context](../src/server/operator/context.ts), not
  service-role bypass. Browser use is limited to auth/session observation,
  Realtime refresh signals, and private person-photo Storage operations.
- Public runners remain account-free and token-scoped. Preserve token hashing,
  expiry/revocation checks, scoped DTOs, patch allowlists, and rate limits. See
  [production-share.ts](../src/lib/production-share.ts),
  [DTOs](../src/server/productions/dto.ts), and
  [public API guard](../src/lib/public-api-guard.ts). Private person notes and
  dietary notes stay out of runner payloads; usual order is an operational prompt.
- Do not infer privileges from legacy `isAdmin` naming. Preserve authenticated
  RLS, owner-provisioned accounts, and disabled public signup. Person photos
  remain private with short-lived signed URLs.

## Maintained web surface

Reuse [UI primitives](../src/components/ui.tsx), compact phone-friendly controls,
and existing icons. Add explanatory copy only when it prevents an operational
mistake. Preserve optimistic-edit reconciliation and token-scoped runner polling.
The label-export workflow is supported; old laptop/USB print-station plans are
historical, not instructions to rebuild that architecture.
