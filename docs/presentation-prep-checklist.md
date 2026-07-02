# Pre-Presentation Prep — Luke Demo (this week)

Private checklist for Colton. Ordered by ROI given the tight timeline.

## 1. Design pass (highest visible impact)

Scope it small — you have days, not weeks. Don't redesign; tokenize and tighten.

- [ ] Define a mini token set first: 1 display face + 1 UI face, a 4/8px spacing scale, 2–3 brand accents pulled from the smiley/holographic stock. Put it in `src/app/globals.css` as Tailwind v4 theme vars so every screen inherits it.
- [ ] Sweep `src/components/ui.tsx` only — since Panel/Field/buttons are shared primitives, fixing them fixes most screens at once. Avoid touching the big page files (`components.tsx` is ~937 lines, `labels/page.tsx` ~654) beyond class swaps.
- [ ] Kill the AI-slop tells: default grays, generic rounded-2xl-shadow cards, inconsistent radii, mixed font weights. Pick one radius, one shadow (or none), tight type hierarchy.
- [ ] Screens Luke will actually see in the demo, in priority order: login → home (three-station front door) → live board → labels. Polish those four; skip the rest.

## 2. Demo readiness

- [ ] Seed real-looking demo data (Luke's client, a plausible crew roster with photos, a production dated this week). No "Test Person 1".
- [ ] Run the demo script in `docs/v1-readiness.md` end-to-end on your phone the day before.
- [ ] Test the runner share link on a second device.
- [ ] Print one physical label from the holographic stock to hand him. A real cup label beats any slide.
- [x] Verify Google sign-in works on the deployed URL (OAuth redirect URLs configured in Supabase for prod domain, not just localhost).

## 3. Deployment sanity (from CLAUDE.md P0s)

- [ ] Deployed env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; auth enabled.
- [ ] RLS active; anonymous table access fails.
- [ ] `npm run test && npm run lint && npm run build` green before you touch anything else.

## 4. The conversation itself

- [ ] Hand him `luke-update-2026-07.md` (or a PDF of it) as the leave-behind; drive the meeting from the live app, not the doc.
- [ ] Have one ask ready: what does he want next — more label styles, realtime board, or onboarding his team?
- [ ] Note anything he reacts to; that's your roadmap.
