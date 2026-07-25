// Capture This design tokens, ported from the web app's `src/app/globals.css`
// custom properties and the primitives in `src/components/ui.tsx`.
//
// The direction is cream paper, black ink, hairline rules, and yellow used
// rarely at full strength. It replaces an earlier neo-brutalist treatment here
// (1.5px black borders everywhere, a black app bar, and yellow only ever as a
// low-alpha wash) that the web moved away from.
//
// FONT POLICY — this reverses an earlier rule, deliberately.
//
// The interface font is Geist, set globally, because it is what the web uses
// (`src/app/layout.tsx` loads it via next/font/google) and the system font was
// the single largest reason the app did not read as the same product.
//
// The rule this replaces was "never set a global fontFamily", and it existed to
// stop the bundled Arial — which is LABEL type, sized to match the server
// renderer's metrics — from leaking into the UI. Naming Geist explicitly makes
// that leak *less* likely, not more: every interface surface now resolves to a
// named family instead of to whatever the platform default happens to be.
//
// The invariant that matters runs the other way, and it is enforced elsewhere:
// Geist must never reach a label. `label_painter.dart` has exactly one
// text-drawing site and it names `labelFontFamily` on that TextStyle, so no
// ThemeData value can be inherited into a label. The four goldens in
// `test/label_golden_test.dart` are the regression proof — if a change to this
// file moves them, the change is wrong, not the goldens.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// The interface family. Never use this for label rendering.
const String kInterfaceFont = 'Geist';

/// Monospace, for the activity log. Replaces the hardcoded Menlo.
const String kInterfaceMonoFont = 'GeistMono';

/// Geist is variable across `wght` 100-900, so the web's off-scale weights
/// survive the port instead of being rounded to the nearest static face.
///
/// [FontWeight] is set alongside every one of these as a fallback for the
/// case where the variable axis is unavailable; the two must agree or text
/// renders at one weight in tests and another on device.
List<FontVariation> _wght(double weight) => [FontVariation('wght', weight)];

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

  /// Roster status rail, "needs order". The web's `bg-amber-400`
  /// (`components.tsx` RosterCard). Amber means *still needs you* — it is the
  /// one place a warm colour appears that is not the brand yellow, and the two
  /// must not be confused: yellow is an action, amber is a state.
  static const amber = Color(0xFFFBBF24);

  /// Roster status rail, indeterminate. The web's `bg-zinc-400`, which it uses
  /// for "no drink"; here it marks a label whose physical outcome is unknown.
  ///
  /// Grey is right for it: the row is neither done nor waiting its turn, and
  /// giving it amber would put it in a queue it is not in.
  static const zinc400 = Color(0xFFA1A1AA);

  /// The only green in the product, and it appears in exactly one place: the
  /// "All drinks captured" pill. If green shows up anywhere else, that is a
  /// bug — a second celebratory colour makes the first one mean nothing.
  static const emeraldSurface = Color(0xFFECFDF5);
  static const onEmeraldSurface = Color(0xFF064E3B);
}

/// Radii, corrected against the web on 2026-07-25.
///
/// These were all 12-14 here, which flattened a distinction the web actually
/// makes: controls are `rounded-lg` (8) and containers are `rounded-xl` (12).
/// Matching it is most of why the app read as softer and less precise than the
/// site.
abstract final class CaptureRadii {
  /// `rounded-lg` — buttons, inputs, chips. Was 12; the web has always been 8.
  static const double control = 8;

  /// `rounded-xl` — cards and panels.
  static const double card = 12;

  /// `rounded-t-2xl` — bottom sheet top corners.
  static const double sheet = 16;

  static const double pill = 999;

  /// The home screen's primary action is SQUARE, matching `.primaryAction` in
  /// `src/app/page.module.css` — the only control in the product with no
  /// radius at all. It is a deliberate, load-bearing detail: the one action
  /// that is not shaped like everything else. One line to revert if it reads
  /// wrong on device.
  static const double hero = 0;

