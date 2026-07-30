import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../setup_models.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/setup_widgets.dart';
import 'person_editor_screen.dart';

class AddPeopleScreen extends StatefulWidget {
  const AddPeopleScreen({
    super.key,
    required this.productionId,
  });

  final String productionId;

  @override
  State<AddPeopleScreen> createState() => _AddPeopleScreenState();
}

class _AddPeopleScreenState extends State<AddPeopleScreen> {
  final _search = TextEditingController();
  SetupPerson? _lastAttempt;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    final people = controller.peopleNotOnRoster(_search.text);
    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'Add to roster'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Find someone', style: CaptureType.pageTitle),
                  const SizedBox(height: 8),
                  const Text(
                    'Adding someone creates exactly one initial order with the roster row.',
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    key: const Key('add-person-search'),
                    controller: _search,
                    autofocus: true,
                    decoration: const InputDecoration(
                      labelText: 'Search people',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  SetupFailurePanel(
                    controller: controller,
                    onRetry:
                        _lastAttempt == null ? null : () => _add(_lastAttempt!),
                  ),
                ],
              ),
            ),
            Expanded(
              child: people.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Text(
                          _search.text.trim().isEmpty
                              ? 'Everyone active is already on this roster.'
                              : 'No active person matches that search.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : ListView.separated(
                      key: const Key('add-people-list'),
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 100),
                      itemCount: people.length,
                      separatorBuilder: (_, __) => const Divider(),
                      itemBuilder: (context, index) {
                        final person = people[index];
                        return _AddPersonRow(
                          person: person,
                          enabled: !controller.busy,
                          onAdd: () => _add(person),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('quick-create-person'),
        heroTag: 'quick-create-person',
        backgroundColor: CaptureColors.yellow,
        foregroundColor: CaptureColors.ink,
        onPressed: controller.busy
            ? null
            : () async {
                final added = await Navigator.of(context).push<bool>(
                  MaterialPageRoute<bool>(
                    builder: (_) => PersonEditorScreen(
                      addToProductionId: widget.productionId,
                    ),
                  ),
                );
                if (added == true && mounted) setState(() {});
              },
        icon: const Icon(Icons.person_add_alt_1_outlined),
        label: const Text('Quick create'),
      ),
    );
  }

  Future<void> _add(SetupPerson person) async {
    _lastAttempt = person;
    final added = await PrinterScope.setupOf(context)
        .addExisting(widget.productionId, person.id);
    if (added && mounted) setState(() {});
  }
}

class _AddPersonRow extends StatelessWidget {
  const _AddPersonRow({
    required this.person,
    required this.enabled,
    required this.onAdd,
  });

  final SetupPerson person;
  final bool enabled;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) => ListTile(
        dense: true,
        leading: SetupPersonAvatar(
          controller: PrinterScope.setupOf(context),
          person: person,
        ),
        title: Text(person.name),
        subtitle: Text(
          setupPersonDetail(person),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: IconButton(
          key: Key('add-${person.id}'),
          onPressed: enabled ? onAdd : null,
          icon: const Icon(Icons.add_circle_outline),
          tooltip: 'Add ${person.name}',
        ),
        onTap: enabled ? onAdd : null,
      );
}
