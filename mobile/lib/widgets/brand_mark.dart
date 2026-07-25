// The Capture This smiley.
//
// `assets/capture-this-smiley.png` is byte-identical to the web's
// `public/capture-this-smiley.png` (sha256 21977fb0…). Keep it that way: the
// mark is a specific piece of hand-drawn artwork — asymmetric tilted eyes, a
// wobbling mouth with a flat left terminal and a flared upward tip on the
// right — and there is no vector source for it anywhere in the repo.
//
// That has one consequence worth stating plainly: animate this widget as a
// whole object (scale, rotate, fade). Do not trace it to paths to animate a
// blink or a wink. A trace would not survive contact with those terminals, and
// a subtly wrong smiley is worse than a still one.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

const String _smileyAsset = 'assets/capture-this-smiley.png';

/// The artwork's native pixel size. Decoding above this buys nothing.
const int _smileySourcePixels = 750;

/// The smiley, sized in logical pixels.
///
/// Decoding is capped to the on-screen size so a 26px header glyph does not
/// hold a full 750x750 bitmap in the image cache.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 36, this.semanticLabel});

  final double size;

  /// Defaults to a decorative mark. Pass a label only where the smiley is the
  /// sole carrier of meaning.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final ratio = MediaQuery.maybeOf(context)?.devicePixelRatio ?? 3.0;
    final decodeWidth = (size * ratio).round().clamp(1, _smileySourcePixels);

    return Image.asset(
      _smileyAsset,
      width: size,
      height: size,
      cacheWidth: decodeWidth,
      fit: BoxFit.contain,
      semanticLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
    );
  }
}

/// The smiley breathing, for waits with no measurable progress.
///
/// Replaces the spinner-plus-logo pairing on cold start: one mark doing one
/// thing reads calmer than a mark with a Material spinner under it, and it
/// matches the web shell's `animate-pulse` treatment.
class BrandPulse extends StatefulWidget {
  const BrandPulse({super.key, this.size = 76, this.semanticLabel});

  final double size;
  final String? semanticLabel;

  @override
  State<BrandPulse> createState() => _BrandPulseState();
}

class _BrandPulseState extends State<BrandPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Honour Reduce Motion, and keep goldens deterministic — an animation that
    // never starts cannot make a screenshot test flaky.
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) {
      _controller.stop();
      _controller.value = 1;
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mark = BrandMark(
      size: widget.size,
      semanticLabel: widget.semanticLabel,
    );

    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0.45).animate(
        CurvedAnimation(parent: _controller, curve: CaptureMotion.ease),
      ),
      child: mark,
    );
  }
}

/// The mark landing like a sticker being slapped down — the web's
/// `mark-arrive`, and the single most joyful thing on the site.
///
/// The keyframes from `src/app/page.module.css`, verbatim:
///
///   0%   opacity 0, translateY 20px,   rotate -4deg,   scale 0.92
///   72%  opacity 1, translateY -2.4px, rotate  0.6deg, scale 1.012
///   100% opacity 1, translateY 0,      rotate  0,      scale 1
///
/// 720ms on `cubic-bezier(0.2, 0.8, 0.2, 1)` after a 60ms delay.
///
/// The 72% waypoint is the entire effect: the mark overshoots past where it
/// lands and settles back, counter-rotating as it goes. The curve is applied to
/// each segment separately rather than once across the whole tween, because
/// that is how CSS treats a timing function between keyframes — flatten it to a
/// single interpolation and the overshoot disappears.
///
/// This animates the mark as one object, per the rule at the top of this file.
class ArrivingBrandMark extends StatefulWidget {
  const ArrivingBrandMark({super.key, this.size = 96, this.semanticLabel});

  final double size;
  final String? semanticLabel;

  @override
  State<ArrivingBrandMark> createState() => _ArrivingBrandMarkState();
}

class _ArrivingBrandMarkState extends State<ArrivingBrandMark>
    with SingleTickerProviderStateMixin {
  static const _curve = Cubic(0.2, 0.8, 0.2, 1);
  static const _deg = math.pi / 180;

  /// 60ms hold, then the 720ms roll. The delay is a weighted hold inside the
  /// sequence rather than a delayed `forward()`, so no stray timer is left
  /// behind for the widget tester to trip over.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 780),
  );

  late final Animation<double> _opacity = _keyframes(0, 1, 1);
  late final Animation<double> _translateY = _keyframes(20, -2.4, 0);
  late final Animation<double> _rotation = _keyframes(-4 * _deg, 0.6 * _deg, 0);
  late final Animation<double> _scale = _keyframes(0.92, 1.012, 1);

  bool _started = false;

  Animation<double> _keyframes(double from, double waypoint, double to) {
    return TweenSequence<double>([
      // The 60ms delay.
      TweenSequenceItem(tween: ConstantTween(from), weight: 60),
      // 0% → 72% of the 720ms roll.
      TweenSequenceItem(
        tween: Tween(begin: from, end: waypoint).chain(
          CurveTween(curve: _curve),
        ),
        weight: 518.4,
      ),
      // 72% → 100%: the settle back from the overshoot.
      TweenSequenceItem(
        tween: Tween(begin: waypoint, end: to).chain(
          CurveTween(curve: _curve),
        ),
        weight: 201.6,
      ),
    ]).animate(_controller);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    // Reduce Motion resolves to the landed state, and keeps goldens
    // deterministic — an animation that never starts cannot be flaky.
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
      animation: _controller,
      // Built once and passed through, so the image is not rebuilt on each of
      // the ~43 frames this entrance takes.
      child: BrandMark(size: widget.size, semanticLabel: widget.semanticLabel),
      builder: (context, child) => Opacity(
        opacity: _opacity.value.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, _translateY.value),
          child: Transform.rotate(
            angle: _rotation.value,
            child: Transform.scale(scale: _scale.value, child: child),
          ),
        ),
      ),
    );
  }
}

/// App-bar title: the mark, the product name, and a quiet uppercase detail.
///
/// The detail line used to be yellow-on-black. On a cream bar it is muted ink —
/// yellow is reserved for the one action per screen.
class BrandAppBarTitle extends StatelessWidget {
  const BrandAppBarTitle({super.key, required this.detail});

  final String detail;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const BrandMark(size: 30, semanticLabel: 'Capture This'),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Capture This',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 1),
              Text(
                detail.toUpperCase(),
                overflow: TextOverflow.ellipsis,
                style: CaptureType.eyebrow,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
