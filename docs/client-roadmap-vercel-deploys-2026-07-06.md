# Capture This Coffee - two-week deployment roadmap

Prepared July 6, 2026 from Vercel deployment history for `capturethiscoffee`.

## Executive snapshot

From June 22 through July 6, the project shipped 41 ready Vercel deployments:

- 33 production deployments to `main`
- 8 preview deployments on Codex feature branches
- 35 deployed commit milestones
- Latest production deploy: `fd59f8d` - Polish runner card hierarchy

Client message: the app moved from label and workflow experimentation into a phone-first production system: authenticated setup, runner links, live day boards, CTC Printer support, batch labels, and a more consistent Capture This visual language.

## Visual roadmap

Use the companion HTML handout:

`docs/client-roadmap-vercel-deploys-2026-07-06.html`

## Roadmap narrative

| Window | Theme | What changed | Representative deploys |
| --- | --- | --- | --- |
| Jun 22-30 | Label foundation | Reworked coffee label hierarchy, moved label export toward phone use, added Capture This smiley label export. | `7fb0026`, `fe2813b`, `9a38ef9`, `3c1f7e2` |
| Jul 1 | Branded demo and app entry | Polished demo flow, added sticker label style, redesigned runner board and labels workstation, tightened People/Labels UX, made the home page a three-station front door, and added Google sign-in entry points. | `dec7e73`, `6f86e66`, `14ec90c`, `6c85747`, `af5b012`, `3b3b593` |
| Jul 2 | Runner handoff and mobile printer path | Added native iOS BLE printer app and server label API, documented Google OAuth/TestFlight handoff, added runner share links, fixed token/share behavior, and collapsed label designs to a single smiley label. | `e05ad01`, `a7b036f`, `32c8c13`, `5422bd9`, `273c08e`, `cf12d21` |
| Jul 3 | Simpler operations | Opened app access to signed-in users, fixed mobile overflow/header issues, and clarified production workflow plus fallback labels. | `5d4a800`, `b93cea9`, `aecaf5c`, `17e592d` |
| Jul 5 | Production-board and print-loop refinement | Simplified the day board to roster -> collect drinks -> batch labels, made CTC Printer the primary label flow, added auto-refresh/reprint behavior, improved CRUD and mobile layout, applied visual polish, and prepared client presentation materials. | `dd2bb96`, `31834af`, `621a2d4`, `330941c`, `7a82942`, `e5da282`, `6eaccfb`, `4743ac5`, `1a23081` |
| Jul 6 | Live readiness | Added live production board sync, fixed person photo upload and day delete behavior, and polished runner card hierarchy. | `d16832d`, `dc71d33`, `fd59f8d` |

## Client-facing proof points

- The web app now supports persistent setup, sign-in, productions, people, runners, labels, and mobile-friendly layouts.
- Runner access now uses scoped share links, so day-of helpers can work without full accounts.
- The label workflow now has a native iOS CTC Printer path plus `/labels` as a fallback/export workstation.
- The production board is simpler: build the roster, collect drinks, print labels, track progress.
- Recent deployments are green in Vercel and the latest production build is live.

## Recommended next line for the client

The core product loop is now assembled. The next paid V1 decision should be one of:

- Physical print validation on real NIIMBOT stock
- Staff onboarding and runner-link handoff polish
- More real-time collaboration across multiple phones during a production

## Source notes

Source queried through the connected Vercel app on July 6, 2026:

- Team: `Colton's projects`
- Project: `capturethiscoffee`
- Vercel project ID: `prj_QsToh3FFlzwkYnb8jNolK76lVGEL`
- Query window: June 22, 2026 through July 6, 2026
- All returned deployments were `READY`

