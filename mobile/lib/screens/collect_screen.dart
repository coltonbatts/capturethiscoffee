import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../board_controller.dart';
import '../drink_format.dart';
import '../print_recovery.dart';
import '../production_board.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';

const collectSearchKey = Key('collect-search');
const collectSyncKey = Key('collect-sync');

class CollectScreen extends StatefulWidget {
  const CollectScreen({super.key});

  static const route = '/collect';

  @override
  State<CollectScreen> createState() => _CollectScreenState();
}

class _CollectScreenState extends State<CollectScreen> {
  String _query = '';
  bool _needsOnly = false;

  @override
  Widget build(BuildContext context) {
    final boardController = PrinterScope.boardOf(context);
    final board = boardController.board;
    final progress = productionBoardProgress(board);
    final editable = board?.production.isActive == true &&
        boardController.boardUnavailableReason == null;
    final needle = _query.trim().toLowerCase();
    final entries = (board?.roster ?? const <BoardRosterEntry>[])
        .where((entry) => entry.onSetToday)
        .where((entry) {
      final order = entry.order;
      if (_needsOnly && order != null && !order.needsOrder) return false;
      if (needle.isEmpty) return true;
      return [
        entry.person.name,
        entry.person.role,
        entry.person.department,
        entry.person.usualOrder,
        if (order != null) formatDrink(order),
      ].join(' ').toLowerCase().contains(needle);
    }).toList(growable: false);

    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'Collect'),
        actions: [
          IconButton(
            key: collectSyncKey,
            onPressed:
                boardController.busy ? null : () => boardController.refresh(),
            icon: const Icon(Icons.sync),
            tooltip: 'Sync and refresh',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (boardController.busy) const LinearProgressIndicator(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: boardController.refresh,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
                  children: [
                    Text('Collect drinks', style: CaptureType.pageTitle),
                    const SizedBox(height: 8),
                    Text(
                      '${progress.decided} of ${progress.total} decided · '
                      '${progress.needsOrder} need ${progress.needsOrder == 1 ? 'an order' : 'orders'}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    _Progress(
                      progress: progress,
                      pending: boardController.pendingMutationCount,
                      conflicts: boardController.conflictCount,
                    ),
                    if (boardController.syncBlockedReason != null) ...[
                      const SizedBox(height: 12),
                      _Notice(
                        icon: Icons.lock_clock_outlined,
                        message: boardController.syncBlockedReason!,
                      ),
                    ],
                    if (boardController.error != null) ...[
                      const SizedBox(height: 12),
                      _Notice(
                        icon: Icons.cloud_off_outlined,
                        message:
                            '${boardController.error} Local changes remain on this phone.',
                      ),
                    ],
                    if (!editable) ...[
                      const SizedBox(height: 12),
                      const _Notice(
                        icon: Icons.pause_circle_outline,
                        message:
                            'Order collection is paused until this day is Active and available.',
                      ),
                    ],
                    const SizedBox(height: 18),
                    TextField(
                      key: collectSearchKey,
                      onChanged: (value) => setState(() => _query = value),
                      decoration: const InputDecoration(
                        labelText: 'Search people',
                        prefixIcon: Icon(Icons.search),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SegmentedButton<bool>(
                      segments: [
                        ButtonSegment(
                          value: false,
                          label: Text('Everyone (${progress.total})'),
                        ),
                        ButtonSegment(
                          value: true,
                          label: Text('Needs order (${progress.needsOrder})'),
                        ),
                      ],
                      selected: {_needsOnly},
                      onSelectionChanged: (value) =>
                          setState(() => _needsOnly = value.single),
                    ),
                    const SizedBox(height: 18),
                    if (entries.isEmpty)
                      const _EmptyCollect()
                    else
                      for (final entry in entries) ...[
                        _CollectCard(
                          entry: entry,
                          mutation: entry.order == null
                              ? null
                              : boardController.mutationFor(entry.order!.id),
                          editable: editable,
                          onAcceptUsual: () =>
                              _run(() => boardController.acceptUsual(
                                    entry.order!.id,
                                  )),
                          onEdit: () => _edit(entry),
                          onNoDrink: () =>
                              _run(() => boardController.markNoDrink(
                                    entry.order!.id,
                                  )),
                          onReviewConflict: () =>
                              _reviewConflict(entry, boardController),
                        ),
                        const SizedBox(height: 12),
                      ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorText(error))),
      );
    }
  }

  Future<void> _edit(BoardRosterEntry entry) async {
    final order = entry.order;
    if (order == null) return;
    final result = await showModalBottomSheet<_OrderEditResult>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: CaptureColors.paper,
      shape: const RoundedRectangleBorder(
        borderRadius: CaptureRadii.sheetBorder,
      ),
      builder: (_) => _OrderEditor(
        personName: entry.person.name,
        initial: order,
      ),
    );
    if (result == null || !mounted) return;
    await _run(() => PrinterScope.boardOf(context).saveOrder(
          orderId: order.id,
          patch: OrderPatch.capture(result.order),
          updateUsualOrder: result.updateUsualOrder,
        ));
  }

  Future<void> _reviewConflict(
    BoardRosterEntry entry,
    BoardController controller,
  ) async {
    final order = entry.order;
    if (order == null) return;
    final mutation = controller.mutationFor(order.id);
    final conflict = mutation?.conflict;
    if (mutation == null || conflict == null) return;
    final serverOrder = conflict.serverOrder;
    final isUsual = conflict.kind == OrderMutationConflictKind.usualOrder;
    final retryable = conflict.kind == OrderMutationConflictKind.order ||
        conflict.kind == OrderMutationConflictKind.usualOrder;

    final choice = await showDialog<_ConflictChoice>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Review ${entry.person.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(conflict.message),
            const SizedBox(height: 16),
            Text('ON THIS PHONE', style: CaptureType.eyebrow),
            const SizedBox(height: 4),
            Text(isUsual ? mutation.desiredUsualOrder : formatDrink(order)),
            const SizedBox(height: 12),
            Text('ON THE SERVER', style: CaptureType.eyebrow),
            const SizedBox(height: 4),
            Text(
              isUsual
                  ? (conflict.serverUsualOrder?.isEmpty == false
                      ? conflict.serverUsualOrder!
                      : 'No usual saved')
                  : (serverOrder == null
                      ? 'Order unavailable'
                      : formatDrink(serverOrder)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(
              dialogContext,
              _ConflictChoice.server,
            ),
            child: const Text('Keep server'),
          ),
          if (retryable)
            FilledButton(
              onPressed: () => Navigator.pop(
                dialogContext,
                _ConflictChoice.phone,
              ),
              child: const Text('Use phone version'),
            ),
        ],
      ),
    );
    if (!mounted || choice == null) return;
    await _run(() => choice == _ConflictChoice.server
        ? controller.keepServerVersion(order.id)
        : controller.retryConflict(order.id));
  }
}

