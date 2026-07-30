import 'drink_format.dart';
import 'production_board.dart';

class CoffeeShopSummaryLine {
  const CoffeeShopSummaryLine({
    required this.drink,
    required this.count,
    required this.people,
  });

  final String drink;
  final int count;
  final List<String> people;
}

enum PersonSummaryState {
  waiting,
  captured,
  printed,
  noDrink,
}

class PersonSummaryLine {
  const PersonSummaryLine({
    required this.name,
    required this.group,
    required this.drink,
    required this.state,
  });

  final String name;
  final String group;
  final String drink;
  final PersonSummaryState state;

  String get stateLabel => switch (state) {
        PersonSummaryState.waiting => 'Waiting',
        PersonSummaryState.captured => 'Captured · waiting to print',
        PersonSummaryState.printed => 'Printed',
        PersonSummaryState.noDrink => 'No drink',
      };
}

class DayOperatingSummary {
  const DayOperatingSummary({
    required this.production,
    required this.progress,
    required this.coffeeShop,
    required this.people,
  });

  final BoardProduction production;
  final BoardProgress progress;
  final List<CoffeeShopSummaryLine> coffeeShop;
  final List<PersonSummaryLine> people;

  int get waitingToPrint => progress.captured - progress.printed;
}

DayOperatingSummary buildDayOperatingSummary(ProductionBoard board) {
  final grouped = <String, List<String>>{};
  final people = <PersonSummaryLine>[];

  for (final entry in board.roster) {
    if (!entry.onSetToday) continue;
    final order = entry.order;
    final state = switch (order) {
      null => PersonSummaryState.waiting,
      _ when order.needsOrder => PersonSummaryState.waiting,
      _ when order.isNoDrink => PersonSummaryState.noDrink,
      _ when order.labelPrinted => PersonSummaryState.printed,
      _ => PersonSummaryState.captured,
    };
    final drink = switch (state) {
      PersonSummaryState.waiting => 'Order not captured',
      PersonSummaryState.noDrink => 'No drink',
      _ => formatDrink(order!),
    };
    people.add(PersonSummaryLine(
      name: entry.person.name,
      group: entry.group,
      drink: drink,
      state: state,
    ));
    if (state == PersonSummaryState.captured ||
        state == PersonSummaryState.printed) {
      grouped.putIfAbsent(drink, () => <String>[]).add(entry.person.name);
    }
  }

  final coffeeShop = grouped.entries
      .map((entry) => CoffeeShopSummaryLine(
            drink: entry.key,
            count: entry.value.length,
            people: List.unmodifiable(entry.value),
          ))
      .toList()
    ..sort((a, b) {
      final byCount = b.count.compareTo(a.count);
      return byCount == 0 ? a.drink.compareTo(b.drink) : byCount;
    });

  return DayOperatingSummary(
    production: board.production,
    progress: productionBoardProgress(board),
    coffeeShop: List.unmodifiable(coffeeShop),
    people: List.unmodifiable(people),
  );
}

String buildDaySummaryShareText(DayOperatingSummary summary) {
  final progress = summary.progress;
  final lines = <String>[
    'Capture This — ${summary.production.name}',
    if (summary.production.clientName.trim().isNotEmpty)
      summary.production.clientName.trim(),
    '',
    'Coffee shop order',
    if (summary.coffeeShop.isEmpty) 'No drinks captured.',
    for (final line in summary.coffeeShop)
      '${line.count} × ${line.drink} — ${line.people.join(', ')}',
    '',
    'By person',
    for (final person in summary.people)
      '${person.name} · ${person.group} · ${person.drink} · ${person.stateLabel}',
    '',
    'Captured ${progress.captured} · Printed ${progress.printed} · '
        'Waiting ${progress.needsOrder} · No drink ${progress.noDrink}',
  ];
  return lines.join('\n');
}
