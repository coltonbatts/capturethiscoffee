import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../setup_models.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/setup_widgets.dart';
import 'add_people_screen.dart';
import 'bulk_roster_screen.dart';
import 'day_editor_screen.dart';

class SetupRosterScreen extends StatefulWidget {
  const SetupRosterScreen({
    super.key,
    required this.productionId,
  });

  final String productionId;

  @override
  State<SetupRosterScreen> createState() => _SetupRosterScreenState();
}

class _SetupRosterScreenState extends State<SetupRosterScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (mounted) {
      await PrinterScope.setupOf(context).loadRoster(widget.productionId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    final day =
        controller.day?.id == widget.productionId ? controller.day : null;
    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'Setup roster'),
        actions: [
          IconButton(
            key: const Key('add-roster-person'),
            onPressed: controller.busy || day == null ? null : _addPeople,
            icon: const Icon(Icons.person_add_alt_1_outlined),
            tooltip: 'Find or create a person',
          ),
          IconButton(
            key: const Key('bulk-roster'),
            onPressed: controller.busy || day == null ? null : _bulk,
            icon: const Icon(Icons.playlist_add_outlined),
            tooltip: 'Paste a call sheet',
          ),
          IconButton(
            key: const Key('edit-setup-day'),
            onPressed: controller.busy || day == null
                ? null
                : () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => DayEditorScreen(day: day),
                      ),
                    ),
            icon: const Icon(Icons.edit_calendar_outlined),
            tooltip: 'Edit day',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    day?.name ?? 'Loading day',
                    style: CaptureType.pageTitle,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${controller.roster.length} ${controller.roster.length == 1 ? 'person' : 'people'} · drag to set service order',
                  ),
                  const SizedBox(height: 12),
                  SetupFailurePanel(
                    controller: controller,
                    onRetry: _load,
                  ),
                ],
              ),
            ),
            Expanded(
              child: day == null && controller.busy
                  ? const Center(child: CircularProgressIndicator())
                  : controller.roster.isEmpty
                      ? const _EmptyRoster()
                      : ReorderableListView.builder(
                          key: const Key('setup-roster-list'),
                          padding: const EdgeInsets.fromLTRB(8, 0, 8, 100),
                          buildDefaultDragHandles: false,
                          itemCount: controller.roster.length,
                          onReorderItem: controller.busy
                              ? (_, __) {}
                              : (oldIndex, newIndex) =>
                                  controller.reorderRoster(
                                    widget.productionId,
                                    oldIndex,
                                    newIndex,
                                  ),
                          itemBuilder: (context, index) {
                            final member = controller.roster[index];
                            return _RosterRow(
                              key: ValueKey(member.rosterId),
                              member: member,
                              index: index,
                              onEdit: () => _editMember(member),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton.icon(
          key: const Key('continue-to-operations'),
          style: CaptureButtons.accent,
          onPressed:
              controller.busy || day == null ? null : _continueToOperations,
          icon: const Icon(Icons.arrow_forward),
          label: const Text('Continue to Collect & Print'),
        ),
      ),
    );
  }

  Future<void> _addPeople() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AddPeopleScreen(productionId: widget.productionId),
      ),
    );
    if (mounted) setState(() {});
  }

  Future<void> _bulk() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => BulkRosterScreen(productionId: widget.productionId),
      ),
    );
    if (mounted) setState(() {});
  }

  Future<void> _editMember(SetupRosterMember member) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RosterMemberSheet(
        productionId: widget.productionId,
        member: member,
      ),
    );
  }

  Future<void> _continueToOperations() async {
    final workspace = PrinterScope.workspaceOf(context);
    await workspace.refreshDays();
    final selected = await workspace.selectDay(widget.productionId);
    if (!selected || !mounted) return;
    Navigator.of(context).popUntil((route) => route.isFirst);
  }
}

class _RosterRow extends StatelessWidget {
  const _RosterRow({
    super.key,
    required this.member,
    required this.index,
    required this.onEdit,
  });

