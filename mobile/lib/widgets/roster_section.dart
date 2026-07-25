// The roster's controls and its empty states.
//
// The deck answers "what's next"; the roster answers "where is Priya". Those
// are different questions and the second one used to have no answer better than
// scrolling — on a forty-person call sheet that is not an answer.
//
// The list itself is no longer here. It belongs to the screen, which builds it
// lazily: the board caps at 1000 entries and this used to build every row on
// every frame inside a Column.
//
// Presentational only. Filtering lives with the state on the controller so the
// rows keep their access to print, sync, and recovery actions.

import 'package:flutter/material.dart';

import '../theme.dart';

enum RosterFilter { toPrint, printed, all }

extension RosterFilterLabel on RosterFilter {
  String get label => switch (this) {
        RosterFilter.toPrint => 'To print',
        RosterFilter.printed => 'Printed',
        RosterFilter.all => 'All',
      };
}

/// Search and the three filters, pinned above the list.
///
/// Counts are baked into the chip labels, the way the web does it — "To print
/// (12)" answers the question the operator was going to ask next anyway.
class RosterControls extends StatelessWidget {
  const RosterControls({
    super.key,
    required this.filter,
    required this.onFilterChanged,
    required this.searchController,
    required this.onQueryChanged,
    required this.query,
    required this.busy,
    required this.counts,
  });

  final RosterFilter filter;
  final ValueChanged<RosterFilter> onFilterChanged;
  final TextEditingController searchController;
  final ValueChanged<String> onQueryChanged;
  final String query;
  final bool busy;

  /// How many rows each filter would show, ignoring the search query.
  final Map<RosterFilter, int> counts;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: searchController,
          onChanged: onQueryChanged,
          textInputAction: TextInputAction.search,
          autocorrect: false,
          decoration: InputDecoration(
            isDense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
        ),
        const SizedBox(height: 10),
        // Scrolls horizontally. Three chips carrying counts do not fit across a
        // narrow phone, and they get wider again at larger accessibility text
        // sizes — a fixed Row here overflows rather than adapting.
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final option in RosterFilter.values)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text('${option.label} (${counts[option] ?? 0})'),
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
                      color: filter == option ? Colors.white : CaptureColors.ink,
                    ),
                    onSelected: busy ? null : (_) => onFilterChanged(option),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The web's `EmptyState`: a yellow disc with a typed `:)`, a title, and a line
/// of explanation.
///
/// The smiley is deliberately *not* the artwork here — the web types the face
/// as two characters, which is a smaller, quieter joke than the brand mark and
/// right for a list that just came up empty.
class RosterEmptyState extends StatelessWidget {
  const RosterEmptyState({
    super.key,
    required this.filter,
    required this.query,
    required this.queueLoaded,
  });

  final RosterFilter filter;
  final String query;

  /// False before the first board load — distinguishes "nothing here" from
  /// "nothing loaded yet", which need different copy.
  final bool queueLoaded;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (title, description) = _copy();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 44),
      child: Column(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: CaptureColors.yellow,
              shape: BoxShape.circle,
            ),
            child: const Text(
              ':)',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: CaptureColors.ink,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(title, style: theme.textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(
            description,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  (String, String) _copy() {
    if (!queueLoaded) {
      return ('Nothing loaded yet', 'Pull down to load the roster.');
    }
    if (query.isNotEmpty) {
      return ('Nobody matches “$query”', 'Try a name or a drink.');
    }
    return switch (filter) {
      RosterFilter.toPrint => (
          'Every label is printed',
          'Nothing is waiting on the printer.',
        ),
      RosterFilter.printed => (
          'Nothing printed yet',
          'Printed labels collect here as they come off the M2_H.',
        ),
      RosterFilter.all => (
          'No one on this production yet',
          'Captured drink orders land here as the runner takes them.',
        ),
    };
  }
}
