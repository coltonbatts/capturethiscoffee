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
