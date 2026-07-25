// Where the operator lands, and returns to.
//
// The rule this screen must not break:
//
//   A home screen puts a tap between the operator and the print button. The
//   deck exists precisely to collapse "can I print right now?" into one place,
//   so a menu of words in front of it would undo that. The print entry
//   therefore renders the DeckBlock state machine — count, next person, and the
//   blocking reason — and is yellow only when a print would actually succeed.
//   If it ever reads just "Print labels ›", this screen has failed.
//
// The joy is carried by motion, the smiley, and the yellow. The words stay
// deadpan — that split is the web's, and it is what keeps the app from sounding
// like it is pleased with itself at 5 AM.

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../confirmations.dart';
import '../printer_controller.dart';
import '../production_board.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/motion.dart';
import '../widgets/print_deck.dart';
import '../widgets/status_banners.dart';
import '../workspace_controller.dart';
import 'about_screen.dart';
import 'collect_screen.dart';
import 'days_screen.dart';
import 'help_sheet.dart';
import 'print_screen.dart';
import 'recovery_screen.dart';
import 'roster_screen.dart';

/// Where the print entry goes, given what is blocking it.
///
/// Go where the fix is. Sending an operator to the deck to be told a second
/// time that they cannot print is a dead end — the blocking reason should name
/// the screen that can clear it.
///
/// A free function because [DeckBlock.recoveryPending] needs a connected
/// printer to occur, which no widget test can arrange.
String printEntryDestination(DeckBlock block) =>
    block == DeckBlock.recoveryPending
        ? RecoveryScreen.route
        : PrintScreen.route;

