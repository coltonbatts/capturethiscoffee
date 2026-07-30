import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_scope.dart';
import '../day_summary.dart';
import '../production_board.dart';
import '../theme.dart';
import '../workspace_repository.dart';

const summaryShareChannel = MethodChannel(
  'com.capturethis.ctcprinter/summary-share',
);

const summaryCloseoutButtonKey = Key('summary-closeout-button');
const summaryShareButtonKey = Key('summary-share-button');

class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});

  static const route = '/summary';

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  bool _closing = false;
  String? _closeoutError;

  @override
  Widget build(BuildContext context) {
    final runtime = PrinterScope.runtimeOf(context);
    final board = runtime.workspace.board;
    if (board == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Summary')),
        body: const Center(child: Text('Select a day to view its summary.')),
      );
    }

    final summary = buildDayOperatingSummary(board);
    final closeoutBlock = closeoutBlockReason(
      board: board,
      pendingMutations: runtime.board.pendingMutationCount,
      conflicts: runtime.board.conflictCount,
      servingCachedBoard: runtime.board.servingCachedBoard,
      syncBlockedReason: runtime.board.syncBlockedReason,
      recoveryCount: runtime.printer.currentRecoveryRecords.length,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Summary'),
        actions: [
          IconButton(
            key: summaryShareButtonKey,
            onPressed: () => _share(summary),
            tooltip: 'Share day summary',
            icon: const Icon(Icons.ios_share_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: runtime.workspace.refreshBoard,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text(summary.production.name, style: CaptureType.pageTitle),
              if (summary.production.clientName.trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  summary.production.clientName,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
              const SizedBox(height: 20),
              _ProgressStrip(summary: summary),
              const SizedBox(height: 28),
              const _SectionTitle(
                eyebrow: 'COFFEE SHOP',
                title: 'Grouped order',
              ),
              const SizedBox(height: 10),
              if (summary.coffeeShop.isEmpty)
                const _EmptyCard(
                  text: 'No captured drinks yet. Collect orders first.',
                )
              else
                for (final line in summary.coffeeShop) ...[
                  _CoffeeShopLine(line: line),
                  const SizedBox(height: 8),
                ],
              const SizedBox(height: 20),
              const _SectionTitle(
                eyebrow: 'ON SET',
                title: 'By person',
              ),
              const SizedBox(height: 10),
              if (summary.people.isEmpty)
                const _EmptyCard(text: 'Nobody is on set for this day.')
              else
                for (final person in summary.people) ...[
                  _PersonLine(person: person),
                  const SizedBox(height: 8),
                ],
              const SizedBox(height: 20),
              _CloseoutCard(
                status: summary.production.status,
                blockReason: closeoutBlock,
                error: _closeoutError,
                closing: _closing,
                onCloseout: closeoutBlock == null && !_closing
                    ? () => _confirmAndClose(summary)
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _share(DayOperatingSummary summary) async {
    try {
      await summaryShareChannel.invokeMethod<void>(
        'shareText',
        {'text': buildDaySummaryShareText(summary)},
      );
    } on PlatformException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('The iOS share sheet could not open.')),
      );
    } on MissingPluginException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sharing is available on iPhone.')),
      );
    }
  }

  Future<void> _confirmAndClose(DayOperatingSummary summary) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Complete this day?'),
        content: Text(
          '${summary.progress.total} on-set people are decided and '
          '${summary.progress.printed} captured labels are printed. '
          'Completion is permanent and Collect and Print will become read-only.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep day active'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Complete day'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final runtime = PrinterScope.runtimeOf(context);
    final repository = runtime.board.repository;
    final productionId = runtime.workspace.selectedDayId;
    if (repository == null || productionId == null) return;

    setState(() {
      _closing = true;
      _closeoutError = null;
    });
    try {
      await repository.completeDay(productionId: productionId);
      await runtime.workspace.refreshBoard();
      await runtime.workspace.refreshDays(silent: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Day completed.')),
      );
    } on WorkspaceRepositoryException catch (error) {
      await runtime.workspace.refreshBoard(silent: true);
      if (!mounted) return;
      setState(() => _closeoutError = error.message);
    } finally {
      if (mounted) setState(() => _closing = false);
    }
  }
}

