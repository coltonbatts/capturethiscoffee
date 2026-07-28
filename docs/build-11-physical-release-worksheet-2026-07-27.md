# Build 11 physical release worksheet

Candidate identity: Capture This `1.0.0 (11)`
Bundle: `com.capturethis.ctcprinter`
Status: **not uploaded; not physically accepted**
Printer: accepted NIIMBOT M2_H / `M2_H-I409130491`
Stock: current rectangular holographic 50×30 mm stock
App density: `3`
Printer library: preserve exact `niim_blue_flutter: 1.0.1`

Use this worksheet only after the owner authorizes a Build 11 upload and the
iPhone visibly shows TestFlight `1.0.0 (11)`. Do not substitute Build 10, a
local debug build, another M2_H, another stock, or an inferred database result.
Record direct physical observations only.

## Session identity

| Item | Direct observation |
|---|---|
| Date/time/time zone | _____ |
| Primary tester / independent operator | _____ |
| Observer who does not operate the phone | _____ |
| iPhone model | _____ |
| iOS version | _____ |
| Install source and visible app version | TestFlight / `1.0.0 (11)` confirmed: _____ |
| Printer model/asset | M2_H / `M2_H-I409130491` confirmed: _____ |
| Firmware, record only; never update | _____ |
| Ribbon type/brand/lot/condition | _____ |
| Stock brand/lot/finish/feed | Rectangular holographic: _____ |
| Measured stock dimensions | _____ × _____ mm |
| Density | `3` confirmed: _____ |
| Fictional account | provisioned by owner: _____ |
| Fictional Active day | _____ |

## Exact operator gate

For every row, write **Pass**, **Fail**, or **Not run**, plus concise sanitized
evidence. Blank is not a pass.

| # | Required direct observation | Result / evidence |
|---:|---|---|
| 1 | Install/open the exact TestFlight build and visibly confirm `1.0.0 (11)` in About | _____ |
| 2 | Sign in with the owner-provisioned fictional account and select the existing fictional Active day | _____ |
| 3 | Load the day online, then force-quit, enable Airplane Mode while preserving Bluetooth, and cold-start the cached day | _____ |
| 4 | While offline, make at least three distinct order edits and confirm each remains visibly pending after relaunch | _____ |
| 5 | Connect only `M2_H-I409130491`; confirm only the individual action is present and print at least two labels one at a time | _____ |
| 6 | Physically inspect one short-name/short-drink label and one long-name/long-drink label for paper output, orientation, crop, alignment, density, readability, feed gap, smear, and damage | _____ |
| 7 | Relaunch with the offline mutations still pending; restore connectivity and observe exactly-once synchronization with no lost/duplicated edit | _____ |
| 8 | Create and resolve an order conflict once with **Use phone version** and once with **Keep server**, recording both visible results | _____ |
| 9 | Select a Planning day and a Complete day and confirm printing is refused in both states | _____ |
| 10 | Confirm success/error haptics on hardware; enable Reduce Motion and confirm the workflow remains usable without required motion | _____ |
| 11 | Deliberately interrupt one single-label print. Inspect the physical paper before choosing either **Label printed — sync only** or **Nothing printed — retry**; confirm no duplicate | _____ |
| 12 | Power-cycle the M2_H, reconnect, and complete another individual print/recovery-state check | _____ |
| 13 | Background and resume the app; confirm board, pending state, printer/reconnect state, and privacy boundary remain correct | _____ |
| 14 | Open **Advanced · Legacy link** with an approved fictional link and exercise the authenticated `/labels` fallback with fictional data | _____ |
| 15 | Independent operator repeats sign-in/day selection, individual print, physical inspection, interrupted-print decision, and fallback without the owner operating the phone, printer controls, or dashboard | _____ |

## Physical label record

| Sample | Person/drink shape | Paper emerged | Usable | Crop/alignment/density/readability | Duplicate | Photo path, fictional only |
|---|---|---:|---:|---|---:|---|
| A | short / short | _____ | _____ | _____ | _____ | _____ |
| B | long / long | _____ | _____ | _____ | _____ | _____ |
| C | interrupted print | _____ | _____ | _____ | _____ | _____ |

At least two successful labels are required. Automated image goldens verify
pixels, not paper, feed, ribbon, density, adhesion, Bluetooth acknowledgements,
or duplicate absence.

## Exactly-once and conflict record

| Observation | Local before reconnect | Hosted after reconnect | Duplicate/lost change |
|---|---|---|---|
| Offline edit 1 | _____ | _____ | _____ |
| Offline edit 2 | _____ | _____ | _____ |
| Offline edit 3 | _____ | _____ | _____ |
| Use phone version conflict | _____ | _____ | _____ |
| Keep server conflict | _____ | _____ | _____ |
| Successful print status | _____ | _____ | _____ |

Do not mutate production data for this worksheet. Use the separately approved
fictional review fixture.

## Existing uncertain print hold

The historical uncertain Operator 02 print remains unresolved. This worksheet
does not authorize clearing, synchronizing, retrying, or rewriting that record.
Only a person who inspects the corresponding physical paper may choose its
outcome. If the paper cannot be identified, leave it unresolved and record that
fact.

- Paper physically located and inspected: _____
- Direct observer: _____
- Outcome chosen, if any: _____
- If not inspected, record remains unresolved: _____

## Gate decision

- All 15 operator rows passed from direct observation: yes / no _____
- At least two individual labels physically passed: yes / no _____
- Short and long content physically passed: yes / no _____
- No duplicate produced during interrupted recovery: yes / no _____
- Firmware/ribbon/stock/inventory recorded: yes / no _____
- Independent operator passed without intervention: yes / no _____
- Sanitized evidence attached: yes / no _____

**Build 11 physical gate: PASS / FAIL / INCOMPLETE** _____

Tester name/signature/date: _____
Independent operator name/signature/date: _____
Release owner acceptance/date: _____

No automated check, screenshot, log, database row, or prior-build observation
may fill these blanks or convert **Incomplete** to **Pass**.
