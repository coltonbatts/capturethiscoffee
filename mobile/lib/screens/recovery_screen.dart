// Labels whose physical outcome is unresolved.
//
// The only place these decisions can be made. They used to render in three
// places at once — the deck's blocking state, a summary card, and a full tile
// per row inside the roster — and three copies of a decision that puts more ink
// on a real cup is three chances to answer it differently.
//
// What remains elsewhere are pointers, not controls: home counts them, the
// roster marks the people they belong to, and the deck refuses to print past
// them. All three lead here.
//
// The invariant enforced in print_recovery.dart holds behind all of it:
// `printedNeedsSync` can never be weakened back to `uncertain`. Paper came out
// of a printer and no sync state may contradict physical reality.

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../confirmations.dart';
import '../print_recovery.dart';
import '../printer_controller.dart';
import '../production_board.dart';
import '../theme.dart';
import '../widgets/roster_tiles.dart';
import '../widgets/status_banners.dart';

class RecoveryScreen extends StatelessWidget {
  const RecoveryScreen({super.key});

  static const route = '/recovery';

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.of(context);
    final records = controller.currentRecoveryRecords;

    return Scaffold(
      appBar: AppBar(title: const Text('Unresolved labels')),
      body: SafeArea(
        child: Column(
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                children: [
                  if (controller.operatorError != null) ...[
                    OperatorErrorBanner(controller: controller),
                    const SizedBox(height: 12),
                  ],
                  if (records.isEmpty)
                    const _AllResolved()
                  else ...[
                    // The one fact the individual rows cannot state: these are
                    // held out of the queue, so the deck's count will not add
                    // up until they are resolved.
                    Text(
                      records.length == 1
                          ? 'This label is held out of the print queue until you resolve it.'
                          : 'These ${records.length} labels are held out of the print queue until you resolve them.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    for (final record in records)
                      _RecoveryTile(controller: controller, record: record),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecoveryTile extends StatelessWidget {
  const _RecoveryTile({required this.controller, required this.record});

  final PrinterController controller;
  final PrintRecoveryRecord record;

  @override
  Widget build(BuildContext context) {
    // The ledger keeps its own copy of the person and drink precisely so a
    // record stays readable when the label has dropped off the board.
    final item = QueueLabel(
      orderId: record.orderId,
      personName: record.personName,
      drink: record.drink,
      group: '',
      status: '',
      labelPrinted: false,
    );
    final isUncertain = record.state == PrintRecoveryState.uncertain;

    return AttentionRosterTile(
      item: item,
      isUncertain: isUncertain,
      busy: controller.busy,
      onSyncOnly: () => isUncertain
          ? controller.confirmUncertainLabelPrinted(item)
          : controller.syncPrintedLabel(item),
      onRetry: () async {
        if (!await confirmRetryUncertain(context, item)) return;
        await controller.retryUncertainPrint(item);
      },
    );
  }
}

class _AllResolved extends StatelessWidget {
  const _AllResolved();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Column(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: CaptureColors.yellow,
              shape: BoxShape.circle,
            ),
            child: const Text(
              ':)',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: CaptureColors.ink,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Nothing to resolve', style: theme.textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            'Every label that printed has synced.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
