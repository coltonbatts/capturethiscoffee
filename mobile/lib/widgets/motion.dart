// Entrance motion, ported from the web splash.
//
// The web's `page.module.css` brings the splash in as a staggered cascade: the
// smiley rolls in first, then each line of copy follows on an 80ms metronome.
// That cascade is most of what makes the site feel like it was made by someone,
// and none of it had been ported. The smiley's own entrance lives with the mark
// in brand_mark.dart.
//
// Two rules for everything here:
//
//   * Animate once per mount. These widgets sit on a screen that rebuilds on
//     every controller notification — a 10-second board refresh, a log line, a
//     printer state change. An entrance that restarted on rebuild would make
//     the home screen twitch every ten seconds forever.
//   * Honour Reduce Motion by resolving to the END state, never the start. A
//     skipped animation must leave the content visible, not invisible.

import 'package:flutter/material.dart';

import '../theme.dart';

/// Zero when the operator has asked for less motion.
///
/// Flutter's implicit animations — `AnimatedSize`, `AnimatedSwitcher`,
/// `TweenAnimationBuilder` — do not consult Reduce Motion on their own. Passing
/// a duration through here is what makes them snap instead of slide.
Duration motionDuration(BuildContext context, Duration duration) =>
    (MediaQuery.maybeOf(context)?.disableAnimations ?? false)
        ? Duration.zero
        : duration;

/// The web's `active:translate-y-px` — everything is physically pressable.
///
/// A [Listener] rather than a [GestureDetector] on purpose: it observes pointer
/// events without entering the gesture arena, so wrapping a button in this
/// cannot steal or delay that button's own tap.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    this.offsetY = 1,
    this.scale = 1,
  });

  final Widget child;

  /// Downward travel in logical pixels. The web uses 1.
  final double offsetY;

  /// Optional shrink, for the one or two controls the web scales instead.
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _pressed = false;

  void _set(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: TweenAnimationBuilder<double>(
        tween: Tween(end: _pressed ? 1 : 0),
        duration: motionDuration(context, const Duration(milliseconds: 90)),
        curve: Curves.easeOut,
        builder: (context, t, child) => Transform.translate(
          offset: Offset(0, t * widget.offsetY),
          child: Transform.scale(
            scale: 1 - (t * (1 - widget.scale)),
            child: child,
          ),
        ),
        child: widget.child,
      ),
    );
  }
}

/// `copy-arrive` — fade up 12.8px over 560ms on the site's standard ease.
class CascadeIn extends StatefulWidget {
  const CascadeIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
  });

  final Widget child;
  final Duration delay;

  /// The web's metronome: 190ms for the first line, then 80ms per step. Callers
  /// say `CascadeIn.step(2)` rather than hand-copying millisecond values that
  /// have to stay in step with one another.
  static Duration step(int index) => Duration(milliseconds: 190 + (index * 80));

  @override
  State<CascadeIn> createState() => _CascadeInState();
}

class _CascadeInState extends State<CascadeIn>
    with SingleTickerProviderStateMixin {
  static const _travel = Duration(milliseconds: 560);

  /// The stagger is an [Interval] inside one controller rather than a delayed
  /// `forward()`. A `Future.delayed` would leave a pending timer behind, which
  /// the widget tester rightly treats as a leak — and a screen that scheduled
  /// five of them on mount would fail every test that touched it.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.delay + _travel,
  );

  late final Animation<double> _progress = CurvedAnimation(
    parent: _controller,
    curve: Interval(
      widget.delay.inMilliseconds /
          (widget.delay + _travel).inMilliseconds.toDouble(),
      1,
      curve: CaptureMotion.ease,
    ),
  );

  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    if (MediaQuery.maybeOf(context)?.disableAnimations ?? false) {
      _controller.value = 1;
      return;
    }
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _progress,
      builder: (context, child) => Opacity(
        opacity: _progress.value.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, 12.8 * (1 - _progress.value)),
          child: child,
        ),
      ),
      child: widget.child,
    );
  }
}
