// The print deck — the app's primary surface.
//
// It replaces three stacked cards (printer status, queue summary, batch
// actions) with one. The point is not density for its own sake: those three
// cards each held a fragment of the answer to "can I print right now?", and the
// operator had to assemble it. Here the deck answers it, and the single action
// under the label reflects that answer.
//
// The label on screen is the real rasterised label — see `LabelPreview`.

import 'package:flutter/material.dart';

import '../label_content.dart';
import '../theme.dart';
import 'brand_mark.dart';
import 'label_preview.dart';

/// Why printing is unavailable, in the order the operator must resolve it.
enum DeckBlock {
  none,
  disconnected,
  productionInactive,
  recoveryPending,
}

class PrintDeck extends StatefulWidget {
  const PrintDeck({
    super.key,
    required this.productionName,
    required this.statusLabel,
    required this.content,
    required this.nextUpName,
    required this.pending,
    required this.printed,
    required this.total,
    required this.syncLabel,
    required this.staleNotice,
    required this.busy,
    required this.connected,
    required this.printing,
    required this.block,
    required this.printSuccessToken,
    required this.onPrint,
    required this.onPrintAll,
    required this.onConnect,
    required this.onDisconnect,
    required this.onRefresh,
  });

  final String productionName;

  /// Shown only when the production is not active — an operator must be able to
  /// see *why* the deck is refusing to print, not just that it is.
  final String? statusLabel;

  /// The label about to print. Null when the queue holds nothing pending.
  final LabelContent? content;

  /// The person after this one, for the up-next line. Null when this is last.
  final String? nextUpName;

  final int pending;
  final int printed;
  final int total;
  final String syncLabel;

  /// Built by the caller so the wording stays with the staleness rules.
  final Widget? staleNotice;

  final bool busy;
  final bool connected;

  /// A physical print is in flight. The operator must not background the app.
  final bool printing;

  final DeckBlock block;

  /// Increments once per label that physically printed. The deck watches it
  /// rather than inferring success from counts, because the counts also move on
  /// refresh, reprint, and recovery sync — none of which are the moment a label
  /// came out of the printer.
  final int printSuccessToken;

  final VoidCallback onPrint;
  final VoidCallback onPrintAll;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;
  final VoidCallback onRefresh;

  @override
  State<PrintDeck> createState() => _PrintDeckState();
}

