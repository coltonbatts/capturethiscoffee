# iOS UI/UX rework — Build 8, pre-TestFlight

Written 2026-07-25. Successor to
[`app-first-direction-2026-07-25.md`](app-first-direction-2026-07-25.md).

**Status: all ten phases complete, 2026-07-25.** 124 tests green, analyzer
clean, the four label goldens byte-identical to their pre-Geist checksums.
Everything below is the plan as written; what actually differed is recorded in
"Deviations from this plan" at the end, and the outstanding hardware checks are
in "Before this ships".

## Context

`1.0.0+8` is bumped in `mobile/pubspec.yaml` but never built or uploaded. Builds
5, 6, and 7 are consumed. Build 8 is the last chance to fix the app's look and
shape before it goes to TestFlight as the product.

Three problems with the app as it stands:

1. **The front door is a bare text field.** Cold launch with no session shows a
   paste-a-URL input. It explains nothing, offers no Paste button, and reports
   validation failures through the same generic error banner used for Bluetooth
   scan failures.
2. **It does not look like the website.** The web had a hard visual pivot on
   2026-07-24 (`d67fa27` → `2fe359c`) away from neo-brutalism to quiet Swiss
   editorial on warm paper. `mobile/lib/theme.dart` ported the *colors* faithfully
   but not the typeface, the type scale, the radii, or any of the motion.
3. **There is nowhere to be.** Navigation is two `if` statements at
   [`main.dart:1893`](../mobile/lib/main.dart:1893). Every surface is one
   vertical `ListView`. There is no `Navigator.push` of any app screen anywhere.

Intended outcome: an app that reads as the same product as the website, opens on
a home screen that makes the next action obvious, and keeps the proven print path
untouched.

## Decisions locked with the account owner

| Question | Decision |
|---|---|
| Front door for Build 8 | Polish the link screen. **Supabase Auth + days list is Build 9**, per phase 1 of the direction doc. |
| Testers | The owner, plus one or two people they can stand next to. The bar is *beautiful and correct*, not *self-teaching*. |
| Main screen | Full visual redesign matching the web. |
| Opening screen | **A real home screen you always return to.** Not a one-time welcome, not auto-advancing. |
| Typeface | **Bundle Geist.** Overrides the current CLAUDE.md rule; see below. |
| Roster rows | **Compact by default, tap to expand** into the web's card treatment. |

## De-risked before planning

**Bundling a global font cannot change what prints on paper.**
`mobile/lib/label_painter.dart` has exactly one text-drawing site — the
`TextPainter` at `label_painter.dart:116` — and it sets
`fontFamily: labelFontFamily` explicitly. Nothing in the label renderer inherits
from `ThemeData`. The four label goldens in `mobile/test/label_golden_test.dart`
are the canary and must stay byte-identical through the whole rework.

This is why the CLAUDE.md rule *"Do not set a global `fontFamily`"* can be
retired. That rule existed to stop bundled Arial leaking from the label renderer
into the interface. Naming Geist explicitly makes that leak **less** likely, not
more. Update the rule to say so rather than deleting it.

---

## Architecture: what has to change before any pixel does

A home screen you return to requires a route stack, and a route stack requires
shared state that outlives a single `State` object. `main.dart` is 1954 lines —
40% of the app — holding all 21 mutable state fields, both scaffolds, five
dialogs, one sheet, and eight inline widget builders.

### 1. Extract a controller

Create `mobile/lib/printer_controller.dart`: a `ChangeNotifier` holding
everything currently in `_PrinterHomeState` — session, queue, connection,
printer status, recovery ledger, roster filter, sync timestamps, log — plus the
methods that mutate them (`_refreshBoard`, `_connectPrinter`, `_printLabel`,
`_linkProduction`, `_clearSession`, and the recovery resolvers).

