// Version, privacy, support, licenses.
//
// Was an AlertDialog with four TextButtons in its actions row, which wrapped and
// cramped on a narrow phone. Four peer destinations are a list, not a dialog.

import 'package:flutter/material.dart';

import '../external_links.dart';
import '../app_scope.dart';
import '../printer_controller.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';

const templateEntryKey = Key('home-template-entry');
const testLabelActionKey = Key('home-test-label-action');

const String kAppVersion = '1.0.0 (14)';

final _privacyUri = Uri.parse('https://coffee.capturethis.com/privacy');
final _supportUri = Uri.parse('https://coffee.capturethis.com/support');

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const route = '/about';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 8),
            const Center(child: BrandMark(size: 72)),
            const SizedBox(height: 16),
            Text(
              'Capture This',
              textAlign: TextAlign.center,
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 4),
            Text(
              'Version $kAppVersion',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            Text(
              'Production coffee, organized for production crews. '
              'Prepare a day, collect orders, print one label at a time, '
              'share the summary, and close out from the workspace.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined),
                    title: const Text('Privacy'),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () => openExternalPage(context, _privacyUri),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.support_agent),
                    title: const Text('Support'),
                    trailing: const Icon(Icons.open_in_new, size: 18),
                    onTap: () => openExternalPage(context, _supportUri),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.description_outlined),
                    title: const Text('Licenses'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => showLicensePage(
                      context: context,
                      applicationName: 'Capture This',
                      applicationVersion: kAppVersion,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _TemplateEntry(controller: PrinterScope.of(context)),
            const SizedBox(height: 16),
            Text(
              'Capture This $kAppVersion',
              textAlign: TextAlign.center,
              style: CaptureType.mono,
            ),
          ],
        ),
      ),
    );
  }
}

class _TemplateEntry extends StatelessWidget {
  const _TemplateEntry({required this.controller});

  final PrinterController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canTest = controller.connected &&
        !controller.busy &&
        controller.printerStatus != PrinterStatus.printing;

    return Container(
      key: templateEntryKey,
      decoration: BoxDecoration(
        color: CaptureColors.surface,
        border: Border.all(color: CaptureColors.ruleSoft),
        borderRadius: CaptureRadii.cardBorder,
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.label_outline, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  controller.labelTemplateIdentity,
                  style: theme.textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            controller.labelTemplateStatus,
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              key: testLabelActionKey,
              onPressed:
                  canTest ? () => controller.printFictionalTestLabel() : null,
              icon: const Icon(Icons.print_outlined, size: 18),
              label: Text(
                canTest
                    ? 'Print fictional test label'
                    : 'Connect printer to print a test label',
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Uses this exact template and changes no order or printed facts.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: CaptureColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}
