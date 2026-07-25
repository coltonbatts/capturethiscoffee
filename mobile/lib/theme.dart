// Capture This design tokens, ported from the web app's `src/app/globals.css`
// custom properties and the primitives in `src/components/ui.tsx`.
//
// The direction is cream paper, black ink, hairline rules, and yellow used
// rarely at full strength. It replaces an earlier neo-brutalist treatment here
// (1.5px black borders everywhere, a black app bar, and yellow only ever as a
// low-alpha wash) that the web moved away from.
//
// Deliberately NOT set: a global `fontFamily`. The UI uses the iOS system font.
// The bundled Arial family exists solely so `label_painter.dart` matches the
// server renderer's metrics — it must never leak into the interface.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Palette. Hex values are the web's `--capture-*` custom properties verbatim;
/// keep the two in step.
abstract final class CaptureColors {
  /// `--capture-paper` — the page field. Every screen sits on this.
  static const paper = Color(0xFFF7F3EA);

  /// `--capture-surface` — cards and inputs, a half-step lighter than paper.
  static const surface = Color(0xFFFFFDF8);

  /// `--capture-surface-muted` — recessed fills.
  static const surfaceMuted = Color(0xFFEFEBE2);

  /// `--capture-ink` — text and primary actions. Not pure black.
  static const ink = Color(0xFF050505);

  /// `--capture-muted` — secondary text.
  static const muted = Color(0xFF656158);

  /// Placeholder / disabled text. Lighter than [muted], still legible on paper.
  static const faint = Color(0xFF9C988E);

  /// `--capture-yellow`. Used at full strength on one element per screen —
  /// never as a tint. A washed-out yellow reads as a mistake, not a brand.
  static const yellow = Color(0xFFF2EB0C);

  /// `--capture-danger`.
  static const danger = Color(0xFFA32929);

  /// `--capture-rule`, `rgb(5 5 5 / 0.18)` — the standard hairline.
  static const rule = Color(0x2E050505);

  /// `border-black/15` — the lighter hairline used between list rows.
  static const ruleSoft = Color(0x26050505);

  /// Disabled control fill and its label.
  static const disabledFill = Color(0xFFE4E0D6);
  static const disabledInk = Color(0xFF8C8880);

  static const errorSurface = Color(0xFFFBEDED);
  static const onErrorSurface = Color(0xFF7A1F1F);
}

/// `--capture-radius` is 0.75rem. Controls and cards share it so nothing looks
/// bolted on; only the hero action is softer.
abstract final class CaptureRadii {
  static const double control = 12;
  static const double card = 12;
  static const double hero = 14;
  static const double pill = 999;

  static final BorderRadius controlBorder =
      BorderRadius.circular(control);
  static final BorderRadius cardBorder = BorderRadius.circular(card);
  static final BorderRadius heroBorder = BorderRadius.circular(hero);
}

/// `--capture-ease`, the web's `cubic-bezier(0.22, 1, 0.36, 1)`.
abstract final class CaptureMotion {
  static const Curve ease = Cubic(0.22, 1, 0.36, 1);

  /// Overshoot, for the print-confirmation stamp.
  static const Curve spring = Cubic(0.34, 1.56, 0.64, 1);

  static const Duration fast = Duration(milliseconds: 180);
  static const Duration base = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 420);
}

/// Type scale. Titles are semibold with negative tracking, matching
/// `pageTitleClass` (`tracking-[-0.055em]`) rather than the w900 the app used
/// to reach for.
abstract final class CaptureType {
  static const TextTheme textTheme = TextTheme(
    headlineLarge: TextStyle(
      fontSize: 34,
      fontWeight: FontWeight.w600,
      letterSpacing: -1.87,
      height: 1.02,
      color: CaptureColors.ink,
    ),
    headlineMedium: TextStyle(
      fontSize: 28,
      fontWeight: FontWeight.w600,
      letterSpacing: -1.4,
      height: 1.06,
      color: CaptureColors.ink,
    ),
    headlineSmall: TextStyle(
      fontSize: 23,
      fontWeight: FontWeight.w600,
      letterSpacing: -1.0,
      height: 1.1,
      color: CaptureColors.ink,
    ),
    titleLarge: TextStyle(
      fontSize: 19,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.5,
      color: CaptureColors.ink,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.3,
      color: CaptureColors.ink,
    ),
    titleSmall: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.15,
      color: CaptureColors.ink,
    ),
    bodyLarge: TextStyle(
      fontSize: 16,
      height: 1.45,
      color: CaptureColors.ink,
    ),
    bodyMedium: TextStyle(
      fontSize: 14,
      height: 1.45,
      color: CaptureColors.ink,
    ),
    bodySmall: TextStyle(
      fontSize: 12.5,
      height: 1.4,
      color: CaptureColors.muted,
    ),
    labelLarge: TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.1,
    ),
    labelMedium: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: CaptureColors.ink,
    ),
  );

  /// Small uppercase metadata — the app-bar detail line, section eyebrows.
  static const TextStyle eyebrow = TextStyle(
    fontSize: 10.5,
    fontWeight: FontWeight.w600,
    letterSpacing: 1.2,
    color: CaptureColors.muted,
  );
}

