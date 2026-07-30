// Version, privacy, support, licenses.
//
// Was an AlertDialog with four TextButtons in its actions row, which wrapped and
// cramped on a narrow phone. Four peer destinations are a list, not a dialog.

import 'package:flutter/material.dart';

import '../external_links.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';

const String kAppVersion = '1.0.0 (12)';

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
              'Coffee-label companion for Capture This production crews. '
              'Sign in, choose a day, and print directly from the workspace.',
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