Expose it with `InheritedNotifier` + `ListenableBuilder`. **Do not add Riverpod,
Provider, or Bloc.** The existing constructor injection for
`sessionRepository` / `printRecoveryRepository` / `boardCacheRepository` /
`apiFactory` ([`main.dart:59-62`](../mobile/lib/main.dart:59)) moves onto the
controller so the tests keep working.

### 2. Introduce routing

Plain `Navigator` with named routes on `MaterialApp` — no `go_router`
dependency. Routes:

| Route | Screen | File |
|---|---|---|
| `/` | Home | `lib/screens/home_screen.dart` |
| `/print` | The print deck | `lib/screens/print_screen.dart` |
| `/roster` | Roster | `lib/screens/roster_screen.dart` |
| `/recovery` | Unresolved prints | `lib/screens/recovery_screen.dart` |
| `/link` | Paste the share URL | `lib/screens/link_screen.dart` |
| `/about` | Version, privacy, support, licenses | `lib/screens/about_screen.dart` |

The splash (`_loadingSession`) stays as the `home:` widget and replaces itself
with `/` once `_restoreSession()` resolves. Help stays a bottom sheet.

`main.dart` should end this work under ~150 lines: `PrinterApp`, the route
table, and the splash.

### 3. The cost, stated plainly

**A home screen puts one tap between the operator and the print button.** The
print deck exists specifically because three co-equal status cards each held a
fragment of the answer to "can I print right now?"
([`print_deck.dart:1-9`](../mobile/lib/widgets/print_deck.dart:1)). A menu of
words in front of it would undo that.

The mitigation is non-negotiable: **the home screen's print entry must carry the
deck's answer, not just its name.** It shows the pending count, the next
person's name, and the blocking reason if there is one — and it is yellow only
when a print would actually succeed. It is the `DeckBlock` state machine
rendered as a card. If it ever reads just "Print labels ›", this has failed.

---

## Design system: `theme.dart` deltas

Colors are already correct — do not touch `CaptureColors` except to add the four
below. Everything else here is a change.

### Typeface (new)

Download the **Geist** and **Geist Mono** variable TTFs (OFL 1.1, from
`github.com/vercel/geist-font`) to `mobile/assets/fonts/`. Register in
`pubspec.yaml` alongside the existing Arial block — **do not disturb the Arial
entry or its comment.** Set `fontFamily: 'Geist'` on `ThemeData`.

The web uses non-standard weights (460, 560, 580, 590, 650, 750). Use
`fontVariations: [FontVariation('wght', n)]` and set `fontWeight` too as a
fallback for the static-instance case.

Activity log mono ([`main.dart:1852`](../mobile/lib/main.dart:1852)) moves from
Menlo to Geist Mono.

### Radii (correction)

`CaptureRadii.control` is 12; the web's `rounded-lg` is **8**. Cards stay 12.

```dart
control = 8    // buttons, inputs, chips  (was 12)
card    = 12   // panels                  (unchanged)
sheet   = 16   // bottom sheet top corners
pill    = 999
```

The web's hero CTA (`page.module.css:107`) is **square** — no radius at all, the
only such control in the product. Match it on the home screen's primary action.
It is a striking, deliberate detail and a one-line revert if it reads wrong on
device.

### Type scale (additions)

`CaptureType` currently tops out at `headlineLarge` 34px. Add the web's hero and
row scales:

```
hero      64–110px  w750  height 0.84  tracking -0.075em   // splash / empty home
pageTitle 30–36px   w600  height 1.00  tracking -0.055em   // screen titles
rowName   21.6px    w600  height 1.03  tracking -0.035em   // expanded roster row
statNumber 30px     w600  tabularFigures  tracking -0.040em
```

`statNumber` must use `FontFeature.tabularFigures()` — the deck's animated
count currently jitters as digits change width.

### Colors (four additions)

```dart
static const amber   = Color(0xFFFBBF24);  // "needs order" status rail
static const zinc400 = Color(0xFFA1A1AA);  // "no drink" rail
static const emerald50  = Color(0xFFECFDF5);
static const emerald900 = Color(0xFF064E3B);
```