/// Button styles beyond the themed default.
abstract final class CaptureButtons {
  /// The one yellow control on a screen: the action the operator came to take.
  /// Everything else is ink or outline.
  static ButtonStyle get accent => FilledButton.styleFrom(
        minimumSize: const Size(44, 56),
        backgroundColor: CaptureColors.yellow,
        foregroundColor: CaptureColors.ink,
        disabledBackgroundColor: CaptureColors.disabledFill,
        disabledForegroundColor: CaptureColors.disabledInk,
        elevation: 0,
        textStyle: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
        shape: RoundedRectangleBorder(borderRadius: CaptureRadii.heroBorder),
      );
}

ThemeData buildCaptureTheme() {
  const colorScheme = ColorScheme.light(
    primary: CaptureColors.ink,
    onPrimary: Colors.white,
    secondary: CaptureColors.yellow,
    onSecondary: CaptureColors.ink,
    surface: CaptureColors.paper,
    onSurface: CaptureColors.ink,
    surfaceContainerLowest: CaptureColors.surface,
    surfaceContainerHighest: CaptureColors.surfaceMuted,
    outline: CaptureColors.muted,
    outlineVariant: CaptureColors.rule,
    error: CaptureColors.danger,
    onError: Colors.white,
    errorContainer: CaptureColors.errorSurface,
    onErrorContainer: CaptureColors.onErrorSurface,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: CaptureColors.paper,
    canvasColor: CaptureColors.paper,
    textTheme: CaptureType.textTheme,
    dividerTheme: const DividerThemeData(
      color: CaptureColors.ruleSoft,
      thickness: 1,
      space: 1,
    ),
    // Cream, not black. The app bar used to be the heaviest element on every
    // screen; here it recedes into the page and the smiley carries the brand.
    appBarTheme: AppBarTheme(
      backgroundColor: CaptureColors.paper,
      foregroundColor: CaptureColors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleSpacing: 0,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      shape: const Border(
        bottom: BorderSide(color: CaptureColors.ruleSoft, width: 1),
      ),
      titleTextStyle: CaptureType.textTheme.titleMedium,
      iconTheme: const IconThemeData(color: CaptureColors.ink, size: 22),
    ),
    cardTheme: CardThemeData(
      color: CaptureColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: CaptureColors.ruleSoft, width: 1),
        borderRadius: CaptureRadii.cardBorder,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(44, 50),
        backgroundColor: CaptureColors.ink,
        foregroundColor: Colors.white,
        disabledBackgroundColor: CaptureColors.disabledFill,
        disabledForegroundColor: CaptureColors.disabledInk,
        elevation: 0,
        textStyle: CaptureType.textTheme.labelLarge,
        shape: RoundedRectangleBorder(
          borderRadius: CaptureRadii.controlBorder,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(44, 50),
        foregroundColor: CaptureColors.ink,
        disabledForegroundColor: CaptureColors.disabledInk,
        side: const BorderSide(color: CaptureColors.rule, width: 1),
        textStyle: CaptureType.textTheme.labelLarge,
        shape: RoundedRectangleBorder(
          borderRadius: CaptureRadii.controlBorder,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: CaptureColors.ink,
        minimumSize: const Size(44, 44),
        textStyle: CaptureType.textTheme.labelLarge,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: CaptureColors.ink,
        minimumSize: const Size(44, 44),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: CaptureColors.surface,
      hintStyle: const TextStyle(color: CaptureColors.faint),
      labelStyle: const TextStyle(
        color: CaptureColors.muted,
        fontWeight: FontWeight.w600,
      ),
      floatingLabelStyle: const TextStyle(
        color: CaptureColors.ink,
        fontWeight: FontWeight.w600,
      ),
      border: OutlineInputBorder(
        borderSide: const BorderSide(color: CaptureColors.rule, width: 1),
        borderRadius: CaptureRadii.controlBorder,
      ),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: CaptureColors.rule, width: 1),
        borderRadius: CaptureRadii.controlBorder,
      ),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: CaptureColors.ink, width: 2),
        borderRadius: CaptureRadii.controlBorder,
      ),
    ),
    // Outline pills, matching the web's `CountBadge` — not the yellow-tinted
    // fills these used to be.
    chipTheme: ChipThemeData(
      backgroundColor: Colors.transparent,
      side: const BorderSide(color: CaptureColors.rule, width: 1),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(CaptureRadii.pill),
      ),
      labelStyle: CaptureType.textTheme.labelMedium,
      iconTheme: const IconThemeData(color: CaptureColors.ink, size: 15),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? Colors.white
            : CaptureColors.surface,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? CaptureColors.ink
            : CaptureColors.surfaceMuted,
      ),
      trackOutlineColor: const WidgetStatePropertyAll(CaptureColors.rule),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: CaptureColors.ink,
      linearTrackColor: CaptureColors.surfaceMuted,
      circularTrackColor: Colors.transparent,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: CaptureColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: CaptureColors.rule, width: 1),
        borderRadius: CaptureRadii.cardBorder,
      ),
      titleTextStyle: CaptureType.textTheme.titleLarge,
      contentTextStyle: CaptureType.textTheme.bodyMedium,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: CaptureColors.paper,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      dragHandleColor: CaptureColors.rule,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
    ),
    listTileTheme: const ListTileThemeData(
      titleTextStyle: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        color: CaptureColors.ink,
      ),
      subtitleTextStyle: TextStyle(
        fontSize: 12.5,
        height: 1.4,
        color: CaptureColors.muted,
      ),
    ),
  );
}
