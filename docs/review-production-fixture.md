# Fictional App Review production fixture

Create this through the authenticated production UI using private operator
access. Do not commit the resulting production ID, token, URL, or screenshots
that reveal the token.

## Requirements

- Client: `Capture This Review — Fictional`
- Production: `Apple Review Coffee Run`
- Status: active throughout TestFlight/App Review
- Shoot date: a future date far enough away that routine cleanup will not
  expire or archive it during review
- Location: `Fictional Studio A`
- Share token: stable for review; no automatic expiry; revoke after the final
  review if a replacement operational link is ready
- People/orders: fictional only; no employee, client, or tester personal data

## Suggested roster

| Fictional crew name | Drink | Why included |
|---|---|---|
| Alex North | Black coffee | Short baseline |
| Jo Reed | Oat latte | Short baseline |
| Cameron Ellington-Smythe | Iced americano | Long name |
| Marisol De La Cruz-Ramirez | Cappuccino | Long name |
| Taylor Quinn | Half-caf oat milk vanilla latte, extra hot | Long drink |
| Morgan Lee | Iced decaf caramel latte with oat milk, light ice | Long drink |
| Riley Chen | Espresso | Very short drink |
| Jordan Avery | Hot chocolate | Non-coffee |
| Casey Brooks | No order | Queue exclusion case |
| Drew Parker | Almond milk flat white | Batch item |
| Sam Rivera | Iced matcha latte | Batch item |
| Jamie Wilson | Cold brew, splash of oat milk | Batch item |
| Avery Stone | Double espresso | Batch item |
| Quinn Harper | Chai latte | Batch item |

Leave enough orders pending for Apple to inspect. Mark a small number printed
so both pending and printed filters are visible. Before every review submission,
open the URL in a private browser, verify the queue and PNG endpoints work, and
confirm the production is active. Enter the URL only in App Store Connect’s
secure review field and the private tester invitation—not Review Notes, Git,
logs, screenshots, issue trackers, or email sent to broad lists.
