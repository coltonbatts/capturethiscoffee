# Native single-label print hardening

Scope: native Flutter M2_H single-label workflow. The exact `niim_blue_flutter: 1.0.1` dependency and lockfile are unchanged. No Next.js code changed.

## Transition trace

| Boundary | Behavior and failure handling |
|---|---|
| Print deck / roster tap | `print_screen.dart` and `roster_screen.dart` call `PrinterController.printLabel`. Roster reprints require the existing confirmation dialog. The controller acquires its lock synchronously; concurrent print, connect, sync and recovery actions cannot enter. |
| Eligibility and rendering | Require the selected active day, an available board, connection, loaded recovery storage, current order and no unresolved recovery. Render the existing template locally, retaining 567-dot width, density 3, gap stock and emergency text overlay. Capture workspace identity and check it again after rendering and persistence. |
| Before transmission | Persist `uncertain` before invoking the transport. Rejected writes, including native preferences returning false, abort printing. Legacy ledger changes are serialized and published in memory only after successful persistence, matching the shared outbox. |
| Bluetooth | Injectable `PrinterTransport`; the production adapter retains M2_H name/model validation, B1 fallback, packet interval 15, one total page and quantity one. Initialization, page transmission and finish polling are separate awaited phases. Disconnect invalidates the sequence before awaiting teardown, preventing later phases and heartbeat restart from a stale sequence. |
| Timeout / disconnect / lifecycle | The 60-second print timeout retains uncertainty and disconnects. Reconnect is refused while the original transport future or disconnect teardown remains outstanding. A late completion cannot record success or sync. Pause/detach disconnects; resume never retransmits. Resume verification uses the same action lock. Disposal during rendering prevents transmission. |
| Physical outcome | Successful finish polling permits durable `printedNeedsSync`. If that write fails, retain the earlier uncertain record and explicitly tell the operator not to reprint. Protocol completion is not independent proof that usable paper physically emerged. |
| Server sync | Call `WorkspaceController.markLabelPrinted` with the original scope/day. It checks identity before dispatch and generation after the await. Authenticated mode uses the existing board/outbox replay for confirmed prints; legacy mode calls the existing API. Failure retains recovery. Uncertain prints are never automatically replayed. |
| Cleanup | Clear recovery only following acknowledged sync or a fresh server-confirmed fact for a locally confirmed print. An old server printed flag cannot erase an uncertain reprint. Failed cleanup retains evidence and background reconciliation catches its error. |
| Operator recovery | `recovery_screen.dart` routes printed confirmation/sync and explicitly confirmed “Nothing printed” retry. Both execute inside the same lock. Sync-only actions make no transport calls. Retry is rejected for confirmed prints and requires a connection before clearing uncertainty. Scope is checked again after the clear. |
| Restart | Load legacy recovery or the shared outbox before enabling order printing. Invalid JSON, invalid rows, duplicate order IDs and invalid states fail the entire read rather than silently dropping evidence. Preserve the original bytes. An uncertain record continues to require inspection. An empty v2 outbox remains authoritative over migrated v1 evidence. |

## Automatically demonstrated

`flutter analyze --no-pub` and the full `flutter test --no-pub` suite pass (236 tests). New tests supplement the existing recovery, mutation outbox, authenticated flow, offline startup and rendering suites:

- `printer_failure_boundaries_test.dart`: rejected preflight, physical-confirmation and cleanup writes; restart; shared-outbox rollback; serialized mutations; corrupt storage; Bluetooth failure; timeout and late success; double taps and recovery races; background/resume; disconnect; disposal; workspace switch; uncertain reprint with an old server printed flag; failed retry cleanup; server failure; sync-only packet/task count.
- `printer_transport_test.dart`: failures at init/page/finish, disconnect followed by late completion at each phase, no subsequent phase or heartbeat after invalidation, one-page/quantity/density/stock options.
- `recovery_preferences_write_failure_test.dart`: actual preferences method-channel false results reject legacy recording and cleanup and shared-outbox cleanup.

Transport fakes count print-task invocations; adapter tests count protocol phases. These are not Bluetooth radio captures. The pinned library can already be inside a multi-packet `sendAll` when disconnected; Dart cannot retract bytes handed to the plugin or printer. Guarding later phases and preventing reconnect while the task is outstanding limits that risk without claiming packet cancellation.

## Physical acceptance remains incomplete

Use `build-13-physical-acceptance-worksheet-2026-07-30.md` for the actual installed candidate; record the build containing these changes. No worksheet row is marked passed by this work. In particular, physically verify:

- Interrupt at initialization, data transfer and feed/completion; inspect paper before choosing either recovery action.
- Background, resume, power-cycle, force-quit and restart mid-print and after paper emerges but before sync. Confirm no unintended second label.
- Restore network and perform sync-only recovery with no printer activity; verify the correct server order and eventual cleanup.
- Exercise rapid taps and an eventual late completion after timeout; reconnect only when allowed.
- Complete the worksheet's template, crop, feed, density, readability, adhesion, haptic and independent-operator gates on the designated iPhone/M2_H and stock.

Preferences API success is the application's persistence acknowledgement, not a hardware power-loss/fsync guarantee. Corrupt storage intentionally blocks order printing; do not erase it to bypass inspection.