Emerald is **the only green in the product** and appears in exactly one place:
the "All drinks captured" pill.

### Yellow discipline (fix a live violation)

Today the stale-board notice ([`main.dart:1495`](../mobile/lib/main.dart:1495))
and the print action ([`theme.dart:170`](../mobile/lib/theme.dart:170)) are
*both* full-strength yellow, and both can be on screen at once. The code comment
at `main.dart:1492-1494` already anticipates the fix and was never applied.

- The stale notice drops to a hairline surface with a `cloud_off` icon.
- Yellow belongs to the primary action, once per screen.
- Two exceptions, ported from the web because neither competes with an action:
  - **Text selection** — `textSelectionTheme.selectionColor = yellow`
    (web `globals.css:48`).
  - **Focus ring** — a focused input gets a 2px ink border *and* a yellow outer
    ring (web `inputClass`, `focus:ring-2 focus:ring-accent`). `InputDecoration`
    can't express two rings; build a small `CaptureField` wrapper that paints a
    zero-blur yellow `BoxShadow` at `spreadRadius: 2` when focused.

---

## Screens

### `/` — Home

The answer to "robust and obvious." Structure top to bottom:

1. **App bar** — `BrandAppBarTitle`, unchanged.
2. **Hero.** With a production linked: the smiley at ~96px, then the production
   name at `pageTitle` scale, then the client/date detail line. With nothing
   linked: the full web splash — smiley large, **"Capture This"** / **"Coffee"**
   on two lines at `hero` scale, and the line **"Good coffee. Even on a 5 AM
   call."** verbatim from `page.tsx:51`.
3. **Print entry** — the primary action, yellow, square-cornered. Carries
   `DeckBlock` state (see the mitigation above): *"12 to print · Next: Marisol
   Vega"*, or the blocking reason, greyed.
4. **Roster entry** — *"38 people · 12 need orders"*, with the web's
   `CountBadge` pill treatment.
5. **Printer entry** — connect / disconnect, and **finally renders
   `_PrinterStatus.connecting`**, which is set at
   [`main.dart:375`](../mobile/lib/main.dart:375) and displayed nowhere today.
6. **Recovery entry** — appears only when the ledger is non-empty:
   *"2 labels need a check."* Routes to `/recovery`.
7. **Sync line** — `_syncStatusLabel`, plus the demoted stale notice.
8. **Footer row** — Change production · Help · About.

When every label is printed, the hero becomes the celebration: the smiley at
hero scale, **"That's the day."**, and the emerald "All drinks captured" pill.

### `/print` — the deck

`PrintDeck` survives essentially intact. It is the best-designed thing in the
app and the comment block at `print_deck.dart:1-9` explains why. Changes only:

- The stale notice restyled per the yellow rule.
- Tabular figures on the animated count.
- `AppBar` with a back button; the deck is now a destination.
- Keep `LabelPreview` calling the real `renderLabelImage`. **Never rebuild the
  label layout in widgets.**

### `/roster` — compact, tap to expand

- `RosterSection`'s search + `To print / Printed / All` chips move to a pinned
  header; chips adopt the web's segmented pill treatment with counts baked into
  the label (`Everyone (38)`, `Needs order (12)`).
- **Convert the eager `Column` at
  [`roster_section.dart:96`](../mobile/lib/widgets/roster_section.dart:96) to
  `ListView.builder`.** The board caps at 1000 entries; building all of them
  every frame is a real problem on a big call sheet, and expand-in-place needs
  per-row state anyway.
- **Collapsed row:** replace the 9px dot with the web's status rail as a 3px
  full-height bar — ink = captured, amber = needs order, `zinc400` = no drink.
  Name, then `drink · group`. Hairline rule between rows.
