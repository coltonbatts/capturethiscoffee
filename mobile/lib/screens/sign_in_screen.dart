import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../theme.dart';
import '../widgets/brand_mark.dart';
import '../widgets/motion.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final runtime = PrinterScope.runtimeOf(context);
    await runtime.signIn(
      _emailController.text,
      _passwordController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final runtime = PrinterScope.runtimeOf(context);
    final session = runtime.session;
    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'Owner sign in'),
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: AutofillGroup(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Center(child: ArrivingBrandMark(size: 116)),
                          const SizedBox(height: 28),
                          Text('Open the day.', style: CaptureType.pageTitle),
                          const SizedBox(height: 10),
                          Text(
                            'Use the email and password provisioned by the owner.',
                            style: Theme.of(context).textTheme.bodyLarge,
                          ),
                          const SizedBox(height: 28),
                          TextField(
                            key: const Key('sign-in-email'),
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            enableSuggestions: false,
                            autofillHints: const [AutofillHints.email],
                            decoration: const InputDecoration(
                              labelText: 'Email',
                              prefixIcon: Icon(Icons.mail_outline),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            key: const Key('sign-in-password'),
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.password],
                            onSubmitted: (_) => _submit(),
                            decoration: InputDecoration(
                              labelText: 'Password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                onPressed: () => setState(() {
                                  _obscurePassword = !_obscurePassword;
                                }),
                                tooltip: _obscurePassword
                                    ? 'Show password'
                                    : 'Hide password',
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                              ),
                            ),
                          ),
                          if (session.error != null) ...[
                            const SizedBox(height: 12),
                            _AuthMessage(
                              message: session.error!,
                              isError: true,
                              onDismiss: session.dismissMessage,
                            ),
                          ],
                          if (session.warning != null) ...[
                            const SizedBox(height: 12),
                            _AuthMessage(
                              message: session.warning!,
                              onDismiss: session.dismissMessage,
                            ),
                          ],
                          const SizedBox(height: 16),
                          Pressable(
                            child: FilledButton.icon(
                              key: const Key('sign-in-submit'),
                              style: CaptureButtons.heroAction,
                              onPressed: session.busy ? null : _submit,
                              icon: const Icon(Icons.arrow_forward),
                              label: const Text('Sign in'),
                            ),
                          ),
                          const SizedBox(height: 18),
                          Center(
                            child: TextButton.icon(
                              onPressed:
                                  session.busy ? null : runtime.enterLegacy,
                              icon: const Icon(Icons.link, size: 18),
                              label: const Text('Legacy link'),
                            ),
                          ),
                          if (session.busy) ...[
                            const SizedBox(height: 16),
                            const LinearProgressIndicator(),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AuthMessage extends StatelessWidget {
  const _AuthMessage({
    required this.message,
    required this.onDismiss,
    this.isError = false,
  });

  final String message;
  final VoidCallback onDismiss;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isError ? CaptureColors.errorSurface : CaptureColors.surfaceMuted,
      borderRadius: CaptureRadii.controlBorder,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        child: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : Icons.cloud_off_outlined,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            IconButton(
              onPressed: onDismiss,
              icon: const Icon(Icons.close, size: 18),
              tooltip: 'Dismiss',
            ),
          ],
        ),
      ),
    );
  }
}
