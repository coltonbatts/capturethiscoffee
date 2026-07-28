// The print deck — the surface the operator returns to most.
//
// The deck answers "can I print right now?" in its own button rather than
// making the operator assemble that from separate status cards. Do not
// reintroduce a stack of co-equal status cards above it.

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../widgets/print_deck.dart';
import '../widgets/status_banners.dart';

class PrintScreen extends StatelessWidget {
  const PrintScreen({super.key});

  static const route = '/print';

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.of(context);
    final pending = controller.pendingLabels;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Print'),
        actions: [
          IconButton(
            onPressed: controller.busy ? null : () => controller.refreshBoard(),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh queue',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  if (!controller.busy) await controller.refreshBoard();
                },
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    PrintDeck(
                      productionName: controller.queue?.productionName ??
                          'Production loading',
                      statusLabel: controller.productionStatusLabel,
                      content: controller.deckContent,
                      nextUpName:
                          pending.length > 1 ? pending[1].personName : null,
                      pending: pending.length,
                      printed: controller.printedCount,
                      total: controller.totalCount,
                      syncLabel: controller.syncStatusLabel,
                      staleNotice: controller.boardUnavailableReason != null
                          ? BoardUnavailableNotice(controller: controller)
                          : controller.boardIsStale
                              ? StaleBoardNotice(controller: controller)
                              : null,
                      busy: controller.busy,
                      connected: controller.connected,
                      printing: controller.isPrinting,
                      printSuccessToken: controller.printSuccessToken,
                      block: controller.deckBlock,
                      onPrint: () {
                        final item = controller.deckLabel;
                        if (item != null) controller.printLabel(item);
                      },
                      onConnect: controller.connectPrinter,
                      onDisconnect: controller.disconnectPrinter,
                      onRefresh: () => controller.refreshBoard(),
                    ),
                    if (controller.operatorError != null)
                      OperatorErrorBanner(controller: controller),
                    InactiveProductionCard(controller: controller),
                    ActivityLog(controller: controller),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
