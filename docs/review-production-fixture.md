# Fictional Build 10 App Review and buddy-pilot fixture

Last updated: 2026-07-27

Status: **PLANNED — PRODUCTION WRITE NOT YET AUTHORIZED.**

Build 10 is production-configured. The separate disposable Supabase fixture
cannot be used by the uploaded IPA. Create this fixture in the production
backend only after the owner explicitly approves the production writes and
names the provisioning and cleanup owner.

Do not commit or print the resulting account email, password, production ID,
share token, URL, or credential-bearing screenshot. The mobile app receives
only the production public URL/key already embedded in Build 10; never use a
service-role key in the app, tester instructions, or fixture tooling.

## Required account and lifecycle

- Create or designate one individual, owner-provisioned fictional review
  account. Public sign-up remains disabled.
- Store its review email/password only in App Store Connect's secure Test
  Information fields or another explicitly approved private channel.
- Keep the account and fixture active through both Apple review and the buddy
  pilot.
- Provisioning owner: **OWNER INPUT**
- Cleanup owner: **OWNER INPUT**
- Cleanup date or trigger: **OWNER INPUT**
- Legacy share-link owner/revocation owner, if fallback review is required:
  **OWNER INPUT / OWNER INPUT**

## Required production

- Client: `Capture This Review — Fictional`
- Production: `Apple Review Coffee Run — Fictional`
- Status: **Active** throughout TestFlight App Review and the buddy pilot
- Shoot date: far enough in the future that routine cleanup will not archive it
  during review
- Location: `Fictional Studio A`
- People/orders: fictional only; no employee, client, owner, tester, or real
  crew data
- Legacy share token: create only if needed for fallback testing, keep stable
  through the pilot, transmit privately, and revoke after the final required
  review

## Required state coverage

| Fictional crew name | Initial order state / drink | Purpose |
|---|---|---|
| Alex North | Needs order | Basic offline capture |
| Jo Reed | Captured — Oat latte | Short printable label |
| Cameron Ellington-Smythe | Captured — Iced americano | Long-name printable label |
| Taylor Quinn | Captured — Half-caf oat milk vanilla latte, extra hot | Long-drink preview/edit |
| Riley Chen | Captured — Espresso | Very short drink |
| Casey Brooks | No drink | No-drink state |
| Morgan Lee | Needs order with fictional usual available | Accept-usual path |
| Jordan Avery | Captured — Hot chocolate | Non-coffee case |
| Avery Stone | Needs order | Reserved offline mutation row |
| Quinn Harper | Captured — Chai latte | Reserved conflict row: Keep server |
| Sam Rivera | Captured — Iced matcha latte | Reserved conflict row: Use phone version |
| Drew Parker | Captured — Almond milk flat white | Reserved interrupted-print row |

At least Jo Reed and Cameron Ellington-Smythe must begin captured and unprinted
so the exact short and long labels can be printed one at a time. Do not mark a
row printed merely to populate a filter, and never recycle a row whose
`label_printed` value became true. Add fresh, unmistakably fictional rows if a
physical attempt consumes or spoils a reserved case.

## Safe conflict plan

Use different reserved orders for the two explicit conflict choices.

1. Load the Active day online and record each reserved row's `updated_at`.
2. Take the phone offline and stage an ordinary fictional edit.
3. Through a second approved authenticated account or the website, make a
   different ordinary edit to the same row.
4. Reconnect and verify the phone shows both versions without overwriting.
5. Exercise **Keep server** on Quinn Harper and **Use phone version** on Sam
   Rivera.
6. Record only sanitized final fields and timestamps.

Do not perform a competing update on a printed fact, never attempt to reset
`label_printed: true`, and do not use real production data.

## Inactive-day refusal fixtures

Create two additional fictional days if production-safe acceptance requires
them:

- `Apple Review Planning Refusal — Fictional`, status Planning, one captured
  unprinted order.
- `Apple Review Complete Refusal — Fictional`, status Complete, one captured
  unprinted order.

Use only reserved fictional rows. Build 10 must retain pending work but refuse
replay and physical printing while the day is Planning or Complete. Restore a
day to Active only when needed for explicit conflict resolution and cleanup.

## Pre-submission verification

Before every submission or pilot:

1. Sign in through Build 10 with the individual review account.
2. Confirm only the intended fictional workspace data is visible.
3. Confirm `Apple Review Coffee Run — Fictional` is Active.
4. Confirm needs-order, captured, no-drink, short, long, conflict, and at least
   two fresh single-label cases exist.
5. Confirm the credentials work in the secure field without exposing them.
6. If Legacy fallback is included, verify the private link plus authenticated
   `/labels` PNG/CSV flow and keep the raw URL out of evidence.
7. Record provisioning owner, cleanup owner, and cleanup trigger.

Cleanup occurs only after Apple and the buddy no longer require the account,
days, or link. Verify any revoked Legacy URL returns a denial before deleting
the sanitized cleanup record.