String? closeoutBlockReason({
  required ProductionBoard board,
  required int pendingMutations,
  required int conflicts,
  required bool servingCachedBoard,
  required String? syncBlockedReason,
  required int recoveryCount,
}) {
  if (board.production.status == 'complete') return 'This day is complete.';
  if (board.production.status != 'active') {
    return 'Only an Active day can be completed.';
  }
  if (servingCachedBoard) {
    return 'Closeout needs a current online connection. Collect and Print stay available offline.';
  }
  if (syncBlockedReason != null) return syncBlockedReason;
  if (conflicts > 0) {
    return 'Resolve every order conflict before closeout.';
  }
  if (pendingMutations > 0) {
    return 'Sync every pending order change before closeout.';
  }
  if (recoveryCount > 0) {
    return 'Resolve every uncertain print before closeout.';
  }
  final progress = productionBoardProgress(board);
  if (progress.needsOrder > 0) {
    return '${progress.needsOrder} on-set '
        '${progress.needsOrder == 1 ? 'person is' : 'people are'} still waiting for an order decision.';
  }
  final unprinted = progress.captured - progress.printed;
  if (unprinted > 0) {
    return '$unprinted captured ${unprinted == 1 ? 'label is' : 'labels are'} not printed yet.';
  }
  return null;
}

class _ProgressStrip extends StatelessWidget {
  const _ProgressStrip({required this.summary});

  final DayOperatingSummary summary;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Captured', summary.progress.captured),
      ('Printed', summary.progress.printed),
      ('Waiting', summary.progress.needsOrder),
    ];
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CaptureColors.ink,
        borderRadius: BorderRadius.circular(CaptureRadii.card),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        child: Row(
          children: [
            for (var index = 0; index < items.length; index++) ...[
              if (index > 0)
                Container(
                  width: 1,
                  height: 38,
                  color: CaptureColors.paper.withValues(alpha: 0.18),
                ),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      '${items[index].$2}',
                      style: CaptureType.pageTitle.copyWith(
                        color: CaptureColors.paper,
                      ),
                    ),
                    Text(
                      items[index].$1,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: CaptureColors.paper.withValues(alpha: 0.72),
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.eyebrow, required this.title});

  final String eyebrow;
  final String title;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(eyebrow, style: CaptureType.eyebrow),
          const SizedBox(height: 3),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
        ],
      );
}

class _CoffeeShopLine extends StatelessWidget {
  const _CoffeeShopLine({required this.line});

  final CoffeeShopSummaryLine line;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: _cardDecoration(),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                color: CaptureColors.yellow,
                child: Text(
                  '${line.count}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(line.drink,
                        style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text(
                      line.people.join(', '),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

class _PersonLine extends StatelessWidget {
  const _PersonLine({required this.person});

  final PersonSummaryLine person;

  @override
  Widget build(BuildContext context) {
    final icon = switch (person.state) {
      PersonSummaryState.waiting => Icons.schedule,
      PersonSummaryState.captured => Icons.receipt_long_outlined,
      PersonSummaryState.printed => Icons.check_circle,
      PersonSummaryState.noDrink => Icons.remove_circle_outline,
    };
    final color = switch (person.state) {
      PersonSummaryState.waiting => CaptureColors.danger,
      PersonSummaryState.captured => CaptureColors.ink,
      PersonSummaryState.printed => CaptureColors.onEmeraldSurface,
      PersonSummaryState.noDrink => CaptureColors.muted,
    };
    return DecoratedBox(
      decoration: _cardDecoration(),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(person.name,
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(
                    '${person.group} · ${person.drink}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    person.stateLabel,
                    style: Theme.of(context)
                        .textTheme
                        .labelMedium
                        ?.copyWith(color: color),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: _cardDecoration(),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(text),
        ),
      );
}

class _CloseoutCard extends StatelessWidget {
  const _CloseoutCard({
    required this.status,
    required this.blockReason,
    required this.error,
    required this.closing,
    required this.onCloseout,
  });

  final String status;
  final String? blockReason;
  final String? error;
  final bool closing;
  final VoidCallback? onCloseout;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: CaptureColors.surfaceMuted,
          border: Border.all(color: CaptureColors.rule),
          borderRadius: BorderRadius.circular(CaptureRadii.card),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('CLOSEOUT', style: CaptureType.eyebrow),
              const SizedBox(height: 5),
              Text(
                status == 'complete' ? 'Day complete' : 'Complete this day',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 7),
              Text(
                blockReason ??
                    'Every on-set person is decided and every captured label is printed. Closeout requires the server and cannot be undone.',
              ),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(
                  error!,
                  style: const TextStyle(color: CaptureColors.danger),
                ),
              ],
              if (status != 'complete') ...[
                const SizedBox(height: 14),
                FilledButton(
                  key: summaryCloseoutButtonKey,
                  onPressed: onCloseout,
                  child: closing
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Complete day'),
                ),
              ],
            ],
          ),
        ),
      );
}

BoxDecoration _cardDecoration() => BoxDecoration(
      color: CaptureColors.paper,
      border: Border.all(color: CaptureColors.rule),
      borderRadius: BorderRadius.circular(CaptureRadii.card),
    );
