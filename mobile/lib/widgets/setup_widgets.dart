import 'package:flutter/material.dart';

import '../setup_controller.dart';
import '../setup_models.dart';
import '../setup_repository.dart';
import '../theme.dart';

class SetupFailurePanel extends StatelessWidget {
  const SetupFailurePanel({
    super.key,
    required this.controller,
    this.onRetry,
  });

  final SetupController controller;
  final Future<void> Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    final failure = controller.failure;
    if (failure == null) return const SizedBox.shrink();
    final offline = failure.kind == SetupFailureKind.onlineRequired;
    return Semantics(
      liveRegion: true,
      child: Material(
        key: const Key('setup-failure'),
        color:
            offline ? CaptureColors.surfaceMuted : CaptureColors.errorSurface,
        borderRadius: CaptureRadii.controlBorder,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                offline ? Icons.cloud_off_outlined : Icons.error_outline,
                size: 20,
                color:
                    offline ? CaptureColors.ink : CaptureColors.onErrorSurface,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      offline ? 'Online setup required' : 'Setup not saved',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(failure.message),
                    if (failure.retryable && onRetry != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          key: const Key('setup-retry'),
                          onPressed: controller.busy ? null : onRetry,
                          child: const Text('Retry'),
                        ),
                      ),
                  ],
                ),
              ),
              IconButton(
                onPressed: controller.dismissError,
                icon: const Icon(Icons.close, size: 18),
                tooltip: 'Dismiss',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SetupPersonAvatar extends StatelessWidget {
  const SetupPersonAvatar({
    super.key,
    required this.controller,
    required this.person,
    this.radius = 22,
  });

  final SetupController controller;
  final SetupPerson person;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final reference = person.photoUrl.trim();
    if (reference.isEmpty) return _fallback();
    return FutureBuilder<String?>(
      future: controller.photoDisplayUrl(reference),
      builder: (context, snapshot) {
        final url = snapshot.data;
        if (url == null || url.isEmpty) return _fallback();
        return CircleAvatar(
          radius: radius,
          backgroundColor: CaptureColors.surfaceMuted,
          foregroundImage: NetworkImage(url),
          onForegroundImageError: (_, __) {},
          child: Text(_initials(person.name)),
        );
      },
    );
  }

  Widget _fallback() => CircleAvatar(
        radius: radius,
        backgroundColor: CaptureColors.surfaceMuted,
        foregroundColor: CaptureColors.ink,
        child: Text(_initials(person.name)),
      );
}

String setupPersonDetail(SetupPerson person) {
  final values = [
    person.role.trim(),
    person.department.trim(),
    person.company.trim(),
  ].where((value) => value.isNotEmpty).toList();
  return values.isEmpty ? person.type.label : values.join(' · ');
}

String _initials(String name) {
  final parts = normalizeSetupName(name).split(' ');
  return parts
      .take(2)
      .where((part) => part.isNotEmpty)
      .map((part) => part.substring(0, 1).toUpperCase())
      .join();
}