/// Handles for the home destinations.
///
/// Keys rather than text finders because every one of these labels is dynamic —
/// the print entry reads "3 labels to print" or "Print labels" depending on the
/// queue, and a test that matched on that would be asserting the wrong thing.
const rosterEntryKey = Key('home-roster-entry');
const collectEntryKey = Key('home-collect-entry');
const recoveryEntryKey = Key('home-recovery-entry');
const printEntryKey = Key('home-print-entry');
const printerEntryKey = Key('home-printer-entry');

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final runtime = PrinterScope.runtimeOf(context);
    final controller = PrinterScope.of(context);
    final recoveries = controller.currentRecoveryRecords;
    final progress = productionBoardProgress(runtime.workspace.board);
    final boardController = runtime.board;

    // Everything printed, nothing outstanding. The one moment the app gets to
    // be pleased with itself.
    final finished = progress.total > 0 &&
        progress.needsOrder == 0 &&
        controller.pendingLabels.isEmpty &&
        recoveries.isEmpty &&
        !boardController.hasPendingMutations;

    var step = 0;

    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'On-set controller'),
        actions: [
          if (runtime.workspace.mode == WorkspaceMode.authenticated)
            IconButton(
              onPressed: () =>
                  Navigator.of(context).pushNamed(DaysScreen.route),
              icon: const Icon(Icons.calendar_today_outlined),
              tooltip: 'Switch day',
            ),
          IconButton(
            onPressed: controller.busy ? null : () => controller.refreshBoard(),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh queue',
          ),
          IconButton(
            onPressed: () => showQuickStart(context),
            icon: const Icon(Icons.help_outline),
            tooltip: 'How to use Capture This',
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
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                  children: [
                    _Hero(controller: controller, finished: finished),
                    const SizedBox(height: 28),
                    if (controller.operatorError != null ||
                        controller.failedBatchLabel != null) ...[
                      OperatorErrorBanner(controller: controller),
                      const SizedBox(height: 12),
                    ],
                    if (controller.boardUnavailableReason != null) ...[
                      BoardUnavailableNotice(controller: controller),
                      const SizedBox(height: 12),
                    ] else if (controller.boardIsStale) ...[
                      StaleBoardNotice(controller: controller),
                      const SizedBox(height: 12),
                    ],
                    CascadeIn(
                      delay: CascadeIn.step(step++),
                      child:
                          runtime.workspace.mode == WorkspaceMode.authenticated
                              ? _MenuCard(
                                  key: collectEntryKey,
                                  icon: Icons.local_cafe_outlined,
                                  title: 'Collect',
                                  detail: _collectDetail(
                                    progress,
                                    boardController.pendingMutationCount,
                                    boardController.conflictCount,
                                  ),
                                  trailing: boardController.conflictCount > 0
                                      ? const Icon(
                                          Icons.warning_amber_rounded,
                                          color: CaptureColors.danger,
                                        )
                                      : null,
                                  onTap: () => Navigator.of(context)
                                      .pushNamed(CollectScreen.route),
                                )
                              : const SizedBox.shrink(),
                    ),
                    if (runtime.workspace.mode == WorkspaceMode.authenticated)
                      const SizedBox(height: 10),
                    CascadeIn(
                      delay: CascadeIn.step(step++),
                      child: _PrintEntry(controller: controller),
                    ),
                    const SizedBox(height: 10),
                    CascadeIn(
                      delay: CascadeIn.step(step++),
                      child: _MenuCard(
                        key: rosterEntryKey,
                        icon: Icons.people_outline,
                        title: 'Roster',
                        detail: _rosterDetail(controller),
                        onTap: () =>
                            Navigator.of(context).pushNamed(RosterScreen.route),
                      ),
                    ),
                    if (recoveries.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      CascadeIn(
                        delay: CascadeIn.step(step++),
                        child: _MenuCard(
                          key: recoveryEntryKey,
                          icon: Icons.report_problem_outlined,
                          title: 'Unresolved labels',
                          detail:
                              '${recoveries.length} ${recoveries.length == 1 ? 'label needs' : 'labels need'} a check',
                          onTap: () => Navigator.of(context)
                              .pushNamed(RecoveryScreen.route),
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    CascadeIn(
                      delay: CascadeIn.step(step++),
                      child: _PrinterEntry(controller: controller),
                    ),
                    const SizedBox(height: 20),
                    CascadeIn(
                      delay: CascadeIn.step(step++),
                      child: _FooterActions(controller: controller),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _rosterDetail(PrinterController controller) {
    final total = controller.totalCount;
    if (total == 0) return 'Nobody on this production yet';
    final pending = controller.pendingLabels.length;
    final people = '$total ${total == 1 ? 'person' : 'people'}';
    if (pending == 0) return '$people · every label printed';
    return '$people · $pending to print';
  }

  String _collectDetail(
    BoardProgress progress,
    int pending,
    int conflicts,
  ) {
    if (conflicts > 0) {
      return '$conflicts ${conflicts == 1 ? 'conflict needs' : 'conflicts need'} review';
    }
    final base =
        '${progress.decided} of ${progress.total} decided · ${progress.needsOrder} need orders';
    return pending == 0 ? base : '$base · $pending pending';
  }
}

/// The mark, the day, and how fresh it is.
///
/// The smiley is centred and the day is left-aligned on purpose: the mark is
/// the ceremonial part and the data is the part you scan.
class _Hero extends StatelessWidget {
  const _Hero({required this.controller, required this.finished});

  final PrinterController controller;
  final bool finished;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final queue = controller.queue;
    final client = queue?.clientName.trim() ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: ArrivingBrandMark(
            size: finished ? 108 : 84,
            semanticLabel: finished ? 'Every label printed' : null,
          ),
        ),
        const SizedBox(height: 20),
        CascadeIn(
          delay: const Duration(milliseconds: 190),
          child: Text(
            finished
                ? 'That’s the day.'
                : (queue?.productionName ?? 'Production loading'),
            style: CaptureType.pageTitle,
          ),
        ),
        const SizedBox(height: 8),
        CascadeIn(
          delay: const Duration(milliseconds: 270),
          child: Row(
            children: [
              if (finished) ...[
                const _AllCapturedPill(),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Text(
                  [
                    if (!finished && client.isNotEmpty) client,
                    controller.syncStatusLabel,
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The only green in the product.
///
/// A second celebratory colour would make the first one mean nothing, so if
/// green appears anywhere else, that is a bug.
class _AllCapturedPill extends StatelessWidget {
  const _AllCapturedPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: CaptureColors.emeraldSurface,
        borderRadius: BorderRadius.circular(CaptureRadii.pill),
        border: Border.all(
            color: CaptureColors.onEmeraldSurface.withValues(
          alpha: 0.25,
        )),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check, size: 12, color: CaptureColors.onEmeraldSurface),
          SizedBox(width: 5),
          Text(
            'All labels printed',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: CaptureColors.onEmeraldSurface,
            ),
          ),
        ],
      ),
    );
  }
}

/// The deck's own answer, rendered as a card.
///
/// Everything here derives from [PrinterController.deckBlock] so home and the
/// deck can never disagree about whether printing is possible.
class _PrintEntry extends StatelessWidget {
  const _PrintEntry({required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pending = controller.pendingLabels;
    final block = controller.deckBlock;
    final canPrint = block == DeckBlock.none && pending.isNotEmpty;

    final String detail;
    if (controller.isPrinting) {
      detail = 'Printing — keep the app open';
    } else {
      detail = switch (block) {
        DeckBlock.disconnected => 'Printer not connected',
        DeckBlock.unavailable => 'This day is closed',
        DeckBlock.productionInactive => 'Production is not active',
        DeckBlock.recoveryPending => 'Resolve unprinted labels first',
        DeckBlock.none => pending.isEmpty
            ? 'Nothing to print'
            : 'Next: ${pending.first.personName}',
      };
    }

    final count = pending.length;
    final headline = count == 0
        ? 'Print labels'
        : '$count ${count == 1 ? 'label' : 'labels'} to print';

    return Pressable(
      child: Material(
        key: printEntryKey,
        // Yellow only when a print would actually succeed. A yellow control
        // that cannot do anything teaches the operator to distrust the colour,
        // and this is the one screen where yellow has to mean something.
        color: canPrint ? CaptureColors.yellow : CaptureColors.surface,
        borderRadius: CaptureRadii.cardBorder,
        child: InkWell(
          onTap: () =>
              Navigator.of(context).pushNamed(printEntryDestination(block)),
          borderRadius: CaptureRadii.cardBorder,
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: canPrint ? CaptureColors.ink : CaptureColors.ruleSoft,
                width: 1,
              ),
              borderRadius: CaptureRadii.cardBorder,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
            child: Row(
              children: [
                Icon(canPrint ? Icons.print : Icons.print_disabled, size: 26),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(headline, style: theme.textTheme.titleLarge),
                      const SizedBox(height: 3),
                      Text(
                        detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: canPrint
                              ? CaptureColors.ink
                              : CaptureColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Connect, disconnect, and — finally — a visible connecting state.
///
/// `PrinterStatus.connecting` has been set on every scan since the app shipped
/// and rendered nowhere, so the operator got a bare progress bar and no idea
/// what it was waiting for.
class _PrinterEntry extends StatelessWidget {
  const _PrinterEntry({required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final connecting = controller.printerStatus == PrinterStatus.connecting;
    final connected = controller.connected;

    final String detail;
    if (connecting) {
      detail = 'Looking for the M2_H…';
    } else if (connected) {
      detail = controller.connectedDeviceName ?? 'Connected';
    } else {
      detail = 'Not connected';
    }

    return _MenuCard(
      key: printerEntryKey,
      icon: connected ? Icons.bluetooth_connected : Icons.bluetooth_disabled,
      title: 'Printer',
      detail: detail,
      trailing: connecting
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(
              connected ? 'Disconnect' : 'Connect',
              style: Theme.of(context).textTheme.labelLarge,
            ),
      onTap: controller.busy
          ? null
          : () => connected
              ? controller.disconnectPrinter()
              : controller.connectPrinter(),
    );
  }
}

class _FooterActions extends StatelessWidget {
  const _FooterActions({required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final runtime = PrinterScope.runtimeOf(context);
    final authenticated = runtime.workspace.mode == WorkspaceMode.authenticated;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        TextButton(
          onPressed: controller.busy
              ? null
              : () async {
                  if (authenticated) {
                    await Navigator.of(context).pushNamed(DaysScreen.route);
                    return;
                  }
                  if (!await confirmChangeProduction(context, controller)) {
                    return;
                  }
                  await controller.clearSession();
                },
          child: Text(authenticated ? 'Switch day' : 'Change production'),
        ),
        Text('·', style: Theme.of(context).textTheme.bodySmall),
        TextButton(
          onPressed: () => Navigator.of(context).pushNamed(AboutScreen.route),
          child: const Text('About'),
        ),
        if (authenticated) ...[
          Text('·', style: Theme.of(context).textTheme.bodySmall),
          TextButton(
            onPressed: runtime.session.busy ? null : runtime.signOut,
            child: const Text('Sign out'),
          ),
        ],
      ],
    );
  }
}

class _MenuCard extends StatelessWidget {
  const _MenuCard({
    super.key,
    required this.icon,
    required this.title,
    required this.detail,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String detail;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Pressable(
      child: Material(
        color: CaptureColors.surface,
        borderRadius: CaptureRadii.cardBorder,
        child: InkWell(
          onTap: onTap,
          borderRadius: CaptureRadii.cardBorder,
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: CaptureColors.ruleSoft, width: 1),
              borderRadius: CaptureRadii.cardBorder,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
            child: Row(
              children: [
                Icon(icon, size: 22),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: theme.textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(
                        detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                trailing ?? const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
