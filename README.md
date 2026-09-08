# Capture This

[![Quality checks](https://github.com/coltonbatts/capturethiscoffee/actions/workflows/quality.yml/badge.svg)](https://github.com/coltonbatts/capturethiscoffee/actions/workflows/quality.yml)

Capture This is a shoot-day coffee operations system for production
crews. It keeps the day roster, drink collection, cup-label printing, and
printed status in one workflow.

[Open the web app](https://coffee.capturethis.com) ·
[Delivery status](docs/delivery-status.md) ·
[Documentation](docs/README.md) ·
[Support](https://coffee.capturethis.com/support)

## Current product

- The Flutter iPhone app in [`mobile/`](mobile/README.md) is the primary on-set
  experience.
- The Next.js app maintains supported web setup, the zero-install
  runner board, and fallback label export.
- Supabase is the shared source of truth for accounts, productions, rosters,
  orders, and printed status.
- Labels are rendered on the phone and printed over Bluetooth LE to the
  supported NIIMBOT M2_H.
- Preserve deliberate single-label printing. Unattended
  batch printing is a documented hardware/protocol limitation.

Build and release details change more often than this overview. Use the
[delivery checklist](docs/delivery-status.md) for current findings and links to dated
build and release evidence. Repository state alone does not prove deployment, device
installation, Apple approval, or physical acceptance.

## Repository map

| Path | Purpose |
| --- | --- |
| [`mobile/`](mobile/) | Primary Flutter/iOS app and direct BLE printing |
| [`src/`](src/) | Maintained Next.js web app and fallback APIs |
| [`supabase/`](supabase/) | Database schema and ordered migrations |
| [`tests/`](tests/) | Web domain and API tests |
| [`docs/`](docs/) | Operations, release evidence, architecture, and historical decisions |
| [`scripts/`](scripts/) | Verification and controlled fixture utilities |

## Run the web app

Prerequisites:

- Node.js 20.9 or newer
- npm
- A configured Supabase project

On first setup, install dependencies with `npm ci` and copy `.env.example` to
`.env.local` if no local configuration exists. Reuse a working environment.

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Set these values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The service-role key is server-only. Never expose it to browser or Flutter code,
commit it, or prefix it with `NEXT_PUBLIC_`.

Apply [`supabase/schema.sql`](supabase/schema.sql), then the files in
[`supabase/migrations/`](supabase/migrations/) in filename order. Public signup
must remain disabled; operators are invited or created by an owner.

## Run the iOS app

The complete setup, signing, device, printer, and recovery instructions live in
the [mobile app guide](mobile/README.md). Reuse the checked-in iOS project and
a working Flutter environment; supply the reviewed public Supabase configuration
described there.

A physical iPhone and the accepted NIIMBOT M2_H are required to verify
Bluetooth printing. Simulator and automated tests do not close the physical
release gate.

## Quality checks

Choose local checks using [Contributing](.github/CONTRIBUTING.md#verification).
Small documentation edits need link/path and diff checks, not application builds.
The [quality workflow](.github/workflows/quality.yml) defines CI's broader web,
mobile, and screenshot checks; release and physical acceptance remain separate.

## Working on the project

Start with [AGENTS.md](AGENTS.md) for shared instructions and
[CONTRIBUTING.md](.github/CONTRIBUTING.md) for verification guidance. In particular:

- treat `mobile/` as the primary product surface;
- keep the web fallback working and avoid new web-only product features;
- use fictional data in tests, screenshots, issues, and release evidence;
- never commit credentials, runner tokens, private crew data, or signing
  assets; and
- keep the direct printer dependency pinned unless a dedicated hardware
  validation plan approves a change.

Security reports should follow the private process in
[SECURITY.md](.github/SECURITY.md). General product help is covered by
[SUPPORT.md](.github/SUPPORT.md).

## License

This is client project source. No open-source license is granted.
