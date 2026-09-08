import 'package:flutter/material.dart';
import '../app_scope.dart';
import '../workspace_controller.dart';
import '../theme.dart';

/// Sibling destinations replace one another; Back still returns to the day.
class DayNavigation extends StatelessWidget {
  const DayNavigation({super.key, required this.route});
  final String route;

  @override
  Widget build(BuildContext context) {
    if (PrinterScope.workspaceOf(context).mode != WorkspaceMode.authenticated ||
        MediaQuery.viewInsetsOf(context).bottom > 0) {
      return const SizedBox.shrink();
    }
    if (MediaQuery.textScalerOf(context).scale(14) > 20) {
      return Material(
        color: CaptureColors.paper,
        child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: DropdownButtonFormField<String>(
                initialValue: route,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Go to'),
                items: const [
                  DropdownMenuItem(value: '/collect', child: Text('Collect')),
                  DropdownMenuItem(value: '/print', child: Text('Print')),
                  DropdownMenuItem(value: '/summary', child: Text('Summary')),
                ],
                onChanged: (value) {
                  if (value != null && value != route) {
                    Navigator.of(context).pushReplacementNamed(value);
                  }
                },
              ),
            )),
      );
    }
    return Material(
      color: CaptureColors.paper,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
          child: Row(
            children: [
              for (final destination in const [
                ('/collect', 'Collect', Icons.local_cafe_outlined),
                ('/print', 'Print', Icons.print_outlined),
                ('/summary', 'Summary', Icons.summarize_outlined),
              ])
                Expanded(
                  child: Semantics(
                    selected: route == destination.$1,
                    child: TextButton(
                      key: Key('day-nav-${destination.$2.toLowerCase()}'),
                      style: TextButton.styleFrom(
                        minimumSize: const Size(44, 52),
                        backgroundColor: route == destination.$1
                            ? CaptureColors.surfaceMuted
                            : null,
                      ),
                      onPressed: () {
                        if (route != destination.$1) {
                          Navigator.of(context)
                              .pushReplacementNamed(destination.$1);
                        }
                      },
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(destination.$3, size: 20),
                          const SizedBox(height: 4),
                          Text(destination.$2)
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