- **Expanded row:** animate open to the web's `RosterCard` — 48px `Avatar`
  (circle, `ring-1 ring-black/15`, black fallback disc with initials), 21.6px
  name, role line, and the full-width **drink slab** (`rounded-lg`, `black/10`
  border, `black/2.5%` fill). Not-yet-captured rows show `Usual: …` as a prompt,
  exactly as the runner board does.
- Add the empty state the web is missing: filtering to zero currently shows
  nothing. Use the web's `EmptyState` — a 36px yellow disc containing a typed
  `:)`, title, description.
- **Never surface the legacy `OrderStatus` enum.** Rows read "Camera ·
  confirmed" until 2026-07-25; see `main.dart:1700-1703`.

### `/recovery` — de-triplicate

Print recovery is currently rendered in three places at once: the `DeckBlock`,
the summary card at [`main.dart:1532`](../mobile/lib/main.dart:1532), and the
per-row attention tiles at [`main.dart:1775`](../mobile/lib/main.dart:1775). One
screen, one list, the two resolution buttons per record.

**Preserve the invariant** in `print_recovery.dart:37-40`: `printedNeedsSync`
can never be weakened back to `uncertain`. Paper came out of a printer and no
sync state may contradict physical reality.

### `/link` — the polished front door

Kept, not replaced — Build 9 retires it. Additions:

- A **Paste** button reading the clipboard. Today the only way in is a
  long-press paste, which is absurd for a URL arriving by text message.
- **Inline validation on the field**, not the global error banner. The message
  from `main.dart:557` — *"Paste the full production share URL (must include
  ?token=…)."* — belongs under the input.
- Auto-detect a valid share URL already on the clipboard when the screen opens
  and offer it as a one-tap chip.
- Keep `parseProductionShareUrl`'s strictness
  ([`production_session.dart:38`](../mobile/lib/production_session.dart:38))
  exactly as is. It is a security boundary.

### `/about`

The four-button `AlertDialog` at [`main.dart:760`](../mobile/lib/main.dart:760)
wraps and cramps. Becomes a screen: version, one-line description, then
Privacy / Support / Licenses as list rows.

---

## Motion and joy

The web's delight was never ported. This is the part that makes it feel like the
same product.

**`mark-arrive` — the signature.** The splash smiley
(`page.module.css:211-226`) begins at `opacity 0`, `translateY(20px)`,
`rotate(-4°)`, `scale(0.92)`; at 72% it overshoots to `translateY(-2.4px)`,
`rotate(0.6°)`, `scale(1.012)`; then settles. 720ms on `Cubic(0.2, 0.8, 0.2, 1)`
after a 60ms delay. It lands like a sticker being slapped down. Add as
`BrandMark.arrive` in `brand_mark.dart`.

**The staggered cascade.** Home content fades and slides up 12.8px over 560ms on
`CaptureMotion.ease`, on an 80ms metronome — smiley 60ms, title 190ms, detail
270ms, primary action 350ms, secondary 430ms. One `AnimationController` with
`Interval`s.

**Press physics.** Every web button does `active:translate-y-px`. Nothing in the
Flutter app moves on press. Add a 1px downward translate to the shared button
styles; `active:scale(0.98)` on the home hero action.

**Keep what already works.** The print-success stamp
(`print_deck.dart:120-128`), the counting-down `TweenAnimationBuilder`, and
`BrandPulse` as the loading state all stay — `BrandPulse` is the direct analog of
the web's `CaptureMark … animate-pulse`.

**Reduce Motion.** `brand_mark.dart:86` already honors it. Every new animation
must check `MediaQuery.disableAnimations` and resolve to the end state.

**Haptics keep their meanings** — heavy on a print that produced paper, medium
on connect, the deliberate double-beat on *uncertain*. Add one: a heavy impact
on the "That's the day." transition.

