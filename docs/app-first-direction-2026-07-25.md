# App-first direction — 2026-07-25

Decision by the account owner: **the iOS app in `mobile/` is the product. The
Next.js web app is frozen.**

This supersedes the "what stays on the web permanently" section of
[`offline-first-ios-handoff.md`](offline-first-ios-handoff.md), which assumed
people, rosters, day creation, and auth would live on the web indefinitely.

## What "frozen" means

Frozen, not deleted.

- Do not build new features in `src/`.
- Do not delete web code. `/run/[id]` in particular stays working: it is the
  zero-install path for a PA who will never be onboarded to TestFlight, and
  that is a real operational advantage no amount of Flutter replaces.
- Keep `npm run test`, `lint`, and `build` green. If a change breaks them, fix
  the break rather than dropping the check.
- Bug fixes to keep the frozen surface working are fine. New product surface
  is not.

## Why this is achievable — the database already allows it

This was verified against the migrations on 2026-07-25, not assumed:

- `20260609120000_public_operations_admin_printing_rls.sql` and
  `20260624120000_production_share_tokens.sql` run
  `grant all on public.{clients, people, client_people, productions,
  production_roster, orders} to authenticated`.
- `20260703120000_authenticated_full_access.sql` adds an RLS policy per table:
  *"Authenticated users can manage …"* `to authenticated`.
- `create_production_share_token(uuid, timestamptz, text)` has `execute`
  granted to `authenticated` — even minting a share link is a Postgres
  function, not a server-only path.

So a Flutter client signed in with Supabase Auth (anon key plus a user session)
can do everything the web operator UI does, directly against Postgres, with RLS
as the gatekeeper. **Next.js is a client of this database, not a gatekeeper.**
Nothing needs to be built server-side for the app to take over.

Caveat on the phrase "never touch the web": true at runtime — the app would
stop calling `/api/public/*` entirely. But `supabase/migrations/` lives in this
repo, so changing the data model still means touching it. That is SQL, not the
Next.js app.

## The consequence for the front door

The app has no identity of its own today; its only credential is a production
share token pasted in as a URL. With Supabase Auth there is no link to paste,
no QR to scan, and no token to keep out of text messages: you sign in and pick
today's day.

This retires an open design question rather than answering it. Note the
contradiction it removes — the in-app guide says *"Never share or screenshot the
production link,"* while the web only offers copy-to-clipboard, so the only way
onto a phone was to send it somehow.

Public signup is disabled (verified 2026-07-23), so accounts stay
owner-provisioned.

## The line that keeps offline simple

`offline-first-ios-handoff.md` is emphatic that the sync layer needs no
client-generated IDs, no create/delete sync, and no tombstones, because the app
only ever PATCHes rows the server already created — *"do not build a
general-purpose sync engine."*

Moving day, people, and roster creation into the app reopens exactly that
scope. The line that avoids it:

> **Creation online. Capture and printing offline.**

Building a day and a roster is pre-production work done with signal — office,
night before, call sheet in hand. Order capture and label printing are the
on-set activities that must survive no signal. Hold that boundary and the
outbox stays the simple coalesced field-patch map it is today.

## Costs accepted

- **Security posture shifts.** Today the phone holds a capability token scoped
  to one production with an allowlisted field set. With auth it holds a session
  that can manage all data — the same rights the web has, but on a device that
  lives on set rather than behind a laptop login.
- **Forty names on a phone** is worse than a laptop keyboard. This was the
  web's strongest remaining argument. An iPad helps; paste-a-list bulk import
  would help more. It is an ergonomics problem, not an architecture one.
- **Surface area.** The app grows sign-in, a days list, people CRUD with
  photos, and roster building on top of capture and printing. This is a
  multi-session build.

## Suggested phase order

Not started as of 2026-07-25.

1. **Sign-in + days list.** Replaces the link screen. Biggest UX win, does not
   disturb the proven print path. Add `supabase_flutter`; keep the token path
   working alongside rather than ripping it out.
2. **People + roster building**, with the camera for person photos — a phone is
   better at this than a laptop.
3. **Order capture** (Phase C of the offline-first brief).
4. **Retire the token path in the app.** Keep the frozen web runner board.

## Still true from the earlier brief

- Do not change the `niim_blue_flutter: 1.0.1` exact pin.
- Do not update printer firmware.
- Do not port the other seven label designs.
- Do not rebuild a laptop print station.
