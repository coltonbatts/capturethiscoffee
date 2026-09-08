import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../setup_models.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/setup_widgets.dart';
import 'person_editor_screen.dart';

class PeopleScreen extends StatefulWidget {
  const PeopleScreen({super.key});

  static const route = '/people';

  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  final _search = TextEditingController();
  bool _showArchived = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) PrinterScope.setupOf(context).loadPeople();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    final people = controller.searchPeople(
      _search.text,
      includeArchived: _showArchived,
    );
    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'People'),
        actions: [
          IconButton(
            onPressed: controller.busy ? null : controller.loadPeople,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh people',
          ),
        ],
      ),
      body: SafeArea(
        child: CustomScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          slivers: [
            if (controller.busy)
              const SliverToBoxAdapter(child: LinearProgressIndicator()),
            SliverToBoxAdapter(
                child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('People', style: CaptureType.pageTitle),
                  const SizedBox(height: 6),
                  Text(
                    '${people.length} people · names, roles, and usual orders',
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    key: const Key('people-search'),
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    decoration: const InputDecoration(
                      labelText: 'Find a person',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _showArchived,
                    title: const Text('Show archived'),
                    onChanged: (value) =>
                        setState(() => _showArchived = value ?? false),
                  ),
                  SetupFailurePanel(
                    controller: controller,
                    onRetry: controller.loadPeople,
                  ),
                ],
              ),
            )),
            if (people.isEmpty && !controller.busy)
              const SliverFillRemaining(
                  hasScrollBody: false, child: _EmptyPeople())
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 100),
                sliver: SliverList.separated(
                  key: const Key('people-list'),
                  itemCount: people.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) => _PersonRow(
                      person: people[index], onTap: () => _edit(people[index])),
                ),
              ),
          ],
        ),
      ),
      floatingActionButton: MediaQuery.viewInsetsOf(context).bottom > 0
          ? null
          : FloatingActionButton.extended(
              key: const Key('new-person'),
              heroTag: 'new-person',
              backgroundColor: controller.busy
                  ? CaptureColors.disabledFill
                  : CaptureColors.yellow,
              foregroundColor: CaptureColors.ink,
              onPressed: controller.busy
                  ? null
                  : () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const PersonEditorScreen(),
                        ),
                      ),
              icon: const Icon(Icons.person_add_alt_1_outlined),
              label: const Text('New person'),
            ),
    );
  }

  Future<void> _edit(SetupPerson person) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PersonEditorScreen(person: person),
      ),
    );
    if (mounted) setState(() {});
  }
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({required this.person, required this.onTap});

  final SetupPerson person;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    return ListTile(
      key: Key('person-${person.id}'),
      dense: true,
      leading: SetupPersonAvatar(controller: controller, person: person),
      title: Text(person.name),
      subtitle: Text(
        [
          setupPersonDetail(person),
          if (!person.active) 'Archived',
        ].join(' · '),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

class _EmptyPeople extends StatelessWidget {
  const _EmptyPeople();

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Text(
            'No matching people.',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
      );
}
