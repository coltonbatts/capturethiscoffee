# Capture This Coffee

Mobile-first internal coffee runner app for Capture This production shoots.

## What is in this MVP

- Staff login placeholder at `/login`
- Production list at `/productions`
- Production creation at `/productions/new`
- Runner dashboard at `/productions/[id]`
- People database at `/people`
- Client database at `/clients`
- Supabase Auth email/password staff login at `/login`
- Supabase-backed data access when env vars are configured
- Local seeded `localStorage` demo fallback when Supabase env vars are missing
- Supabase table scaffold and authenticated-user-only RLS policies in `supabase/schema.sql`
- Copyable coffee shop summaries and browser-printable label cards

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app redirects `/` to `/productions`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor. This enables RLS and allows only authenticated users to read and write app tables.
3. Copy `.env.example` to `.env.local`.
4. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

5. Restart `npm run dev` after changing `.env.local`.
6. In Supabase, open **Authentication > Providers > Email** and confirm email/password sign-in is enabled.
7. For a controlled demo, disable public sign-ups or leave sign-ups unused and create staff users manually.

When both env vars are present, the app reads and writes these Supabase tables:

- `clients`
- `people`
- `client_people`
- `productions`
- `production_roster`
- `orders`

When either env var is missing, the app falls back to seeded demo data in `localStorage`. The reset demo button only appears in this fallback mode.

## Demo staff users

Create demo staff users in the Supabase dashboard:

1. Go to **Authentication > Users**.
2. Click **Add user**.
3. Enter a demo staff email, for example `runner@capturethis.com`.
4. Enter a temporary password.
5. Confirm the user if your Supabase project requires email confirmation.
6. Share the email and password only with demo staff.

Then open `/login`, sign in with that email and password, and continue to `/productions`.

The app does not use the service role key. The browser uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; table access is controlled by Supabase Auth plus RLS.

## Seed data

The app does not automatically insert demo rows into Supabase. To test against Supabase, add a client and people from the app, then create a production. To prefill realistic sample rows, adapt the records in `src/lib/seed.ts` into SQL inserts using Supabase-generated UUIDs.

## Verification

```bash
npm run lint
npm run build
```
