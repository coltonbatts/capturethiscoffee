import 'production_board.dart';

/// Dart port of `parseUsualOrder` in
/// `src/server/operator/order-drafts.ts`.
///
/// Existing setup seeds the same structured fields into each order row, but
/// parsing again makes Accept usual correct for older rows and cached days.
OrderPatch parseUsualOrderPatch(String usualOrder) {
  final lower = usualOrder.toLowerCase();
  final parts = usualOrder
      .split(',')
      .map((part) => part.trim())
      .where((part) => part.isNotEmpty)
      .toList(growable: false);
  final size = ['small', 'medium', 'large'].cast<String?>().firstWhere(
        (item) => parts.any((part) => part.toLowerCase() == item),
        orElse: () => null,
      );
  final temperature = lower.contains('iced') || lower.contains('cold')
      ? 'Iced'
      : lower.contains('hot')
          ? 'Hot'
          : '';
  final milk = ['oat', 'almond', 'whole', 'cream'].cast<String?>().firstWhere(
        (item) => lower.contains(item!),
        orElse: () => null,
      );
  final drinkPart = parts.cast<String?>().firstWhere(
        (part) {
          final normalized = part!.toLowerCase();
          if (size != null && normalized == size) return false;
          if (normalized == 'hot' || normalized == 'iced') return false;
          if (milk != null && normalized == '$milk milk') return false;
          return true;
        },
        orElse: () => parts.isEmpty ? null : parts.first,
      ) ??
      '';
  final specialNotes = parts.where((part) {
    if (part == drinkPart) return false;
    final normalized = part.toLowerCase();
    if (size != null && normalized == size) return false;
    if (milk != null && normalized == '$milk milk') return false;
    return normalized != 'hot' && normalized != 'iced';
  }).join(', ');

  String titleCase(String value) =>
      value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}';

  return OrderPatch({
    OrderField.drinkType: drinkPart,
    OrderField.size: size == null ? '' : titleCase(size),
    OrderField.temperature: temperature,
    OrderField.milkType: milk == null ? '' : titleCase(milk),
    OrderField.sweetener: lower.contains('half sweet')
        ? 'Half sweet'
        : lower.contains('sweet')
            ? 'Sweetened'
            : '',
    OrderField.caffeine: 'Regular',
    OrderField.specialNotes: specialNotes,
    OrderField.status: 'confirmed',
  });
}
