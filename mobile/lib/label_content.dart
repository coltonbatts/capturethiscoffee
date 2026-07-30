import 'label_template.dart';

/// The strings a label can show, plus its immutable template snapshot.
///
/// This is the Dart port of the `CoffeeLabel` fields that `drawGrid01` reads in
/// `src/lib/niimbot-m2-draw.ts`. The web type carries extra layout fields
/// (`title`, `bodyLines`, `footerStart`, `footerEnd`, `lines`) that only the
/// text/CSV exports use; the canvas renderer reads `personName`, `drink`,
/// `group`, `productionClient`, and `orderId`, so only those are ported.
///
/// The fallbacks below mirror `labelName`, `labelDrink`, `labelProduction`, and
/// `orderNumber` in the web renderer. Keep them in step: a divergence here shows
/// up as a physically wrong label, which is the one failure the operator cannot
/// undo.
class LabelContent {
  const LabelContent({
    required this.personName,
    required this.drink,
    required this.group,
    required this.productionClient,
    required this.orderNumber,
    this.productionName = '',
    this.clientName = '',
    this.template,
  });

  /// Builds label content from printer-queue fields.
  ///
  /// `drink` arrives already formatted by the server's `formatDrink`, so no
  /// drink-composition logic is duplicated here. That changes when the app
  /// starts capturing orders offline — see Phase C of
  /// `docs/offline-first-ios-handoff.md`.
  factory LabelContent.fromQueue({
    required String orderId,
    required String personName,
    required String drink,
    required String group,
    required String productionName,
    required String clientName,
    LabelTemplateVersion? template,
  }) {
    final productionClient = [productionName, clientName]
        .where((part) => part.isNotEmpty)
        .join(' / ');
    return LabelContent(
      personName: personName.trim(),
      drink: drink.trim(),
      // `buildPrinterQueue` already resolves group_label -> department -> "Set",
      // so a live queue never sends an empty group. Applying the same default
      // here keeps an older or hand-built payload rendering the same label the
      // server would produce, rather than falling through to `ON SET`.
      group: group.trim().isEmpty ? 'Set' : group.trim(),
      productionClient: productionClient.trim(),
      orderNumber: shortOrderNumber(orderId),
      productionName: productionName.trim(),
      clientName: clientName.trim(),
      template: template,
    );
  }

  final String personName;
  final String drink;
  final String group;
  final String productionClient;
  final String orderNumber;
  final String productionName;
  final String clientName;
  final LabelTemplateVersion? template;

  /// `labelName` in the web renderer.
  String get displayName => personName.trim();

  /// `labelDrink` in the web renderer.
  String get displayDrink => drink.trim();

  /// `labelProduction` in the web renderer.
  String get displayProduction {
    final value = productionClient.trim();
    return value.isEmpty ? 'Capture This Coffee' : value;
  }

  /// `orderNumber` in the web renderer, including its em-dash fallback.
  String get displayOrderNumber {
    final value = orderNumber.trim().replaceFirst(RegExp(r'^#'), '');
    return value.isEmpty ? '—' : value;
  }

  /// `group` falls back to `ON SET` at the call site in `drawGrid01`.
  ///
  /// Defensive on both sides: `LabelContent.fromQueue` and the server's
  /// `buildCoffeeLabels` both fill an empty group with `Set` first, so this
  /// branch only fires for a directly-constructed [LabelContent].
  String get displayGroup => group.trim().isEmpty ? 'ON SET' : group.trim();
}

/// Port of `shortOrderId` in `src/lib/label-copy.ts`.
///
/// Returns the six-character uppercase stub without the leading `#`; the `#`
/// is stripped again by `orderNumber` on the web side, so carrying it would be
/// pure ceremony.
String shortOrderNumber(String? id) {
  if (id == null) return '';
  final clean = id.replaceFirst(RegExp(r'^order-'), '').trim();
  if (clean.isEmpty || clean == 'manual') return '';
  final stub = clean.length > 6 ? clean.substring(0, 6) : clean;
  return stub.toUpperCase();
}
