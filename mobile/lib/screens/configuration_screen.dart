import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/motion.dart';

class ConfigurationScreen extends StatelessWidget {
  const ConfigurationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final runtime = PrinterScope.runtimeOf(context);
    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'Setup required'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: BrandMark(size: 104)),
                  const SizedBox(height: 28),
                  Text('Release setup needed', style: CaptureType.pageTitle),
                  const SizedBox(height: 12),
                  Text(
                    runtime.configuration.setupMessage,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 24),
                  Pressable(
                    child: OutlinedButton.icon(
                      onPressed: runtime.enterLegacy,
                      icon: const Icon(Icons.link),
                      label: const Text('Legacy link'),
                    ),
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
