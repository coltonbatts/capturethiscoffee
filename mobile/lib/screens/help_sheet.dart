// The in-app operating guide.
//
// Reachable from the link screen and from home, because the two moments an
// operator needs it are before they have anything set up and in the middle of a
// print going wrong.

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../external_links.dart';
import '../theme.dart';
import 'about_screen.dart';

final _supportUri = Uri.parse('https://coffee.capturethis.com/support');

Future<void> showQuickStart(BuildContext context) async {
  final legacy = PrinterScope.runtimeOf(context).showLegacy;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.9,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Text(
              'How to use Capture This',
              style: Theme.of(sheetContext).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text(
              'The production board is the source of truth. Capture This prints its captured drink orders and syncs every successful label.',
            ),
            const SizedBox(height: 20),
            _HelpStep(
              number: '1',
              title: legacy
                  ? 'Link an active production'
                  : 'Sign in and choose an active day',
              body: legacy
                  ? 'Paste the complete private production link from the coordinator. Printing stays paused until the production is Active.'
                  : 'Use the owner-provisioned account, then select the day. If migration fallback is required, use Advanced · Legacy link and paste the complete private link.',
            ),
            const _HelpStep(
              number: '2',
              title: 'Prepare the M2_H',
              body:
                  'Load the accepted ribbon and label stock. Force-quit the official NIIMBOT app on nearby devices and power off other NIIMBOT printers.',
            ),
            const _HelpStep(
              number: '3',
              title: 'Connect and review',
              body:
                  'Tap Connect printer, refresh the queue, and double-check the person and drink before printing.',
            ),
            _HelpStep(
              number: '4',
              title: 'Print one label and verify',
              body: legacy
                  ? 'Review the person and drink, print one label, inspect the paper, and wait for printed status to synchronize before starting the next label.'
                  : 'Review the person and drink, print one label, then inspect its paper and recovery or sync state before starting the next. A loaded day stays printable offline.',
            ),
            const _HelpStep(
              number: '5',
              title: 'Recover without duplicates',
              body:
                  'If a usable label came out, choose “Label printed — sync only.” If nothing printed, choose “Nothing printed — retry.” If you cannot tell, stop and ask the coordinator.',
            ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rules that prevent mistakes',
                      style: Theme.of(sheetContext)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Text(legacy
                        ? '• Never share or screenshot the production link.'
                        : '• Use Legacy link only for the migration fallback.'),
                    const Text('• Never update printer firmware on set.'),
                    const Text('• Print one label at a time.'),
                    const Text('• Never reprint when the app says Sync only.'),
                    Text(legacy
                        ? '• Keep internet access available while printing.'
                        : '• Treat the visible offline age as missing-update risk.'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                openExternalPage(context, _supportUri);
              },
              icon: const Icon(Icons.support_agent),
              label: const Text('Open support'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                Navigator.of(context).pushNamed(AboutScreen.route);
              },
              child: const Text('About, privacy, and licenses'),
            ),
            const Center(
              child: Text(
                'Capture This $kAppVersion',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _HelpStep extends StatelessWidget {
  const _HelpStep({
    required this.number,
    required this.title,
    required this.body,
  });

  final String number;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DecoratedBox(
            decoration: const BoxDecoration(
              color: CaptureColors.yellow,
              shape: BoxShape.circle,
            ),
            child: SizedBox(
              width: 36,
              height: 36,
              child: Center(
                child: Text(
                  number,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