enum _ConflictChoice {
  server,
  phone,
}

class _Progress extends StatelessWidget {
  const _Progress({
    required this.progress,
    required this.pending,
    required this.conflicts,
  });

  final BoardProgress progress;
  final int pending;
  final int conflicts;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 7,
      runSpacing: 7,
      children: [
        _Pill(
          label: '${progress.needsOrder} needs order',
          color: CaptureColors.amber,
        ),
        _Pill(label: '${progress.captured} captured'),
        _Pill(label: '${progress.noDrink} no drink'),
        if (pending > 0)
          _Pill(
            label: '$pending pending sync',
            icon: Icons.cloud_upload_outlined,
          ),
        if (conflicts > 0)
          _Pill(
            label: '$conflicts ${conflicts == 1 ? 'conflict' : 'conflicts'}',
            color: CaptureColors.danger,
            foreground: Colors.white,
            icon: Icons.warning_amber_rounded,
          ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    this.color = CaptureColors.surfaceMuted,
    this.foreground = CaptureColors.ink,
    this.icon,
  });

  final String label;
  final Color color;
  final Color foreground;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(CaptureRadii.pill),
          border: Border.all(color: CaptureColors.ruleSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 13, color: foreground),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: Theme.of(context)
                  .textTheme
                  .labelMedium
                  ?.copyWith(color: foreground),
            ),
          ],
        ),
      );
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: CaptureColors.surfaceMuted,
          border: Border.all(color: CaptureColors.ruleSoft),
          borderRadius: CaptureRadii.controlBorder,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 19),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      );
}

class _CollectCard extends StatelessWidget {
  const _CollectCard({
    required this.entry,
    required this.mutation,
    required this.editable,
    required this.onAcceptUsual,
    required this.onEdit,
    required this.onNoDrink,
    required this.onReviewConflict,
  });

  final BoardRosterEntry entry;
  final OrderMutationRecord? mutation;
  final bool editable;
  final VoidCallback onAcceptUsual;
  final VoidCallback onEdit;
  final VoidCallback onNoDrink;
  final VoidCallback onReviewConflict;

