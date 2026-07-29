import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../setup_models.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/setup_widgets.dart';
import 'setup_roster_screen.dart';

class DayEditorScreen extends StatefulWidget {
  const DayEditorScreen({
    super.key,
    this.day,
    this.openRosterAfterSave = false,
  });

  final SetupDay? day;
  final bool openRosterAfterSave;

  @override
  State<DayEditorScreen> createState() => _DayEditorScreenState();
}

class _DayEditorScreenState extends State<DayEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _brand;
  late final TextEditingController _location;
  late final TextEditingController _runner;
  late final TextEditingController _notes;
  late String _status;
  late DateTime? _shootDate;

  @override
  void initState() {
    super.initState();
    final draft = widget.day?.toDraft() ?? const DayDraft(name: '');
    _name = TextEditingController(text: draft.name);
    _brand = TextEditingController(text: draft.clientName);
    _location = TextEditingController(text: draft.location);
    _runner = TextEditingController(text: draft.runnerName);
    _notes = TextEditingController(text: draft.notes);
    _status = draft.status;
    _shootDate = draft.shootDate;
  }

  @override
  void dispose() {
    _name.dispose();
    _brand.dispose();
    _location.dispose();
    _runner.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    final editing = widget.day != null;
    return Scaffold(
      appBar: AppBar(
        title: BrandAppBarTitle(detail: editing ? 'Edit day' : 'New day'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 22, 16, 120),
                  children: [
                    Text(
                      editing ? 'Day details' : 'Create a shoot day',
                      style: CaptureType.pageTitle,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Setup writes are online-only. Capture and printing stay available offline after the day is selected.',
                    ),
                    const SizedBox(height: 18),
                    SetupFailurePanel(
                      controller: controller,
                      onRetry: _save,
                    ),
                    if (controller.failure != null) const SizedBox(height: 16),
                    TextFormField(
                      key: const Key('day-name'),
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Day name'),
                      validator: (value) =>
                          normalizeSetupName(value ?? '').isEmpty
                              ? 'Day name is required.'
                              : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('day-client'),
                      controller: _brand,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Client / brand (optional)',
                        helperText: 'An existing matching client is reused.',
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      key: const Key('day-status'),
                      initialValue: _status,
                      decoration: const InputDecoration(labelText: 'Status'),
                      items: const [
                        DropdownMenuItem(
                          value: 'planning',
                          child: Text('Planning'),
                        ),
                        DropdownMenuItem(
                          value: 'active',
                          child: Text('Active'),
                        ),
                        DropdownMenuItem(
                          value: 'complete',
                          child: Text('Complete'),
                        ),
                      ],
                      onChanged: controller.busy
                          ? null
                          : (value) =>
                              setState(() => _status = value ?? _status),
                    ),
                    const SizedBox(height: 12),
                    _DateField(
                      value: _shootDate,
                      onChoose: controller.busy ? null : _chooseDate,
                      onClear: _shootDate == null || controller.busy
                          ? null
                          : () => setState(() => _shootDate = null),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _location,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Location'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _runner,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Runner'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _notes,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(labelText: 'Day notes'),
                      maxLines: 4,
                    ),
                    if (editing && widget.day!.status == 'planning') ...[
                      const SizedBox(height: 24),
                      const Divider(),
                      const SizedBox(height: 12),
                      TextButton.icon(
                        key: const Key('delete-planning-day'),
                        onPressed: controller.busy ? null : _delete,
                        style: TextButton.styleFrom(
                          foregroundColor: CaptureColors.danger,
                        ),
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Delete planning day'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          key: const Key('save-day'),
          style: CaptureButtons.accent,
          onPressed: controller.busy ? null : _save,
          child: Text(editing ? 'Save day' : 'Create day'),
        ),
      ),
    );
  }

  Future<void> _chooseDate() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: _shootDate ?? now,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 5),
    );
    if (selected != null && mounted) setState(() => _shootDate = selected);
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final controller = PrinterScope.setupOf(context);
    final originalClient = widget.day?.clientName ?? '';
    final clientUnchanged = normalizeSetupNameKey(_brand.text) ==
        normalizeSetupNameKey(originalClient);
    final draft = DayDraft(
      name: _name.text,
      clientId: clientUnchanged ? widget.day?.clientId : null,
      clientName: _brand.text,
      shootDate: _shootDate,
      location: _location.text,
      runnerName: _runner.text,
      notes: _notes.text,
      status: _status,
    );
    SetupDay? saved;
    if (widget.day case final day?) {
      final ok = await controller.updateDay(day.id, draft);
      saved = ok ? controller.day : null;
    } else {
      saved = await controller.createDay(draft);
    }
    if (!mounted || saved == null) return;
    await PrinterScope.workspaceOf(context).refreshDays();
    if (!mounted) return;
    if (widget.openRosterAfterSave || widget.day == null) {
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => SetupRosterScreen(productionId: saved!.id),
        ),
      );
    } else {
      Navigator.of(context).pop(true);
    }
  }

  Future<void> _delete() async {
    final day = widget.day;
    if (day == null) return;
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete this planning day?'),
            content: const Text(
              'Its roster and initial orders will also be removed. This cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Keep day'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    final deleted = await PrinterScope.setupOf(context).deleteDay(day.id);
    if (!deleted || !mounted) return;
    await PrinterScope.workspaceOf(context).refreshDays();
    if (mounted) Navigator.of(context).pop(true);
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.value,
    required this.onChoose,
    required this.onClear,
  });

  final DateTime? value;
  final VoidCallback? onChoose;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) => InputDecorator(
        decoration: const InputDecoration(labelText: 'Shoot date'),
        child: Row(
          children: [
            Expanded(
              child: Text(
                value == null
                    ? 'Not set'
                    : '${value!.month}/${value!.day}/${value!.year}',
              ),
            ),
            if (value != null)
              IconButton(
                onPressed: onClear,
                icon: const Icon(Icons.close, size: 18),
                tooltip: 'Clear shoot date',
              ),
            TextButton.icon(
              key: const Key('choose-shoot-date'),
              onPressed: onChoose,
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              label: const Text('Choose'),
            ),
          ],
        ),
      );
}