**The copy stays deadpan.** The web's tone is dry, specific, crew-native. It
knows what a call time is. It never jokes about coffee and never uses an emoji.
The joy is carried entirely by motion, the smiley, and the yellow. Preserve that
split. Reuse the web's strings verbatim where an analog exists — *"Doesn't want
a drink today."*, *"drinks in"*, *"Good coffee. Even on a 5 AM call."*

**Do not port** the web's `CountBadge` bug (`ui.tsx:358` renders a yellow count
on a yellow pill — invisible). Render the count in ink.

---

## Defects fixed along the way

| Defect | Where |
|---|---|
| `_PrinterStatus.connecting` renders nowhere | `main.dart:375` → home printer entry |
| Two full-strength yellows can collide | `main.dart:1495` + `theme.dart:170` |
| Recovery state rendered three times | → `/recovery` |
| Roster builds every row eagerly | `roster_section.dart:96` |
| Count digits jitter while animating | `print_deck.dart:230` |
| Four buttons crammed in a dialog | `main.dart:760` → `/about` |
| `LabelPreview` swallows render errors into a blank box | `label_preview.dart:73` |

**One non-cosmetic fix, included because a tester will hit it.** A production
marked `complete` drops out of `readableProductionStatuses` server-side, so the
board 404s — and the app shows **"Working offline"** over a roster for a day
that is actually finished, with printing still unblocked because the cached
status says `active`. Give `CtcApi` a typed error distinguishing 404 from a
network failure, and render "This day is complete" instead of a lie. Documented
at `mobile/README.md:94-98` and `offline-first-ios-handoff.md:120-125`.

---

## Sequencing

Each phase ends green. Do not start the next until it is.

1. **Fonts and tokens.** Bundle Geist, set it globally, correct radii, add the
   hero/row scales and four colors. **Run `flutter test` and confirm the four
   label goldens are unchanged** — this is the proof the font cannot reach paper.
2. **Controller extraction.** Mechanical, zero visual change. `flutter test`
   must pass without touching assertions other than construction.
3. **Routing.** Route table, six screens as thin moves of existing builders. Still
   no visual change beyond navigation.
4. **Home screen.** The new surface, with the `DeckBlock` mitigation.
5. **Roster** — `ListView.builder`, rail, expand-in-place, empty state.
6. **Recovery screen** — remove the two duplicate renderings.
7. **Link screen** — Paste, clipboard detection, inline validation.
8. **Motion pass** — `mark-arrive`, cascade, press physics.
9. **Defect sweep** and the complete-production typed error.
10. **Goldens and release.** Regenerate App Store screenshot goldens, then
    `rm -rf mobile/test/failures` (nothing gitignores it). Stay at `1.0.0+8` —
    it was never uploaded.

**Expect all four App Store screenshot goldens to break in phase 1 and stay
broken until phase 10.** They are regression tests, not marketing assets — they
render with placeholder box glyphs and no smiley. Real screenshots come from
`mobile/tool/app_store_screenshot.dart` on a device.

`mobile/test/widget_test.dart` (263 lines) and `offline_cold_start_test.dart`
drive the current two-screen structure and will need rewriting in phase 3.

## Verification

```bash
cd mobile && flutter analyze && flutter test
```

```bash
node scripts/compare-label-renderers.mjs
```

Then on a **real device** — the simulator has no Bluetooth and no Taptic Engine,
so BLE printing and haptics cannot be confirmed there:

1. Cold launch in airplane mode with a cached board → home screen renders, print
   still works.
2. Connect the M2_H, print one label, confirm it matches a build-7 label
   physically. This is the proof the font change didn't reach paper.
3. Print a batch, kill the app mid-batch, relaunch → recovery screen offers the
   right two choices.
4. Reduce Motion on → every animation resolves to its end state.

Report which of these were done on hardware and which were not. Do not imply
simulator coverage of BLE or haptics.

## Do not touch

