// The questions the controller deliberately does not ask itself.
//
// PrinterController's destructive operations are unconditional by design (see
// the note at the top of printer_controller.dart). These are their gates, kept
// together so the copy stays consistent no matter which screen triggers them —
// once the roster, the deck, and the recovery screen can all reach the same
// operation, the same action asked three different ways is a real hazard.
//
// Every one of these guards something physical: a duplicate label on a cup, a
// recovery record stranded on a device, a batch that cannot be recalled once
// the printhead starts.

import 'package:flutter/material.dart';

import 'printer_controller.dart';
import 'production_board.dart';

/// Returns true when the operator confirmed, or when there was nothing to
/// confirm. Callers should treat false as "do nothing".
Future<bool> confirmChangeProduction(
  BuildContext context,
  PrinterController controller,
) async {
  if (controller.currentRecoveryRecords.isEmpty) return true;

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Change with unresolved labels?'),
      content: const Text(
        'The recovery records will stay on this iPhone, but you will need the same production share URL to return and resolve them. No labels will be reprinted automatically.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Stay and resolve'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Change production'),
        ),
      ],
    ),
  );
  return confirmed == true;
}

Future<bool> confirmPrintAll(BuildContext context, int count) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Print all pending?'),
      content: Text(
        'This will print $count labels. The batch will stop if any label fails.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: () => Navigator.of(context).pop(true),
          icon: const Icon(Icons.print),
          label: const Text('Print all'),
        ),
      ],
    ),
  );
  return confirmed == true;
}

Future<bool> confirmReprint(BuildContext context, QueueLabel item) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Reprint ${item.personName}?'),
      content: const Text(
        'The web app already records this label as printed. Continue only if you intentionally need a duplicate physical label.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Reprint label'),
        ),
      ],
    ),
  );
  return confirmed == true;
}

Future<bool> confirmRetryUncertain(
  BuildContext context,
  QueueLabel item,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Retry this physical label?'),
      content: Text(
        'Only continue if no usable ${item.personName} label came out of the printer. This will start a new physical print.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Nothing printed — retry'),
        ),
      ],
    ),
  );
  return confirmed == true;
}
