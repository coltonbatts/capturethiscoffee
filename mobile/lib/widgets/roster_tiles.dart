// Roster rows.
//
// Dense by default, because a forty-person call sheet is the normal case and
// the card-per-person layout this replaced fit three on screen. Tapping a row
// expands it in place to the web's `RosterCard` treatment — avatar, large name,
// role line, and the drink on its own slab — so the detail is available for the
// one person you are looking at without costing you the other thirty-nine.
//
// Rows that need a decision about a physical label are never collapsed. Those
// are rare, and getting one wrong reprints a label onto a real cup.

import 'package:flutter/material.dart';

import '../print_recovery.dart';
import '../printer_controller.dart';
import '../production_board.dart';
import '../theme.dart';
import 'motion.dart';

/// The full-height bar down the left edge of a row.
///
/// Ported from the web's `RosterCard`, narrowed from 6px to 3px for the denser
/// list. Only two states exist here: the print queue contains captured orders
/// only, so there is no "no drink" row to grey out.
Color _railColor(QueueLabel item) =>
    item.labelPrinted ? CaptureColors.ink : CaptureColors.amber;

/// A dense row. Tap to expand.
class RosterTile extends StatelessWidget {
  const RosterTile({
    super.key,
    required this.item,
    required this.isLast,
    required this.expanded,
    required this.canPrint,
    required this.onToggle,
    required this.onPrint,
  });

  final QueueLabel item;
  final bool isLast;
  final bool expanded;
  final bool canPrint;
  final VoidCallback onToggle;
  final VoidCallback onPrint;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isLast ? Colors.transparent : CaptureColors.ruleSoft,
            width: 1,
          ),
        ),
      ),
      child: InkWell(
        onTap: onToggle,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: _railColor(item)),
              Expanded(
                child: AnimatedSize(
                  duration: motionDuration(context, CaptureMotion.fast),
                  curve: CaptureMotion.ease,
                  alignment: Alignment.topCenter,
                  child: expanded
                      ? _Expanded(
                          item: item,
                          canPrint: canPrint,
                          onPrint: onPrint,
                        )
                      : _Collapsed(
                          item: item,
                          canPrint: canPrint,
                          onPrint: onPrint,
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Collapsed extends StatelessWidget {
  const _Collapsed({
    required this.item,
    required this.canPrint,
    required this.onPrint,
  });

  final QueueLabel item;
  final bool canPrint;
  final VoidCallback onPrint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isPrinted = item.labelPrinted;

    // `status` is deliberately not shown. It carries the legacy OrderStatus
    // enum (`confirmed`, `ordered`, …) and the product exposes only
    // needs-order / captured / no-drink — printing "confirmed" next to a
    // person's name leaks a database detail as if it meant something.
    final secondary = [item.drink.trim(), item.group.trim()]
        .where((part) => part.isNotEmpty)
        .join(' · ');

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.personName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: isPrinted ? CaptureColors.faint : null,
                    decoration: isPrinted ? TextDecoration.lineThrough : null,
                  ),
                ),
                if (secondary.isNotEmpty)
                  Text(
                    secondary,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: canPrint ? onPrint : null,
            icon: Icon(isPrinted ? Icons.replay : Icons.print),
            tooltip: isPrinted
                ? 'Reprint ${item.personName}'
                : 'Print ${item.personName}',
          ),
        ],
      ),
    );
  }
}

/// The web's `RosterCard`, opened in place.
class _Expanded extends StatelessWidget {
  const _Expanded({
    required this.item,
    required this.canPrint,
    required this.onPrint,
  });

  final QueueLabel item;
  final bool canPrint;
  final VoidCallback onPrint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isPrinted = item.labelPrinted;
    final roleLine = item.roleLine;

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _InitialsAvatar(initials: item.initials, dimmed: isPrinted),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.personName,
                      style: CaptureType.rowName.copyWith(
                        color: isPrinted ? CaptureColors.faint : null,
                      ),
                    ),
                    if (roleLine.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(roleLine, style: theme.textTheme.bodySmall),
                    ],
                  ],
                ),
              ),
              if (isPrinted) const _PrintedChip(),
            ],
          ),
          const SizedBox(height: 12),

          // The drink on its own slab — the web's inset panel. It is the one
          // thing on this row that ends up on paper, so it gets its own field.
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: CaptureColors.surfaceMuted,
              borderRadius: CaptureRadii.controlBorder,
              border: Border.all(color: CaptureColors.ruleSoft, width: 1),
            ),
            child: Text(
              item.drink.trim().isEmpty ? '—' : item.drink,
              style: theme.textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 12),

          if (isPrinted)
            OutlinedButton.icon(
              onPressed: canPrint ? onPrint : null,
              icon: const Icon(Icons.replay, size: 18),
              label: const Text('Reprint label'),
            )
          else
            FilledButton.icon(
              onPressed: canPrint ? onPrint : null,
              icon: const Icon(Icons.print, size: 18),
              label: const Text('Print this label'),
            ),
        ],
      ),
    );
  }
}