  static final BorderRadius controlBorder = BorderRadius.circular(control);
  static final BorderRadius cardBorder = BorderRadius.circular(card);
  static final BorderRadius heroBorder = BorderRadius.circular(hero);
  static const BorderRadius sheetBorder =
      BorderRadius.vertical(top: Radius.circular(sheet));
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
///
/// `letterSpacing` is in logical pixels here but the web specifies `em`, so
/// every value below is the em figure multiplied by its own font size. Change
/// a size and you must recompute its tracking — that is the one arithmetic
/// trap in this file.
abstract final class CaptureType {
  static final TextTheme textTheme = TextTheme(
    headlineLarge: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 34,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      letterSpacing: -1.87, // -0.055em
      height: 1.02,
      color: CaptureColors.ink,
    ),
    headlineMedium: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 28,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      letterSpacing: -1.54, // -0.055em
      height: 1.06,
      color: CaptureColors.ink,
    ),
    headlineSmall: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 23,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      letterSpacing: -1.0,
      height: 1.1,
      color: CaptureColors.ink,
    ),
    titleLarge: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 19,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      letterSpacing: -0.5,
      color: CaptureColors.ink,
    ),
    titleMedium: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 16,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      letterSpacing: -0.3,
      color: CaptureColors.ink,
    ),
    titleSmall: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      letterSpacing: -0.15,
      color: CaptureColors.ink,
    ),
    bodyLarge: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      fontVariations: _wght(400),
      height: 1.45,
      color: CaptureColors.ink,
    ),
    bodyMedium: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      fontVariations: _wght(400),
      height: 1.45,
      color: CaptureColors.ink,
    ),
    bodySmall: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 12.5,
      fontWeight: FontWeight.w400,
      fontVariations: _wght(400),
      height: 1.4,
      color: CaptureColors.muted,
    ),
    labelLarge: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 15,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      letterSpacing: -0.1,
    ),
    labelMedium: TextStyle(
      fontFamily: kInterfaceFont,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      fontVariations: _wght(600),
      color: CaptureColors.ink,
    ),
  );

  /// The splash headline — `.title` in `src/app/page.module.css`.
  ///
  /// The web ranges 64-110px; this is the phone value from its ≤520px branch
  /// (`clamp(3.15rem, 14.5vw, 4rem)`). Weight 750 and line-height 0.84 are the
  /// identity: the two lines of "Capture This / Coffee" nearly touch, which is
  /// the whole effect. Do not round 750 to 700 — Geist is variable precisely so
  /// this survives.
  static final TextStyle hero = TextStyle(
    fontFamily: kInterfaceFont,
    fontSize: 52,
    fontWeight: FontWeight.w800,
    fontVariations: _wght(750),
    letterSpacing: -3.9, // -0.075em
    height: 0.84,
    color: CaptureColors.ink,
  );

  /// Screen titles — `pageTitleClass`, the app's most identity-defining value.
  static final TextStyle pageTitle = TextStyle(
    fontFamily: kInterfaceFont,
    fontSize: 30,
    fontWeight: FontWeight.w600,
    fontVariations: _wght(600),
    letterSpacing: -1.65, // -0.055em
    height: 1.0,
    color: CaptureColors.ink,
  );

  /// The expanded roster row's name — the web's `RosterCard` heading. Large on
  /// purpose: it is read at arm's length, on set, holding a phone and a tray.
  static final TextStyle rowName = TextStyle(
    fontFamily: kInterfaceFont,
    fontSize: 21.6,
    fontWeight: FontWeight.w600,
    fontVariations: _wght(600),
    letterSpacing: -0.76, // -0.035em
    height: 1.03,
    color: CaptureColors.ink,
  );

  /// The big counts. Tabular figures are not cosmetic here — the deck animates
  /// this number downward, and proportional digits make it jitter as it counts.
  static final TextStyle statNumber = TextStyle(
    fontFamily: kInterfaceFont,
    fontSize: 30,
    fontWeight: FontWeight.w600,
    fontVariations: _wght(600),
    letterSpacing: -1.2, // -0.04em
    height: 1.0,
    color: CaptureColors.ink,
    fontFeatures: const [FontFeature.tabularFigures()],
  );

  /// The supporting line under the splash headline — `.supporting`, weight 460.
  static final TextStyle heroBody = TextStyle(
    fontFamily: kInterfaceFont,
    fontSize: 17,
    fontWeight: FontWeight.w500,
    fontVariations: _wght(460),
    letterSpacing: -0.34, // -0.02em
    height: 1.45,
    color: CaptureColors.muted,
  );

  /// Activity log. Replaces the hardcoded Menlo.
  static final TextStyle mono = TextStyle(
    fontFamily: kInterfaceMonoFont,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    fontVariations: _wght(400),
    height: 1.5,
    color: CaptureColors.muted,
  );

  /// Small uppercase metadata — the app-bar detail line, section eyebrows.
  static final TextStyle eyebrow = TextStyle(
    fontFamily: kInterfaceFont,
    fontSize: 10.5,
    fontWeight: FontWeight.w600,
    fontVariations: _wght(600),
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
        textStyle: TextStyle(
          fontFamily: kInterfaceFont,
          fontSize: 17,
          fontWeight: FontWeight.w600,
          fontVariations: _wght(600),
          letterSpacing: -0.2,
        ),
        shape: RoundedRectangleBorder(borderRadius: CaptureRadii.controlBorder),
      );

  /// The splash / home primary action, and the ONLY square control in the
  /// product — `.primaryAction` in `src/app/page.module.css` carries no radius
  /// at all. Kept separate from [accent] on purpose: squaring every yellow
  /// button, including the deck's print action, would overshoot what the web
  /// actually does and cost the deck its familiar shape.
  ///
  /// Weight 650 and a taller 56px box match the web's hero CTA.
  static ButtonStyle get heroAction => FilledButton.styleFrom(
        minimumSize: const Size(44, 56),
        backgroundColor: CaptureColors.yellow,
        foregroundColor: CaptureColors.ink,
        disabledBackgroundColor: CaptureColors.disabledFill,
        disabledForegroundColor: CaptureColors.disabledInk,
        elevation: 0,
        textStyle: TextStyle(
          fontFamily: kInterfaceFont,
          fontSize: 17,
          fontWeight: FontWeight.w600,
          fontVariations: _wght(650),
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
    // Interface type. Catches anything that builds a TextStyle without going
    // through CaptureType — never the label renderer, which names its own.
    fontFamily: kInterfaceFont,
    scaffoldBackgroundColor: CaptureColors.paper,
    canvasColor: CaptureColors.paper,
    textTheme: CaptureType.textTheme,
    // Yellow highlighter on selected text, matching the web's
    // `::selection { background: #f2eb0c }`. One of two places yellow is
    // allowed to appear alongside a yellow action: neither is a control, so
    // neither competes for "the thing to press".
    textSelectionTheme: const TextSelectionThemeData(
      selectionColor: CaptureColors.yellow,
      cursorColor: CaptureColors.ink,
      selectionHandleColor: CaptureColors.ink,
    ),
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
      shape: RoundedRectangleBorder(borderRadius: CaptureRadii.sheetBorder),
    ),
    listTileTheme: ListTileThemeData(
      titleTextStyle: TextStyle(
        fontFamily: kInterfaceFont,
        fontSize: 15,
        fontWeight: FontWeight.w600,
        fontVariations: _wght(600),
        letterSpacing: -0.2,
        color: CaptureColors.ink,
      ),
      subtitleTextStyle: TextStyle(
        fontFamily: kInterfaceFont,
        fontSize: 12.5,
        fontWeight: FontWeight.w400,
        fontVariations: _wght(400),
        height: 1.4,
        color: CaptureColors.muted,
      ),
    ),
  );
}
