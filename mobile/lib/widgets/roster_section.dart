// The roster: every person on the day and where their label stands.
//
// The deck answers "what's next"; this answers "where is Priya". Those are
// different questions and the second one used to have no answer better than
// scrolling — on a forty-person call sheet that is not an answer.
//
// Presentational only. Filtering lives with the state in main.dart so the tiles
// keep their access to print, sync, and recovery actions.

import 'package:flutter/material.dart';

import '../production_board.dart';
import '../theme.dart';

enum RosterFilter { toPrint, printed, all }

extension RosterFilterLabel on RosterFilter {
  String get label => switch (this) {
        RosterFilter.toPrint => 'To print',
        RosterFilter.printed => 'Printed',
        RosterFilter.all => 'All',
      };
}

class RosterSection extends StatelessWidget {
  const RosterSection({
    super.key,
    required this.labels,
    required this.filter,
    required this.onFilterChanged,
    required this.searchController,
    required this.onQueryChanged,
    required this.query,
    required this.queueLoaded,
    required this.busy,
    required this.tileBuilder,
  });

  /// Already filtered and searched by the caller.
  final List<QueueLabel> labels;

  final RosterFilter filter;
  final ValueChanged<RosterFilter> onFilterChanged;
  final TextEditingController searchController;
  final ValueChanged<String> onQueryChanged;
  final String query;

  /// False before the first board load — distinguishes "nothing here" from
  /// "nothing loaded yet", which need different copy.
  final bool queueLoaded;

  final bool busy;
  /// `isLast` suppresses the row's separator so the list does not end on a
  /// rule floating above the card's padding.
  final Widget Function(BuildContext, QueueLabel, bool isLast) tileBuilder;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Roster', style: theme.textTheme.titleMedium),
                  ),
                  Text(
                    labels.length == 1 ? '1 person' : '${labels.length} people',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _search(context),
            const SizedBox(height: 10),
            _filters(),
            const SizedBox(height: 6),
            if (labels.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 28),
                child: Text(
                  _emptyMessage(),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall,
                ),
              )
            else
              for (final (index, item) in labels.indexed)
                tileBuilder(context, item, index == labels.length - 1),
          ],
        ),
      ),
    );
  }

  Widget _search(BuildContext context) {
    return TextField(
      controller: searchController,
      onChanged: onQueryChanged,
      textInputAction: TextInputAction.search,
      autocorrect: false,
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        hintText: 'Find someone',
        prefixIcon: const Icon(Icons.search, size: 20),
        prefixIconConstraints: const BoxConstraints(minWidth: 40),
        suffixIcon: query.isEmpty
            ? null
            : IconButton(
                onPressed: () {
                  searchController.clear();
                  onQueryChanged('');
                },
                icon: const Icon(Icons.close, size: 18),
                tooltip: 'Clear search',
              ),
      ),
    );
  }

  Widget _filters() {
    return Row(
      children: [
        for (final option in RosterFilter.values)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(option.label),
              selected: filter == option,
              showCheckmark: false,
              visualDensity: VisualDensity.compact,
              selectedColor: CaptureColors.ink,
              backgroundColor: Colors.transparent,
              side: BorderSide(
                color: filter == option
                    ? CaptureColors.ink
                    : CaptureColors.rule,
              ),
              labelStyle: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color:
                    filter == option ? Colors.white : CaptureColors.ink,
              ),
              onSelected: busy ? null : (_) => onFilterChanged(option),
            ),
          ),
      ],
    );
  }

  String _emptyMessage() {
    if (!queueLoaded) return 'Pull down to load the roster.';
    if (query.isNotEmpty) return 'Nobody matches “$query”.';
    return switch (filter) {
      RosterFilter.toPrint => 'Every label is printed.',
      RosterFilter.printed => 'Nothing printed yet.',
      RosterFilter.all => 'No one on this production yet.',
    };
  }
}
