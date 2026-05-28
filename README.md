# Capture This Coffee

Mobile-first internal coffee runner app for Capture This production shoots.

## What is in this MVP

- Staff login placeholder at `/login`
- Production list at `/productions`
- Production creation at `/productions/new`
- Runner dashboard at `/productions/[id]`
- People database at `/people`
- Client database at `/clients`
- Supabase-backed data access when env vars are configured
- Local seeded `localStorage` demo fallback when Supabase env vars are missing
- Supabase table scaffold and simple RLS policies in `supabase/schema.sql`
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
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

5. Restart `npm run dev` after changing `.env.local`.

When both env vars are present, the app reads and writes these Supabase tables:

- `clients`
- `people`
- `client_people`
- `productions`
- `production_roster`
- `orders`

When either env var is missing, the app falls back to seeded demo data in `localStorage`. The reset demo button only appears in this fallback mode.

The included RLS policies are intentionally permissive for the current internal-staff MVP because there is not a real auth flow yet. Tighten these policies when staff authentication is added.

## Seed data

The app does not automatically insert demo rows into Supabase. To test against Supabase, add a client and people from the app, then create a production. To prefill realistic sample rows, adapt the records in `src/lib/seed.ts` into SQL inserts using Supabase-generated UUIDs.

## Verification

```bash
npm run lint
npm run build
```