/// The web's `AvatarFallback`: a solid ink disc with white initials.
///
/// Initials only, no photograph. The board carries a photo URL, but it is a
/// signed URL that expires in an hour, and this app is built to work from a
/// cache on a stage with no signal — a grid of broken images is worse than no
/// images. Faces matter when handing someone a cup, not when printing a label.
class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({required this.initials, required this.dimmed});

  final String initials;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: dimmed ? CaptureColors.faint : CaptureColors.ink,
        shape: BoxShape.circle,
      ),
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _PrintedChip extends StatelessWidget {
  const _PrintedChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(CaptureRadii.pill),
        border: Border.all(color: CaptureColors.rule, width: 1),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check, size: 12, color: CaptureColors.muted),
          SizedBox(width: 4),
          Text(
            'Printed',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: CaptureColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}

/// A roster row for a label whose physical outcome is unresolved.
///
/// A pointer, not a control. The buttons that resolve one of these live on the
/// recovery screen and nowhere else — this state used to render in three places
/// at once, and three copies of a decision that reprints onto a real cup is
/// three chances to answer it differently.
///
/// It still appears here because an operator searching for a name has to find
/// that name, and "there is something wrong with Alex's label" is exactly what
/// they need the roster to tell them.
class RecoveryPointerRow extends StatelessWidget {
  const RecoveryPointerRow({
    super.key,
    required this.item,
    required this.isLast,
    required this.isUncertain,
    required this.onOpenRecovery,
  });

  final QueueLabel item;
  final bool isLast;
  final bool isUncertain;
  final VoidCallback onOpenRecovery;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isLast ? Colors.transparent : CaptureColors.ruleSoft,
            width: 1,
          ),
        ),
      ),
      child: InkWell(
        onTap: onOpenRecovery,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: CaptureColors.zinc400),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.personName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleSmall,
                            ),
                            Text(
                              isUncertain
                                  ? 'Needs a physical check'
                                  : 'Printed — needs sync',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        isUncertain ? Icons.help_outline : Icons.cloud_upload,
                        size: 18,
                        color: CaptureColors.muted,
                      ),
                      const SizedBox(width: 6),
                      const Icon(
                        Icons.chevron_right,
                        size: 18,
                        color: CaptureColors.muted,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A row awaiting a decision about a physical label.
///
/// Lives on the recovery screen only. The two buttons are not symmetrical in
/// consequence: "sync only" records reality, "retry" puts more ink on more
/// paper. The wording carries that.
class AttentionRosterTile extends StatelessWidget {
  const AttentionRosterTile({
    super.key,
    required this.item,
    required this.isUncertain,
    required this.busy,
    required this.onSyncOnly,
    required this.onRetry,
  });

  final QueueLabel item;
  final bool isUncertain;
  final bool busy;
  final VoidCallback onSyncOnly;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: CaptureColors.ink, width: 1),
          borderRadius: CaptureRadii.cardBorder,
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      item.personName,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  Chip(
                    visualDensity: VisualDensity.compact,
                    avatar: Icon(
                      isUncertain ? Icons.help : Icons.cloud_upload,
                      size: 16,
                    ),
                    label: Text(isUncertain ? 'Check printer' : 'Sync only'),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(item.drink, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 8),
              Text(
                isUncertain
                    ? 'A Bluetooth error occurred after printing started. Check whether a usable label came out before choosing an action.'
                    : 'The physical label printed, but the web status did not sync. Do not print it again.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: CaptureColors.ink,
                ),
              ),
              const SizedBox(height: 12),
              if (isUncertain) ...[
                FilledButton.icon(
                  onPressed: busy ? null : onSyncOnly,
                  icon: const Icon(Icons.cloud_upload),
                  label: const Text('Label printed — sync only'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: busy ? null : onRetry,
                  icon: const Icon(Icons.replay),
                  label: const Text('Nothing printed — retry'),
                ),
              ] else
                FilledButton.icon(
                  onPressed: busy ? null : onSyncOnly,
                  icon: const Icon(Icons.cloud_upload),
                  label: const Text('Sync only'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// True when this label is waiting on a physical check or a stuck sync.
bool labelNeedsAttention(PrinterController controller, QueueLabel item) =>
    controller.recoveryFor(item.orderId) != null;

bool labelIsUncertain(PrinterController controller, QueueLabel item) =>
    controller.recoveryFor(item.orderId)?.state == PrintRecoveryState.uncertain;
