import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../setup_models.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/setup_widgets.dart';

class BulkRosterScreen extends StatefulWidget {
  const BulkRosterScreen({
    super.key,
    required this.productionId,
  });

  final String productionId;

  @override
  State<BulkRosterScreen> createState() => _BulkRosterScreenState();
}

class _BulkRosterScreenState extends State<BulkRosterScreen> {
  final _paste = TextEditingController();
  BulkRosterPreview? _preview;

  @override
  void dispose() {
    _paste.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    final preview = _preview;
    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'Bulk roster'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 22, 16, 120),
                children: [
                  Text('Paste a call sheet', style: CaptureType.pageTitle),
                  const SizedBox(height: 8),
                  const Text(
                    'Separate names with new lines or commas. Nothing is written until you review and commit.',
                  ),
                  const SizedBox(height: 18),
                  SetupFailurePanel(
                    controller: controller,
                    onRetry: preview?.canCommit == true ? _commit : null,
                  ),
                  if (controller.failure != null) const SizedBox(height: 16),
                  TextField(
                    key: const Key('bulk-paste'),
                    controller: _paste,
                    minLines: 8,
                    maxLines: 14,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'Names',
                      alignLabelWithHint: true,
                      hintText: 'Avery Stone\nNoah Park, Lena Ortiz',
                    ),
                    onChanged: (_) {
                      if (_preview != null) setState(() => _preview = null);
                    },
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    key: const Key('preview-bulk'),
                    onPressed: controller.busy
                        ? null
                        : () => setState(
                              () => _preview =
                                  controller.previewBulk(_paste.text),
                            ),
                    icon: const Icon(Icons.fact_check_outlined),
                    label: const Text('Preview names'),
                  ),
                  if (preview != null) ...[
                    const SizedBox(height: 24),
                    _PreviewSummary(preview: preview),
                    const SizedBox(height: 12),
                    if (preview.accepted.isNotEmpty) ...[
                      Text('READY TO ADD', style: CaptureType.eyebrow),
                      const SizedBox(height: 6),
                      for (var index = 0;
                          index < preview.accepted.length;
                          index++)
                        _CandidateRow(
                          index: index,
                          candidate: preview.accepted[index],
                        ),
                    ],
                    if (preview.issues.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text('NOT INCLUDED', style: CaptureType.eyebrow),
                      const SizedBox(height: 6),
                      for (final issue in preview.issues)
                        ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(
                            Icons.do_not_disturb_alt_outlined,
                            size: 20,
                          ),
                          title: Text(issue.normalizedName),
                          subtitle: Text(issue.message),
                        ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          key: const Key('commit-bulk'),
          style: CaptureButtons.accent,
          onPressed:
              controller.busy || preview?.canCommit != true ? null : _commit,
          child: Text(
            preview == null
                ? 'Preview before committing'
                : preview.tooLarge
                    ? 'Maximum 200 people'
                    : 'Add ${preview.accepted.length} atomically',
          ),
        ),
      ),
    );
  }

  Future<void> _commit() async {
    final preview = _preview;
    if (preview == null) return;
    final saved = await PrinterScope.setupOf(context)
        .commitBulk(widget.productionId, preview);
    if (saved && mounted) Navigator.of(context).pop(true);
  }
}

class _PreviewSummary extends StatelessWidget {
  const _PreviewSummary({required this.preview});

  final BulkRosterPreview preview;

  @override
  Widget build(BuildContext context) => Material(
        color: CaptureColors.surfaceMuted,
        borderRadius: CaptureRadii.controlBorder,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: _Count(
                  value: preview.accepted.length,
                  label: 'accepted',
                ),
              ),
              Expanded(
                child: _Count(
                  value: preview.issues.length,
                  label: 'duplicates / conflicts',
                ),
              ),
              Expanded(
                child: _Count(
                  value: preview.blankEntriesIgnored,
                  label: 'blank ignored',
                ),
              ),
            ],
          ),
        ),
      );
}

class _Count extends StatelessWidget {
  const _Count({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text('$value', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      );
}

class _CandidateRow extends StatelessWidget {
  const _CandidateRow({
    required this.index,
    required this.candidate,
  });

  final int index;
  final BulkRosterCandidate candidate;

  @override
  Widget build(BuildContext context) => ListTile(
        key: Key('bulk-candidate-$index'),
        dense: true,
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(
          radius: 15,
          backgroundColor: CaptureColors.surfaceMuted,
          foregroundColor: CaptureColors.ink,
          child: Text('${index + 1}', style: CaptureType.eyebrow),
        ),
        title: Text(candidate.name),
        subtitle: Text(
          candidate.usesExistingPerson
              ? 'Existing person · ${candidate.groupLabel}'
              : 'New person · ${candidate.groupLabel}',
        ),
      );
}