  final SetupRosterMember member;
  final int index;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          ListTile(
            key: Key('setup-roster-${member.rosterId}'),
            dense: true,
            contentPadding: const EdgeInsets.only(left: 8, right: 2),
            leading: SetupPersonAvatar(
              controller: PrinterScope.setupOf(context),
              person: member.person,
              radius: 20,
            ),
            title: Text(member.person.name),
            subtitle: Text(
              [
                member.groupLabel.isEmpty ? 'Set' : member.groupLabel,
                member.onSetToday ? 'On set' : 'Off set',
                if (member.person.usualOrder.isNotEmpty)
                  member.person.usualOrder,
              ].join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  onPressed: onEdit,
                  icon: const Icon(Icons.tune, size: 20),
                  tooltip: 'Organize ${member.person.name}',
                ),
                ReorderableDragStartListener(
                  index: index,
                  child: const Padding(
                    padding: EdgeInsets.all(12),
                    child: Icon(Icons.drag_handle),
                  ),
                ),
              ],
            ),
            onTap: onEdit,
          ),
          const Divider(),
        ],
      );
}

class _EmptyRoster extends StatelessWidget {
  const _EmptyRoster();

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.groups_outlined, size: 42),
              const SizedBox(height: 12),
              Text(
                'Roster is empty',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              const Text(
                'Use the add-person or bulk-paste actions above.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
}

class _RosterMemberSheet extends StatefulWidget {
  const _RosterMemberSheet({
    required this.productionId,
    required this.member,
  });

  final String productionId;
  final SetupRosterMember member;

  @override
  State<_RosterMemberSheet> createState() => _RosterMemberSheetState();
}

class _RosterMemberSheetState extends State<_RosterMemberSheet> {
  late final TextEditingController _group;
  late bool _onSet;
  Future<void> Function()? _retry;

  @override
  void initState() {
    super.initState();
    _group = TextEditingController(text: widget.member.groupLabel);
    _onSet = widget.member.onSetToday;
  }

  @override
  void dispose() {
    _group.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          18,
          16,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.member.person.name,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            const Text('Organize this roster entry.'),
            const SizedBox(height: 18),
            SetupFailurePanel(
              controller: controller,
              onRetry: _retry,
            ),
            if (controller.failure != null) const SizedBox(height: 12),
            TextField(
              key: const Key('roster-group'),
              controller: _group,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Group'),
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              key: const Key('roster-on-set'),
              contentPadding: EdgeInsets.zero,
              title: const Text('On set today'),
              value: _onSet,
              onChanged: controller.busy
                  ? null
                  : (value) => setState(() => _onSet = value),
            ),
            const SizedBox(height: 10),
            FilledButton(
              key: const Key('save-roster-member'),
              onPressed: controller.busy ? null : _save,
              child: const Text('Save roster entry'),
            ),
            TextButton.icon(
              key: const Key('remove-roster-member'),
              onPressed: controller.busy ? null : _remove,
              style:
                  TextButton.styleFrom(foregroundColor: CaptureColors.danger),
              icon: const Icon(Icons.person_remove_outlined),
              label: const Text('Remove from this roster'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    _retry = _save;
    final saved = await PrinterScope.setupOf(context).updateRosterMember(
      productionId: widget.productionId,
      rosterId: widget.member.rosterId,
      groupLabel: _group.text,
      onSetToday: _onSet,
    );
    if (saved && mounted) Navigator.pop(context);
  }

  Future<void> _remove() async {
    _retry = _remove;
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Remove from roster?'),
            content: Text(
              '${widget.member.person.name} remains in People, but this initial order is removed with the roster entry.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Remove'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    final removed = await PrinterScope.setupOf(context).removeRosterMember(
      productionId: widget.productionId,
      rosterId: widget.member.rosterId,
    );
    if (removed && mounted) Navigator.pop(context);
  }
}