  @override
  Widget build(BuildContext context) {
    final order = entry.order;
    final conflict = mutation?.conflict != null;
    final pending = mutation != null && !conflict;
    final state = order == null
        ? _CollectState.missing
        : order.isNoDrink
            ? _CollectState.noDrink
            : order.isCaptured
                ? _CollectState.captured
                : _CollectState.needsOrder;
    final rail = conflict
        ? CaptureColors.danger
        : switch (state) {
            _CollectState.needsOrder => CaptureColors.amber,
            _CollectState.captured => CaptureColors.ink,
            _CollectState.noDrink => CaptureColors.zinc400,
            _CollectState.missing => CaptureColors.danger,
          };
    final role = [
      entry.person.role.trim(),
      entry.group,
    ].where((value) => value.isNotEmpty).join(' · ');

    return Container(
      key: Key('collect-${entry.rosterId}'),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: CaptureColors.surface,
        borderRadius: CaptureRadii.cardBorder,
        border: Border.all(
          color: conflict ? CaptureColors.danger : CaptureColors.ruleSoft,
          width: conflict ? 2 : 1,
        ),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 6, color: rail),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                entry.person.name,
                                style: CaptureType.rowName,
                              ),
                              if (role.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  role,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ],
                          ),
                        ),
                        _StatePill(
                          state: state,
                          pending: pending,
                          conflict: conflict,
                        ),
                      ],
                    ),
                    const SizedBox(height: 13),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: CaptureColors.surfaceMuted,
                        borderRadius: CaptureRadii.controlBorder,
                      ),
                      child: Text(
                        switch (state) {
                          _CollectState.captured => formatDrink(order!),
                          _CollectState.noDrink =>
                            'Doesn’t want a drink today.',
                          _CollectState.needsOrder =>
                            entry.person.usualOrder.trim().isEmpty
                                ? 'No usual order saved.'
                                : 'Usual: ${entry.person.usualOrder}',
                          _CollectState.missing =>
                            'No order record. Connect and repair this roster entry during setup.',
                        },
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    const SizedBox(height: 13),
                    if (conflict)
                      FilledButton.icon(
                        onPressed: onReviewConflict,
                        icon: const Icon(Icons.compare_arrows),
                        label: const Text('Review conflict'),
                      )
                    else if (state == _CollectState.missing)
                      const SizedBox.shrink()
                    else if (state == _CollectState.needsOrder)
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (entry.person.usualOrder.trim().isNotEmpty)
                            FilledButton(
                              key: Key('accept-usual-${order!.id}'),
                              onPressed: editable ? onAcceptUsual : null,
                              child: const Text('Accept usual'),
                            ),
                          OutlinedButton(
                            key: Key('take-order-${order!.id}'),
                            onPressed: editable ? onEdit : null,
                            child: const Text('Take order'),
                          ),
                          OutlinedButton(
                            key: Key('no-drink-${order.id}'),
                            onPressed: editable ? onNoDrink : null,
                            child: const Text('No drink'),
                          ),
                        ],
                      )
                    else
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              key: Key('edit-order-${order!.id}'),
                              onPressed: editable ? onEdit : null,
                              child: Text(state == _CollectState.noDrink
                                  ? 'Take order'
                                  : 'Edit order'),
                            ),
                          ),
                          if (state == _CollectState.captured) ...[
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton(
                                key: Key('no-drink-${order.id}'),
                                onPressed: editable ? onNoDrink : null,
                                child: const Text('No drink'),
                              ),
                            ),
                          ],
                        ],
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
}

enum _CollectState {
  needsOrder,
  captured,
  noDrink,
  missing,
}

class _StatePill extends StatelessWidget {
  const _StatePill({
    required this.state,
    required this.pending,
    required this.conflict,
  });

  final _CollectState state;
  final bool pending;
  final bool conflict;

  @override
  Widget build(BuildContext context) => _Pill(
        label: conflict
            ? 'Conflict'
            : pending
                ? 'Pending sync'
                : switch (state) {
                    _CollectState.needsOrder => 'Needs order',
                    _CollectState.captured => 'Captured',
                    _CollectState.noDrink => 'No drink',
                    _CollectState.missing => 'Setup needed',
                  },
        color: conflict ? CaptureColors.danger : CaptureColors.surfaceMuted,
        foreground: conflict ? Colors.white : CaptureColors.ink,
        icon: conflict
            ? Icons.warning_amber_rounded
            : pending
                ? Icons.cloud_upload_outlined
                : null,
      );
}

class _EmptyCollect extends StatelessWidget {
  const _EmptyCollect();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 42),
        child: Text(
          'No matching on-set people.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
}

class _OrderEditResult {
  const _OrderEditResult({
    required this.order,
    required this.updateUsualOrder,
  });

  final BoardOrder order;
  final bool updateUsualOrder;
}

