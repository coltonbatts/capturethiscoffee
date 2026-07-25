// Everyone on the day, and what they are drinking.
//
// The controls are pinned and the list scrolls under them, so search and the
// filters stay reachable forty names deep.

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../confirmations.dart';
import '../printer_controller.dart';
import '../production_board.dart';
import '../widgets/roster_section.dart';
import '../widgets/roster_tiles.dart';
import '../widgets/status_banners.dart';
import 'recovery_screen.dart';

class RosterScreen extends StatefulWidget {
  const RosterScreen({super.key});

  static const route = '/roster';

  @override
  State<RosterScreen> createState() => _RosterScreenState();
}

class _RosterScreenState extends State<RosterScreen> {
  final _searchController = TextEditingController();

  /// Which row is open, by order id.
  ///
  /// One at a time. Letting several stand open turns a dense list back into the
  /// card-per-person layout this deliberately replaced, one tap at a time.
  String? _expandedOrderId;

  bool _seeded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The query lives on the controller so it survives leaving the screen; the
    // field has to be told about it on the way back in. Seeded here rather than
    // in initState because reading an InheritedWidget is illegal there, and
    // seeded once because this runs again on every controller notification —
    // re-assigning would fight the operator's cursor as they type.
    if (_seeded) return;
    _seeded = true;
    _searchController.text = PrinterScope.of(context).rosterQuery;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.of(context);
    final labels = controller.visibleLabels;
    final canPrint =
        !controller.busy && controller.queue?.isProductionActive == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Roster'),
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
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Column(
                children: [
                  if (controller.operatorError != null ||
                      controller.failedBatchLabel != null) ...[
                    OperatorErrorBanner(controller: controller),
                    const SizedBox(height: 12),
                  ],
                  RosterControls(
                    filter: controller.rosterFilter,
                    onFilterChanged: controller.setRosterFilter,
                    searchController: _searchController,
                    onQueryChanged: controller.setRosterQuery,
                    query: controller.rosterQuery,
                    busy: controller.busy,
                    counts: controller.rosterCounts,
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  if (!controller.busy) await controller.refreshBoard();
                },
                child: labels.isEmpty
                    // Still scrollable, so pull-to-refresh works on an empty
                    // list — which is exactly when the operator reaches for it.
                    ? ListView(
                        children: [
                          RosterEmptyState(
                            filter: controller.rosterFilter,
                            query: controller.rosterQuery,
                            queueLoaded: controller.queue != null,
                          ),
                        ],
                      )
                    : ListView.builder(
                        // Built lazily. The board caps at 1000 entries, and the
                        // previous Column built every row on every frame.
                        itemCount: labels.length,
                        itemBuilder: (context, index) => _row(
                          controller,
                          labels[index],
                          isLast: index == labels.length - 1,
                          canPrint: canPrint,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(
    PrinterController controller,
    QueueLabel item, {
    required bool isLast,
    required bool canPrint,
  }) {
    // A label with an unresolved physical outcome shows up here, but its
    // resolution lives on one screen only. See RecoveryPointerRow.
    if (labelNeedsAttention(controller, item)) {
      return RecoveryPointerRow(
        item: item,
        isLast: isLast,
        isUncertain: labelIsUncertain(controller, item),
        onOpenRecovery: () =>
            Navigator.of(context).pushNamed(RecoveryScreen.route),
      );
    }

    return RosterTile(
      item: item,
      isLast: isLast,
      expanded: _expandedOrderId == item.orderId,
      canPrint: canPrint,
      onToggle: () => setState(() {
        _expandedOrderId =
            _expandedOrderId == item.orderId ? null : item.orderId;
      }),
      onPrint: () async {
        if (item.labelPrinted) {
          if (!await confirmReprint(context, item)) return;
        }
        await controller.printLabel(item);
      },
    );
  }
}