class _PrintDeckState extends State<PrintDeck>
    with SingleTickerProviderStateMixin {
  late final AnimationController _stamp = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 950),
  );

  late final Animation<double> _stampScale = _stamp.drive(
    Tween<double>(begin: 0.35, end: 1).chain(
      CurveTween(curve: const Interval(0, 0.38, curve: CaptureMotion.spring)),
    ),
  );

  late final Animation<double> _stampTurn = _stamp.drive(
    Tween<double>(begin: -0.045, end: 0).chain(
      CurveTween(curve: const Interval(0, 0.38, curve: CaptureMotion.spring)),
    ),
  );

  late final Animation<double> _stampFade = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 14),
    TweenSequenceItem(tween: ConstantTween(1.0), weight: 56),
    TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 30),
  ]).animate(_stamp);

  @override
  void didUpdateWidget(PrintDeck old) {
    super.didUpdateWidget(old);
    if (widget.printSuccessToken != old.printSuccessToken &&
        widget.printSuccessToken > 0) {
      final reduceMotion =
          MediaQuery.maybeOf(context)?.disableAnimations ?? false;
      if (!reduceMotion) _stamp.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _stamp.dispose();
    super.dispose();
  }

  bool get _canPrint =>
      widget.block == DeckBlock.none &&
      widget.content != null &&
      !widget.busy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _header(theme),
            if (widget.statusLabel != null) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: Chip(
                  avatar: const Icon(Icons.pause_circle),
                  label: Text(widget.statusLabel!),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
            const SizedBox(height: 14),
            _progress(theme),
            if (widget.staleNotice != null) ...[
              const SizedBox(height: 14),
              widget.staleNotice!,
            ],
            const SizedBox(height: 16),
            _stage(theme),
            const SizedBox(height: 16),
            _primaryAction(),
            const SizedBox(height: 10),
            _secondaryActions(),
          ],
        ),
      ),
    );
  }

  Widget _header(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.productionName,
                style: theme.textTheme.titleMedium,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 1),
              Text(widget.syncLabel, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
        IconButton(
          onPressed: widget.busy ? null : widget.onRefresh,
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh board',
        ),
        IconButton(
          onPressed: widget.busy
              ? null
              : widget.connected
                  ? widget.onDisconnect
                  : widget.onConnect,
          icon: Icon(
            widget.connected
                ? Icons.bluetooth_connected
                : Icons.bluetooth_disabled,
            color:
                widget.connected ? CaptureColors.ink : CaptureColors.faint,
          ),
          tooltip: widget.connected ? 'Disconnect printer' : 'Connect printer',
        ),
      ],
    );
  }

  Widget _progress(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            // Counts down rather than snapping — the number is the operator's
            // sense of how much day is left.
            TweenAnimationBuilder<double>(
              tween: Tween(end: widget.pending.toDouble()),
              duration: CaptureMotion.slow,
              curve: CaptureMotion.ease,
              builder: (context, value, _) => Text(
                '${value.round()}',
                style: theme.textTheme.headlineLarge,
              ),
            ),
            const SizedBox(width: 7),
            Text(
              widget.pending == 1 ? 'label left' : 'labels left',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: CaptureColors.muted),
            ),
            const Spacer(),
            Text(
              '${widget.printed} of ${widget.total} printed',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: TweenAnimationBuilder<double>(
            tween: Tween(
              end: widget.total == 0 ? 0 : widget.printed / widget.total,
            ),
            duration: CaptureMotion.slow,
            curve: CaptureMotion.ease,
            builder: (context, value, _) =>
                LinearProgressIndicator(value: value, minHeight: 4),
          ),
        ),
      ],
    );
  }

  /// The label, or the reason there isn't one, with the print stamp over it.
  Widget _stage(ThemeData theme) {
    final label = widget.content;

    final body = label == null
        ? _emptyStage(theme)
        : Column(
            children: [
              AnimatedSwitcher(
                duration: CaptureMotion.base,
                switchInCurve: CaptureMotion.ease,
                child: LabelPreview(
                  key: ValueKey(label.orderNumber + label.personName),
                  content: label,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                widget.nextUpName == null
                    ? 'Last one in the queue'
                    : 'Then ${widget.nextUpName}',
                style: theme.textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
          );

    return Stack(
      alignment: Alignment.center,
      children: [
        body,
        Positioned.fill(
          child: IgnorePointer(
            child: AnimatedBuilder(
              animation: _stamp,
              builder: (context, child) {
                if (_stamp.isDismissed) return const SizedBox.shrink();
                return Opacity(
                  opacity: _stampFade.value,
                  child: Transform.rotate(
                    angle: _stampTurn.value * 3.14159,
                    child: Transform.scale(
                      scale: _stampScale.value,
                      child: child,
                    ),
                  ),
                );
              },
              child: const Center(child: BrandMark(size: 96)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _emptyStage(ThemeData theme) {
    final everythingPrinted = widget.total > 0 && widget.pending == 0;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 26),
      child: Column(
        children: [
          BrandMark(size: everythingPrinted ? 92 : 56),
          const SizedBox(height: 18),
          Text(
            everythingPrinted ? "That's the day." : 'Nothing to print yet',
            style: theme.textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            everythingPrinted
                ? '${widget.printed} ${widget.printed == 1 ? 'label' : 'labels'} printed. Everything synced.'
                : 'Captured drink orders land here as the runner takes them.',
            style: theme.textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _primaryAction() {
    // Outranks every block reason: paper is moving through the printer and the
    // only correct instruction is to leave the app alone.
    if (widget.printing) {
      return FilledButton.icon(
        onPressed: null,
        style: CaptureButtons.accent,
        icon: const Icon(Icons.print),
        label: const Text('Printing — keep the app open'),
      );
    }

    switch (widget.block) {
      case DeckBlock.disconnected:
        return FilledButton.icon(
          onPressed: widget.busy ? null : widget.onConnect,
          icon: const Icon(Icons.bluetooth_searching),
          label: const Text('Connect printer'),
        );
      case DeckBlock.productionInactive:
        // Deliberately not "Printing paused" — that is the explanation card's
        // heading, and the same phrase twice reads as one message repeated.
        return FilledButton.icon(
          onPressed: null,
          style: CaptureButtons.accent,
          icon: const Icon(Icons.pause_circle),
          label: const Text('Production not active'),
        );
      case DeckBlock.recoveryPending:
        return FilledButton.icon(
          onPressed: null,
          style: CaptureButtons.accent,
          icon: const Icon(Icons.report_problem),
          label: const Text('Resolve print status first'),
        );
      case DeckBlock.none:
        return FilledButton.icon(
          onPressed: _canPrint ? widget.onPrint : null,
          style: CaptureButtons.accent,
          icon: const Icon(Icons.print),
          label: Text(
            widget.content == null ? 'Nothing to print' : 'Print this label',
          ),
        );
    }
  }

  Widget _secondaryActions() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed:
                _canPrint && widget.pending > 1 ? widget.onPrintAll : null,
            icon: const Icon(Icons.stacked_bar_chart, size: 18),
            label: Text('Print all (${widget.pending})'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: widget.busy || !widget.connected
                ? null
                : widget.onDisconnect,
            icon: const Icon(Icons.bluetooth_disabled, size: 18),
            label: const Text('Disconnect'),
          ),
        ),
      ],
    );
  }
}
