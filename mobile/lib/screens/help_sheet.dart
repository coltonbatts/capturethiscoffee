// The in-app operating guide.
//
// Reachable from the link screen and from home, because the two moments an
// operator needs it are before they have anything set up and in the middle of a
// print going wrong.

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../theme.dart';
import 'about_screen.dart';

final _supportUri = Uri.parse('https://coffee.capturethis.com/support');

Future<void> showQuickStart(BuildContext context) async {
  final controller = PrinterScope.of(context);

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
            const _HelpStep(
              number: '1',
              title: 'Link an active production',
              body:
                  'Paste the complete private production link from the coordinator. Printing stays paused until the production is Active.',
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
            const _HelpStep(
              number: '4',
              title: 'Print and wait for sync',
              body:
                  'Use Print, Print next, or Print all pending. Wait for the printed status to synchronize before moving on.',
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
                    const Text(
                        '• Never share or screenshot the production link.'),
                    const Text('• Never update printer firmware on set.'),
                    const Text('• Never reprint when the app says Sync only.'),
                    const Text(
                        '• Keep internet access available while printing.'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                controller.openExternalPage(_supportUri);
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