- `niim_blue_flutter: 1.0.1` — the exact pin is deliberate.
- Printer firmware.
- `label_painter.dart` / `label_content.dart` — and never rebuild the label
  layout in widgets. `LabelPreview` must keep calling the real
  `renderLabelImage`.
- The Arial font entry in `pubspec.yaml`.
- `assets/capture-this-smiley.png` — byte-identical to the web's copy
  (sha256 `21977fb0…`). There is no vector source. Animate it as a whole object;
  never trace it to paths.
- The frozen web app in `src/`. `npm run test`, `lint`, and `build` stay green.
- Supabase Auth — that is Build 9, phase 1 of the direction doc.

---

## Deviations from this plan

Six, each a judgement made against the plan rather than a slip.

1. **`mark-arrive` and the cascade moved from phase 8 into phase 4.** The hero
   and its entrance are one design; splitting them meant building the screen
   twice. Phase 8 kept press physics and the Reduce Motion audit.
2. **Phase 3 built a plain home screen rather than only routing.** Creating
   `/print`, `/roster`, and `/recovery` while `/` still rendered all three would
   have left three screens nothing navigated to. Phase 4 then designed that
   surface.
3. **`CaptureButtons.heroAction` was split from `accent`.** The plan set
   `CaptureRadii.hero = 0` and had the accent style use it, which would have
   squared the deck's print button too. The web only squares its splash CTA.
4. **No clipboard auto-detect on the link screen.** Reading the pasteboard
   triggers iOS's "pasted from Safari" banner; doing that with no user action
   reads as snooping. The explicit Paste button stayed.
5. **No photographs in the expanded roster row.** `BoardPerson` carries a
   `photoUrl`, but it is a signed URL that expires in an hour and this app runs
   from a disk cache on a stage with no signal — a grid of broken images is
   worse than none. Initials only, matching the web's own `AvatarFallback`.
   Faces matter at handover, which is order capture, not printing.
6. **No celebration haptic.** See the note in CLAUDE.md: a day completes
   immediately after a print, which already fires a heavy impact, so a second
   one reproduces the *uncertain* double-beat exactly.

## Bugs found while doing this that were not in the plan

- **The App Store goldens were capturing blank screens.** From the moment the
  entrance animations landed, `_renderAppStoreScreenshot` pumped a fixed 100ms
  while the cascade ran to 430ms — so each golden was an app bar over an empty
  body, and passed, because blank compares equal to blank. Now `pumpAndSettle`.
- **`CaptureType.statNumber` was never wired up.** Specified in phase 1 to fix
  the counting-down number's jitter, and the deck went on using `headlineLarge`
  for seven phases. A token nothing references still compiles and still passes.
  There is now a test on the rendered style, not the token.
- **`Future.delayed` staggering leaked timers**, failing any widget test that
  touched the screen. The stagger is an `Interval` inside one controller.
- **The controller flattened `CtcApiException` into a plain `Exception`**,
  which would have discarded the new error kind — the same flattening that let
  a 404 masquerade as "no signal" in the first place.

## Before this ships

Everything above was verified in the simulator and by the suite. These need the
real device and the real M2_H, and none of them can be checked in a simulator:

1. **Print one label and compare it to a build-7 label physically.** The suite
   proves Geist cannot reach the renderer; this proves it cannot reach paper.
2. **Print a batch, kill the app mid-batch, relaunch.** Recovery should offer
   the two choices on `/recovery`, and the roster should show grey pointer rows.
3. **Haptics**: heavy on a print, medium on connect, the double-beat on an
   uncertain print — and confirm nothing new fires on "That's the day."
4. **Press physics and `mark-arrive`** want a real screen and a real thumb.
5. **A genuinely completed production**, to confirm the server's 404 produces
   "This day is closed" and refuses to print. Fixture-tested only.
6. **Reduce Motion on**, end to end.

`node scripts/compare-label-renderers.mjs` needs `npx tsx` rather than bare
`node` — the script imports TypeScript through the `@/lib` path alias.
