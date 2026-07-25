// Status surfaces shared by more than one screen.
//
// Moved out of main.dart when the app gained a route stack: the error banner in
// particular has to be able to appear wherever the failing action was taken,
// and a copy per screen would drift.

import 'package:flutter/material.dart';

import '../printer_controller.dart';
import '../theme.dart';

/// Every failure in the app funnels through here.
///
/// That is a known weakness, not a design: a URL typo and a Bluetooth scan
/// timeout render identically. Field-level validation is scheduled to move onto
/// the input it belongs to.
class OperatorErrorBanner extends StatelessWidget {
  const OperatorErrorBanner({super.key, required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final message = controller.operatorError;
    final failedBatchLabel = controller.failedBatchLabel;
    if (message == null && failedBatchLabel == null) {
      return const SizedBox.shrink();
    }

    return Material(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(CaptureRadii.control),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.warning_amber),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (failedBatchLabel != null)
                    Text(
                      'Batch stopped at: $failedBatchLabel',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  if (message != null) Text(message),
                ],
              ),
            ),
            IconButton(
              onPressed: controller.dismissError,
              icon: const Icon(Icons.close),
              tooltip: 'Dismiss error',
            ),
          ],
        ),
      ),
    );
  }
}

/// Loud, not small print.
///
/// The dangerous case is not an empty app — that is obvious. It is a full,
/// normal-looking roster that silently predates someone changing their order.
///
/// No longer full-strength yellow. That was written when the deck's print
/// action was ink, and the two have been competing ever since: yellow means
/// "the action you came to take", and a warning is not an action. A hairline
/// surface with the cloud icon carries it without claiming to be pressable.
class StaleBoardNotice extends StatelessWidget {
  const StaleBoardNotice({super.key, required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final age = controller.boardAgeLabel;

    return _NoticeSurface(
      icon: Icons.cloud_off,
      title: 'Working offline',
      body: age == null
          ? 'This roster has not been synced.'
          : 'This roster is from $age. Orders captured since then are not '
              'shown. Printing still works.',
      theme: theme,
    );
  }
}

/// The server answered, and said no.
///
/// Separate from [StaleBoardNotice] because the two mean opposite things. Stale
/// says the roster is old but true, and printing it is the point of the cache.
/// This says the roster may describe a day that is over — the case where the
/// app used to report "Working offline" over a finished production and keep
/// printing, because the cached status still read `active`.
class BoardUnavailableNotice extends StatelessWidget {
  const BoardUnavailableNotice({super.key, required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    return _NoticeSurface(
      icon: Icons.event_busy,
      title: 'This day is closed',
      body: 'The server will not open this production any more. It may have '
          'been completed, or its link revoked. Printing is stopped. Anything '
          'on screen is the last roster this iPhone saw.',
      theme: Theme.of(context),
      emphasised: true,
    );
  }
}

class _NoticeSurface extends StatelessWidget {
  const _NoticeSurface({
    required this.icon,
    required this.title,
    required this.body,
    required this.theme,
    this.emphasised = false,
  });

  final IconData icon;
  final String title;
  final String body;
  final ThemeData theme;

  /// Draws the ink rule rather than the hairline. Reserved for the states an
  /// operator must not read past.
  final bool emphasised;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: CaptureColors.surface,
        border: Border.all(
          color: emphasised ? CaptureColors.ink : CaptureColors.rule,
          width: 1,
        ),
        borderRadius: CaptureRadii.cardBorder,
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: theme.textTheme.titleSmall),
                  const SizedBox(height: 2),
                  Text(body, style: theme.textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class InactiveProductionCard extends StatelessWidget {
  const InactiveProductionCard({super.key, required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final queue = controller.queue;
    if (queue == null || queue.isProductionActive) {
      return const SizedBox.shrink();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.pause_circle, color: Colors.deepOrange),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Printing paused',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    'This production is ${queue.productionStatus}. Ask the coordinator to mark it Active, then refresh the queue.',
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

/// Diagnostics, not furniture.
///
/// This was permanently expanded at the bottom of the primary work surface; it
/// is still one tap away when a print goes wrong, which is the only time anyone
/// reads it. It lives with the print screen for the same reason.
class ActivityLog extends StatelessWidget {
  const ActivityLog({super.key, required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final entries = controller.log.take(10).toList();

    return Card(
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: Text('Recent activity', style: theme.textTheme.titleMedium),
          subtitle: Text(
            entries.isEmpty ? 'No activity yet' : '${entries.length} recent',
            style: theme.textTheme.bodySmall,
          ),
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final entry in entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(entry, style: CaptureType.mono),
              ),
          ],
        ),
      ),
    );
  }
}
