/// Dart port of `formatDrink` from `src/lib/order-summary.ts` and the capture
/// helpers from `src/lib/order-progress.ts`.
///
/// The app used to read a pre-formatted `drink` string off the printer-queue
/// endpoint. It now reads the board endpoint, which sends raw order columns, so
/// the composition rules have to live here too.
///
/// These rules are load-bearing: they decide what is physically printed on a
/// cup. A divergence from the web means the same order prints differently
/// depending on which surface produced the label. `tests/order-summary` has no
/// direct counterpart, so `mobile/test/drink_format_test.dart` pins the cases
/// that matter.
library;

const _sizeLabels = <String, String>{
  'small': 'Small',
  'medium': 'Medium',
  'large': 'Large',
};

const _temperatureLabels = <String, String>{
  'hot': 'Hot',
  'iced': 'Iced',
};

/// The order fields drink composition reads. Deliberately narrower than the
/// full board order — mirrors `DrinkSummaryOrder` on the web.
abstract interface class DrinkSummaryOrder {
  String get status;
  String get drinkType;
  String get size;
  String get temperature;
  String get milkType;
  String get sweetener;
  String get caffeine;
  String get specialNotes;
}

/// Builds the one-line drink description shown on the label and in the queue.
String formatDrink(DrinkSummaryOrder? order) {
  if (order == null || order.status == 'no_order') return 'No order';

  var drink = _cleanPart(order.drinkType);
  var notes = _cleanPart(order.specialNotes);
  final size = _labelFromKnownValue(order.size, _sizeLabels);
  final temperature =
      _labelFromKnownValue(order.temperature, _temperatureLabels);
  final milk = _formatMilk(order.milkType);

  if (size.isNotEmpty && _sameMeaning(drink, size)) drink = '';
  if (temperature.isNotEmpty && _sameMeaning(drink, temperature)) drink = '';

  // A runner who types "oat latte" into notes and leaves drink_type empty still
  // gets a usable label.
  if (_looksLikeDrink(notes) && (drink.isEmpty || _sameMeaning(drink, size))) {
    drink = notes;
    notes = '';
  }

  final parts = <String>[
    size.isNotEmpty && !_containsMeaning(drink, size) ? size : '',
    temperature.isNotEmpty && !_containsMeaning(drink, temperature)
        ? temperature
        : '',
    drink,
    milk.isNotEmpty && !_containsMeaning(drink, milk) ? milk : '',
    _cleanPart(order.sweetener),
    order.caffeine.isNotEmpty && order.caffeine != 'Regular'
        ? _cleanPart(order.caffeine)
        : '',
    notes,
  ].where((part) => part.isNotEmpty).toList();

  final joined = parts.join(', ');
  return joined.isEmpty ? 'Order not entered' : joined;
}

/// `isOrderCaptured` in `src/lib/order-progress.ts`.
///
/// The stored `OrderStatus` enum is wider than the UI: the legacy pipeline
/// statuses (confirmed/ordered/picked_up/delivered) all count as captured, so
/// historical rows keep printing without a migration.
bool isOrderCaptured(String? status) =>
    status != null && status != 'not_asked' && status != 'no_order';

/// `isOrderSkipped` in `src/lib/order-progress.ts`.
bool isOrderSkipped(String? status) => status == 'no_order';

/// `needsOrder` in `src/lib/order-progress.ts`.
bool needsOrder(String? status) => status == null || status == 'not_asked';

String _cleanPart(String? value) {
  if (value == null) return '';
  return value.trim().replaceAll(RegExp(r'\s+'), ' ');
}

String _labelFromKnownValue(String? value, Map<String, String> labels) {
  final clean = _cleanPart(value);
  if (clean.isEmpty) return '';
  return labels[_normalize(clean)] ?? clean;
}

String _formatMilk(String? value) {
  final clean = _cleanPart(value);
  if (clean.isEmpty) return '';
  return RegExp(r'\bmilk\b', caseSensitive: false).hasMatch(clean)
      ? clean
      : '${_capitalize(clean)} milk';
}

String _capitalize(String value) =>
    value.isEmpty ? value : value[0].toUpperCase() + value.substring(1);

String _normalize(String? value) => _cleanPart(value)
    .toLowerCase()
    .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
    .trim();

bool _sameMeaning(String? a, String? b) {
  if (a == null || b == null || a.isEmpty || b.isEmpty) return false;
  return _normalize(a) == _normalize(b);
}

bool _containsMeaning(String? haystack, String? needle) {
  final normalizedHaystack = ' ${_normalize(haystack)} ';
  final normalizedNeedle = _normalize(needle);
  if (normalizedHaystack.trim().isEmpty || normalizedNeedle.isEmpty) {
    return false;
  }

  if (normalizedHaystack.contains(' $normalizedNeedle ')) return true;

  // "Oat milk" should not be appended to a drink that already says "oat".
  if (normalizedNeedle.endsWith(' milk')) {
    final milkBase = normalizedNeedle.replaceAll(RegExp(r'\s+milk$'), '');
    return normalizedHaystack.contains(' $milkBase ');
  }

  return false;
}

final _drinkWords = RegExp(
  r'\b(latte|coffee|cold brew|matcha|tea|chai|americano|cappuccino|espresso|mocha|drip|cortado|macchiato|flat white)\b',
  caseSensitive: false,
);

bool _looksLikeDrink(String value) => _drinkWords.hasMatch(value);
