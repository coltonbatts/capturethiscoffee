// The Build 8 share-link flow, retained as Build 9's migration fallback.
//
// This is not pushed as a route. It is what the root shows when there is no
// session, so there is nothing to navigate back to — an operator with no linked
// production has exactly one thing to do.
//
// On validation: a mistyped link and a Bluetooth scan timeout are not the same
// kind of problem and no longer share a banner. Anything wrong with what was
// typed is answered under the field, in words about the link. The banner is
// left for things that went wrong out in the world — no signal, a dead
// production, a server that said no.
//
// On the clipboard: there is a Paste button and deliberately no automatic
// clipboard sniff on open. Reading the pasteboard triggers iOS's "pasted from
// Safari" banner, and doing that with no user action reads as snooping. Behind
// a button it is an obvious consequence of a tap.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_scope.dart';
import '../production_session.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/motion.dart';
import '../widgets/status_banners.dart';

/// Why a pasted link cannot be used, in words about the link.
///
/// [parseProductionShareUrl] is the security boundary and stays the only thing
/// that decides whether a link is acceptable — this only explains a rejection
/// it has already made. It must never quote the token back.
String linkValidationMessage(String raw) {
  final text = raw.trim();
  if (text.isEmpty) {
    return 'Paste the production share link from the coordinator.';
  }

  final uri = Uri.tryParse(text);
  if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
    return 'That does not look like a link. Copy the whole thing, starting '
        'with https://';
  }
  if ((uri.queryParameters['token'] ?? '').isEmpty) {
    return 'That link has no ?token= on the end. Copy the whole link rather '
        'than the part you can read.';
  }
  if (uri.scheme != 'https') {
    return 'Only https links are accepted.';
  }
  return 'That is not a production share link. It should look like '
      'https://…/run/…?token=…';
}

class LinkScreen extends StatefulWidget {
  const LinkScreen({
    super.key,
    required this.onShowHelp,
    this.onBackToSignIn,
  });

  final VoidCallback onShowHelp;
  final VoidCallback? onBackToSignIn;

  @override
  State<LinkScreen> createState() => _LinkScreenState();
}

class _LinkScreenState extends State<LinkScreen> {
  final _linkController = TextEditingController();
  String? _fieldError;

  @override
  void dispose() {
    _linkController.dispose();
    super.dispose();
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim() ?? '';
    if (!mounted) return;

    if (text.isEmpty) {
      setState(() => _fieldError = 'The clipboard is empty.');
      return;
    }
    _linkController.text = text;
    setState(() {
      // Say so immediately rather than waiting for a failed tap on Link.
      _fieldError = parseProductionShareUrl(text) == null
          ? linkValidationMessage(text)
          : null;
    });
  }

  Future<void> _submit() async {
    final text = _linkController.text;
    if (parseProductionShareUrl(text) == null) {
      setState(() => _fieldError = linkValidationMessage(text));
      return;
    }
    setState(() => _fieldError = null);
    // The controller parses again. That is deliberate: it keeps
    // parseProductionShareUrl the single gate on what becomes a session, rather
    // than trusting this screen to have checked.
    await PrinterScope.of(context).linkProduction(text);
  }

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.of(context);
    final hasText = _linkController.text.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        leading: widget.onBackToSignIn == null
            ? null
            : IconButton(
                onPressed: widget.onBackToSignIn,
                icon: const Icon(Icons.arrow_back),
                tooltip: 'Back to sign in',
              ),
        title: const BrandAppBarTitle(detail: 'Coffee label printer'),
        actions: [
          IconButton(
            onPressed: widget.onShowHelp,
            icon: const Icon(Icons.help_outline),
            tooltip: 'How to use Capture This',
          ),
        ],
      ),
      body: SafeArea(
        // Centred in the viewport like the web splash, but still scrollable, so
        // the keyboard can push past it instead of squashing the hero.
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: ArrivingBrandMark(size: 132)),
                    const SizedBox(height: 28),

                    // The site's headline, at the site's scale: weight 750,
                    // line-height 0.84, tracking -0.075em, on two lines that
                    // nearly touch. That near-collision is the whole effect —
                    // do not let these become one line or gain leading.
                    CascadeIn(
                      delay: const Duration(milliseconds: 190),
                      child: Text(
                        'Capture This\nCoffee',
                        style: CaptureType.hero,
                      ),
                    ),
                    const SizedBox(height: 18),
                    CascadeIn(
                      delay: const Duration(milliseconds: 270),
                      child: Text(
                        'Good coffee. Even on a 5 AM call.',
                        style: CaptureType.heroBody,
                      ),
                    ),
                    const SizedBox(height: 32),

                    CascadeIn(
                      delay: const Duration(milliseconds: 350),
                      child: TextField(
                        controller: _linkController,
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.go,
                        onSubmitted: (_) => _submit(),
                        onChanged: (_) {
                          // Clear the complaint as soon as they act on it, but
                          // rebuild either way so Paste/clear can swap.
                          setState(() => _fieldError = null);
                        },
                        decoration: InputDecoration(
                          labelText: 'Production share link',
                          hintText: 'https://…/run/…?token=…',
                          prefixIcon: const Icon(Icons.link),
                          errorText: _fieldError,
                          errorMaxLines: 3,
                          suffixIcon: hasText
                              ? IconButton(
                                  onPressed: () {
                                    _linkController.clear();
                                    setState(() => _fieldError = null);
                                  },
                                  icon: const Icon(Icons.close, size: 18),
                                  tooltip: 'Clear',
                                )
                              : TextButton(
                                  onPressed: _paste,
                                  child: const Text('Paste'),
                                ),
                          suffixIconConstraints:
                              const BoxConstraints(minWidth: 48, minHeight: 44),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    CascadeIn(
                      delay: const Duration(milliseconds: 430),
                      child: Pressable(
                        child: FilledButton.icon(
                          // The one square control in the product, matching the
                          // web's `.primaryAction`.
                          style: CaptureButtons.heroAction,
                          onPressed: controller.busy ? null : _submit,
                          icon: const Icon(Icons.arrow_forward),
                          label: const Text('Link production'),
                        ),
                      ),
                    ),

                    // Operational failures only — no signal, a production that
                    // is gone. Anything about the text itself is under the
                    // field, where the text is.
                    if (controller.operatorError != null) ...[
                      const SizedBox(height: 16),
                      OperatorErrorBanner(controller: controller),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
