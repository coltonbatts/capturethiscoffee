import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/motion.dart';
import '../workspace_models.dart';

class DaysScreen extends StatelessWidget {
  const DaysScreen({
    super.key,
    this.popAfterSelection = false,
  });

  static const route = '/days';

  final bool popAfterSelection;

  @override
  Widget build(BuildContext context) {
    final runtime = PrinterScope.runtimeOf(context);
    final workspace = runtime.workspace;
    final grouped = workspace.groupedDays;

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: popAfterSelection,
        title: const BrandAppBarTitle(detail: 'Days'),
        actions: [
          IconButton(
            onPressed: workspace.busy ? null : () => workspace.refreshDays(),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh days',
          ),
          IconButton(
            onPressed: runtime.session.busy
                ? null
                : () async {
                    await runtime.signOut();
                    if (context.mounted && popAfterSelection) {
                      Navigator.of(context).popUntil((route) => route.isFirst);
                    }
                  },
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (workspace.loadingDays || workspace.busy)
              const LinearProgressIndicator(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => workspace.refreshDays(),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 22, 16, 40),
                  children: [
                    Text('Choose a day', style: CaptureType.pageTitle),
                    const SizedBox(height: 8),
                    Text(
                      'Existing workspace days only. Setup stays read-only in this build.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    if (workspace.error != null) ...[
                      const SizedBox(height: 16),
                      _WorkspaceMessage(
                        message: workspace.error!,
                        onDismiss: workspace.dismissError,
                      ),
                    ],
                    const SizedBox(height: 28),
                    if (workspace.days.isEmpty && !workspace.loadingDays)
                      const _EmptyDays()
                    else ...[
                      if (grouped.active.isNotEmpty)
                        _DaySection(
                          title: 'ACTIVE',
                          days: grouped.active,
                          selectedDayId: workspace.selectedDayId,
                          onSelected: (id) => _select(context, id),
                        ),
                      if (grouped.planning.isNotEmpty)
                        _DaySection(
                          title: 'UPCOMING / PLANNING',
                          days: grouped.planning,
                          selectedDayId: workspace.selectedDayId,
                          onSelected: (id) => _select(context, id),
                        ),
                      if (grouped.complete.isNotEmpty)
                        _DaySection(
                          title: 'RECENT / COMPLETE',
                          days: grouped.complete,
                          selectedDayId: workspace.selectedDayId,
                          onSelected: (id) => _select(context, id),
                        ),
                    ],
                    const SizedBox(height: 20),
                    Center(
                      child: TextButton.icon(
                        onPressed: workspace.busy ? null : runtime.enterLegacy,
                        icon: const Icon(Icons.link, size: 18),
                        label: const Text('Advanced · Legacy link'),
                      ),
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

  Future<void> _select(BuildContext context, String id) async {
    final runtime = PrinterScope.runtimeOf(context);
    final selected = await runtime.workspace.selectDay(id);
    if (!context.mounted || !selected) return;
    if (popAfterSelection) Navigator.of(context).pop();
  }
}

class _DaySection extends StatelessWidget {
  const _DaySection({
    required this.title,
    required this.days,
    required this.selectedDayId,
    required this.onSelected,
  });

  final String title;
  final List<DaySummary> days;
  final String? selectedDayId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: CaptureType.eyebrow),
          const SizedBox(height: 10),
          for (final day in days)
            _DayCard(
              day: day,
              selected: day.id == selectedDayId,
              onTap: () => onSelected(day.id),
            ),
        ],
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.day,
    required this.selected,
    required this.onTap,
  });

  final DaySummary day;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final date = day.shootDate;
    final detail = [
      if (date != null) _dateLabel(date),
      if (day.clientName.isNotEmpty) day.clientName,
    ].join(' · ');
    final capture = '${day.decided} of ${day.total} decided';
    final print = '${day.printed} of ${day.printable} labels printed';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Pressable(
        child: Material(
          color: CaptureColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: CaptureRadii.cardBorder,
            side: BorderSide(
              color: selected ? CaptureColors.ink : CaptureColors.ruleSoft,
              width: selected ? 2 : 1,
            ),
          ),
          child: InkWell(
            key: Key('day-${day.id}'),
            onTap: onTap,
            borderRadius: CaptureRadii.cardBorder,
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 4,
                    decoration: BoxDecoration(
                      color: selected
                          ? CaptureColors.yellow
                          : _statusColor(day.status),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(CaptureRadii.card),
                        bottomLeft: Radius.circular(CaptureRadii.card),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 15, 10, 15),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(day.name, style: CaptureType.rowName),
                          if (detail.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              detail,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                          const SizedBox(height: 14),
                          _ProgressLine(
                            label: capture,
                            value: day.capturePercent / 100,
                          ),
                          const SizedBox(height: 8),
                          _ProgressLine(
                            label: print,
                            value: day.printPercent / 100,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(right: 12),
                    child: Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProgressLine extends StatelessWidget {
  const _ProgressLine({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 4),
        LinearProgressIndicator(
          value: value.clamp(0, 1),
          minHeight: 3,
          borderRadius: BorderRadius.circular(2),
        ),
      ],
    );
  }
}

class _WorkspaceMessage extends StatelessWidget {
  const _WorkspaceMessage({
    required this.message,
    required this.onDismiss,
  });

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CaptureColors.surfaceMuted,
      borderRadius: CaptureRadii.controlBorder,
      child: ListTile(
        leading: const Icon(Icons.cloud_off_outlined),
        title: Text(message),
        trailing: IconButton(
          onPressed: onDismiss,
          icon: const Icon(Icons.close, size: 18),
          tooltip: 'Dismiss',
        ),
      ),
    );
  }
}

class _EmptyDays extends StatelessWidget {
  const _EmptyDays();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          const BrandMark(size: 84),
          const SizedBox(height: 20),
          Text('No days found', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Create the day in the existing operator workspace, then refresh.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

Color _statusColor(String status) => switch (status) {
      'active' => CaptureColors.ink,
      'complete' => CaptureColors.zinc400,
      _ => CaptureColors.amber,
    };

String _dateLabel(DateTime date) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}