class _OrderEditor extends StatefulWidget {
  const _OrderEditor({
    required this.personName,
    required this.initial,
  });

  final String personName;
  final BoardOrder initial;

  @override
  State<_OrderEditor> createState() => _OrderEditorState();
}

class _OrderEditorState extends State<_OrderEditor> {
  late BoardOrder _draft = widget.initial;
  bool _updateUsualOrder = false;

  void _update(BoardOrder Function(BoardOrder) change) =>
      setState(() => _draft = change(_draft));

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(18, 20, 18, 18 + bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _draft.isCaptured ? 'Edit order' : 'Take order',
              style: CaptureType.pageTitle,
            ),
            const SizedBox(height: 4),
            Text(widget.personName),
            const SizedBox(height: 20),
            TextFormField(
              key: const Key('order-drink'),
              initialValue: _draft.drinkType,
              autofocus: true,
              maxLength: orderTextLimit,
              decoration: const InputDecoration(
                labelText: 'Drink',
                hintText: 'Latte, cold brew, drip',
              ),
              onChanged: (value) =>
                  _update((order) => order.copyWith(drinkType: value)),
            ),
            Row(
              children: [
                Expanded(
                  child: _SelectField(
                    label: 'Size',
                    value: _draft.size,
                    values: const ['Small', 'Medium', 'Large'],
                    onChanged: (value) =>
                        _update((order) => order.copyWith(size: value)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _SelectField(
                    label: 'Temperature',
                    value: _draft.temperature,
                    values: const ['Hot', 'Iced'],
                    onChanged: (value) =>
                        _update((order) => order.copyWith(temperature: value)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    key: const Key('order-milk'),
                    initialValue: _draft.milkType,
                    maxLength: orderTextLimit,
                    decoration: const InputDecoration(
                      labelText: 'Milk',
                      hintText: 'Oat, whole',
                    ),
                    onChanged: (value) =>
                        _update((order) => order.copyWith(milkType: value)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    key: const Key('order-sweetener'),
                    initialValue: _draft.sweetener,
                    maxLength: orderTextLimit,
                    decoration: const InputDecoration(
                      labelText: 'Sweetener',
                      hintText: 'Vanilla',
                    ),
                    onChanged: (value) =>
                        _update((order) => order.copyWith(sweetener: value)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _SelectField(
              label: 'Caffeine',
              value: _draft.caffeine.isEmpty ? 'Regular' : _draft.caffeine,
              values: const [
                'Regular',
                'Decaf',
                'Half-caf',
                'No caffeine',
              ],
              allowEmpty: false,
              onChanged: (value) =>
                  _update((order) => order.copyWith(caffeine: value)),
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('order-notes'),
              initialValue: _draft.specialNotes,
              maxLength: orderTextLimit,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Special notes',
                hintText: 'No room, extra hot, separate cup',
              ),
              onChanged: (value) =>
                  _update((order) => order.copyWith(specialNotes: value)),
            ),
            CheckboxListTile(
              key: const Key('order-update-usual'),
              contentPadding: EdgeInsets.zero,
              value: _updateUsualOrder,
              title: const Text('Save as usual order'),
              subtitle: const Text('Leave off for a one-day exception.'),
              onChanged: (value) =>
                  setState(() => _updateUsualOrder = value == true),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    key: const Key('order-save'),
                    onPressed: () => Navigator.pop(
                      context,
                      _OrderEditResult(
                        order: _draft.copyWith(
                          caffeine: _draft.caffeine.isEmpty
                              ? 'Regular'
                              : _draft.caffeine,
                          status: _draft.status == 'not_asked' ||
                                  _draft.status == 'no_order'
                              ? 'confirmed'
                              : _draft.status,
                        ),
                        updateUsualOrder: _updateUsualOrder,
                      ),
                    ),
                    child: const Text('Save order'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectField extends StatelessWidget {
  const _SelectField({
    required this.label,
    required this.value,
    required this.values,
    required this.onChanged,
    this.allowEmpty = true,
  });

  final String label;
  final String value;
  final List<String> values;
  final ValueChanged<String> onChanged;
  final bool allowEmpty;

  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
        initialValue: value,
        decoration: InputDecoration(labelText: label),
        items: [
          if (allowEmpty)
            const DropdownMenuItem(value: '', child: Text('Choose')),
          for (final item in values)
            DropdownMenuItem(value: item, child: Text(item)),
        ],
        onChanged: (value) => onChanged(value ?? ''),
      );
}

String _errorText(Object error) {
  final text = error.toString();
  return text.startsWith('Bad state: ')
      ? text.substring('Bad state: '.length)
      : text;
}
