import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../app_scope.dart';
import '../setup_controller.dart';
import '../setup_models.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/setup_widgets.dart';

class PersonEditorScreen extends StatefulWidget {
  const PersonEditorScreen({
    super.key,
    this.person,
    this.addToProductionId,
  });

  final SetupPerson? person;
  final String? addToProductionId;

  @override
  State<PersonEditorScreen> createState() => _PersonEditorScreenState();
}

class _PersonEditorScreenState extends State<PersonEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();
  late final TextEditingController _name;
  late final TextEditingController _role;
  late final TextEditingController _department;
  late final TextEditingController _company;
  late final TextEditingController _usual;
  late final TextEditingController _dietary;
  late final TextEditingController _notes;
  late SetupPersonType _type;
  late bool _active;
  late String _photoReference;
  Uint8List? _photoPreview;

  @override
  void initState() {
    super.initState();
    final value = widget.person?.toDraft() ?? const PersonDraft(name: '');
    _name = TextEditingController(text: value.name);
    _role = TextEditingController(text: value.role);
    _department = TextEditingController(text: value.department);
    _company = TextEditingController(text: value.company);
    _usual = TextEditingController(text: value.usualOrder);
    _dietary = TextEditingController(text: value.dietaryNotes);
    _notes = TextEditingController(text: value.notes);
    _type = value.type;
    _active = value.active;
    _photoReference = value.photoUrl;
  }

  @override
  void dispose() {
    _name.dispose();
    _role.dispose();
    _department.dispose();
    _company.dispose();
    _usual.dispose();
    _dietary.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.setupOf(context);
    final editing = widget.person != null;
    final quickAdd = widget.addToProductionId != null;
    return Scaffold(
      appBar: AppBar(
        title: BrandAppBarTitle(
          detail: editing
              ? 'Edit person'
              : quickAdd
                  ? 'Quick add'
                  : 'New person',
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (controller.busy) const LinearProgressIndicator(),
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 22, 16, 120),
                  children: [
                    Text(
                      editing ? 'Person details' : 'Add someone',
                      style: CaptureType.pageTitle,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      quickAdd
                          ? 'Create the person and their initial order in one online step.'
                          : 'Usuals help the operator move faster without pre-filling an order.',
                    ),
                    const SizedBox(height: 18),
                    SetupFailurePanel(
                      controller: controller,
                      onRetry: _save,
                    ),
                    if (controller.failure != null) const SizedBox(height: 16),
                    _PhotoField(
                      controller: controller,
                      person: widget.person,
                      preview: _photoPreview,
                      hasPhoto: _photoReference.isNotEmpty,
                      onCamera: controller.busy
                          ? null
                          : () => _choosePhoto(ImageSource.camera),
                      onLibrary: controller.busy
                          ? null
                          : () => _choosePhoto(ImageSource.gallery),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      key: const Key('person-name'),
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Name'),
                      validator: (value) =>
                          normalizeSetupName(value ?? '').isEmpty
                              ? 'Name is required.'
                              : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<SetupPersonType>(
                      initialValue: _type,
                      decoration: const InputDecoration(labelText: 'Type'),
                      items: [
                        for (final type in SetupPersonType.values)
                          DropdownMenuItem(
                            value: type,
                            child: Text(type.label),
                          ),
                      ],
                      onChanged: controller.busy
                          ? null
                          : (value) => setState(() => _type = value ?? _type),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _role,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Role'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _department,
                      textCapitalization: TextCapitalization.words,
                      decoration:
                          const InputDecoration(labelText: 'Department'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _company,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Company'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('person-usual'),
                      controller: _usual,
                      textCapitalization: TextCapitalization.sentences,
                      decoration:
                          const InputDecoration(labelText: 'Usual order'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('person-dietary-notes'),
                      controller: _dietary,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        labelText: 'Dietary / private notes',
                        helperText: 'Visible to signed-in operators only.',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('person-notes'),
                      controller: _notes,
                      textCapitalization: TextCapitalization.sentences,
                      decoration:
                          const InputDecoration(labelText: 'General notes'),
                      maxLines: 3,
                    ),
                    if (editing) ...[
                      const SizedBox(height: 14),
                      SwitchListTile(
                        key: const Key('person-active'),
                        contentPadding: EdgeInsets.zero,
                        title: Text(_active ? 'Active' : 'Archived'),
                        subtitle: const Text(
                          'Archived people stay in history and are hidden from add lists.',
                        ),
                        value: _active,
                        onChanged: controller.busy
                            ? null
                            : (value) => setState(() => _active = value),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          key: const Key('save-person'),
          style: CaptureButtons.accent,
          onPressed: controller.busy ? null : _save,
          child: Text(quickAdd ? 'Create & add to roster' : 'Save person'),
        ),
      ),
    );
  }

  Future<void> _choosePhoto(ImageSource source) async {
    final selected = await _picker.pickImage(
      source: source,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: 82,
      requestFullMetadata: false,
    );
    if (selected == null || !mounted) return;
    final bytes = await selected.readAsBytes();
    if (!mounted) return;
    final contentType = _imageContentType(selected.name);
    final controller = PrinterScope.setupOf(context);
    final reference = await controller.uploadPhoto(SetupPhotoUpload(
      bytes: bytes,
      fileName: selected.name,
      contentType: contentType,
    ));
    if (!mounted || reference == null) return;
    setState(() {
      _photoReference = reference;
      _photoPreview = bytes;
    });
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final controller = PrinterScope.setupOf(context);
    final draft = PersonDraft(
      name: _name.text,
      type: _type,
      role: _role.text,
      department: _department.text,
      company: _company.text,
      photoUrl: _photoReference,
      usualOrder: _usual.text,
      dietaryNotes: _dietary.text,
      notes: _notes.text,
      active: _active,
    );
    bool saved;
    if (widget.addToProductionId case final productionId?) {
      saved = await controller.createPersonAndAdd(productionId, draft);
    } else if (widget.person case final person?) {
      saved = await controller.updatePerson(person.id, draft) != null;
    } else {
      saved = await controller.createPerson(draft) != null;
    }
    if (saved && mounted) Navigator.of(context).pop(true);
  }
}

class _PhotoField extends StatelessWidget {
  const _PhotoField({
    required this.controller,
    required this.person,
    required this.preview,
    required this.hasPhoto,
    required this.onCamera,
    required this.onLibrary,
  });

  final SetupController controller;
  final SetupPerson? person;
  final Uint8List? preview;
  final bool hasPhoto;
  final VoidCallback? onCamera;
  final VoidCallback? onLibrary;

  @override
  Widget build(BuildContext context) {
    final current = person;
    Widget avatar;
    if (preview != null) {
      avatar = CircleAvatar(
        radius: 34,
        backgroundImage: MemoryImage(preview!),
      );
    } else if (current != null && current.photoUrl.isNotEmpty) {
      avatar = SetupPersonAvatar(
        controller: controller,
        person: current,
        radius: 34,
      );
    } else {
      avatar = CircleAvatar(
        radius: 34,
        backgroundColor: CaptureColors.surfaceMuted,
        child: Icon(
          hasPhoto ? Icons.check : Icons.person_outline,
          size: 30,
        ),
      );
    }
    return Row(
      children: [
        avatar,
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OutlinedButton.icon(
                key: const Key('person-camera'),
                onPressed: onCamera,
                icon: const Icon(Icons.photo_camera_outlined, size: 19),
                label: const Text('Camera'),
              ),
              const SizedBox(height: 6),
              TextButton.icon(
                key: const Key('person-library'),
                onPressed: onLibrary,
                icon: const Icon(Icons.photo_library_outlined, size: 19),
                label: const Text('Photo library'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

String _imageContentType(String name) {
  final extension = name.toLowerCase().split('.').last;
  return switch (extension) {
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'heic' => 'image/heic',
    'heif' => 'image/heif',
    _ => 'image/jpeg',
  };
}
