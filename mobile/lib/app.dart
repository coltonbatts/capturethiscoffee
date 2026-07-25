import 'dart:async';

import 'package:flutter/material.dart';

import 'app_runtime.dart';
import 'app_scope.dart';
import 'authenticated_workspace_cache.dart';
import 'auth_repository.dart';
import 'board_cache.dart';
import 'print_recovery.dart';
import 'printer_controller.dart';
import 'screens/about_screen.dart';
import 'screens/configuration_screen.dart';
import 'screens/collect_screen.dart';
import 'screens/days_screen.dart';
import 'screens/help_sheet.dart';
import 'screens/home_screen.dart';
import 'screens/link_screen.dart';
import 'screens/print_screen.dart';
import 'screens/recovery_screen.dart';
import 'screens/roster_screen.dart';
import 'screens/sign_in_screen.dart';
import 'session_controller.dart';
import 'session_store.dart';
import 'supabase_bootstrap.dart';
import 'supabase_config.dart';
import 'theme.dart';
import 'widgets/brand_mark.dart';
import 'workspace_controller.dart';
import 'workspace_repository.dart';

class PrinterApp extends StatefulWidget {
  const PrinterApp({
    super.key,
    this.productionDependencies,
    this.configuration,
    this.authRepository,
    this.workspaceRepository,
    this.authenticatedBoardCacheRepository,
    this.selectedDayRepository,
    this.sessionRepository,
    this.printRecoveryRepository,
    this.orderMutationOutboxRepository,
    this.boardCacheRepository,
    this.apiFactory,
    this.legacyTestMode,
  });

  final ProductionSupabaseDependencies? productionDependencies;
  final SupabaseConfiguration? configuration;
  final AuthRepository? authRepository;
  final WorkspaceRepository? workspaceRepository;
  final AuthenticatedBoardCacheRepository? authenticatedBoardCacheRepository;
  final SelectedDayRepository? selectedDayRepository;

  // Build 8 legacy-link dependencies. Existing tests inject these and retain
  // the exact former root behavior.
  final SessionRepository? sessionRepository;
  final PrintRecoveryRepository? printRecoveryRepository;
  final OrderMutationOutboxRepository? orderMutationOutboxRepository;
  final BoardCacheRepository? boardCacheRepository;
  final CtcApiFactory? apiFactory;
  final bool? legacyTestMode;

  @override
  State<PrinterApp> createState() => _PrinterAppState();
}

class _PrinterAppState extends State<PrinterApp> {
  late final AppRuntime _runtime;

  @override
  void initState() {
    super.initState();
    final production = widget.productionDependencies;
    final configuration = widget.configuration ??
        production?.configuration ??
        const SupabaseConfiguration(url: '', anonKey: '');
    final authRepository = widget.authRepository ??
        production?.authRepository ??
        MemoryAuthRepository();
    final workspaceRepository =
        widget.workspaceRepository ?? production?.workspaceRepository;
    final legacyTestMode = widget.legacyTestMode ??
        (widget.sessionRepository != null ||
            widget.boardCacheRepository != null ||
            widget.apiFactory != null);
    final mutationOutbox = OrderMutationOutbox(
      widget.orderMutationOutboxRepository ??
          (production != null
              ? PreferencesOrderMutationOutboxRepository()
              : MemoryOrderMutationOutboxRepository()),
    );

    final workspace = WorkspaceController(
      repository: workspaceRepository,
      mutationOutbox: mutationOutbox,
      authenticatedCacheRepository: widget.authenticatedBoardCacheRepository,
      selectedDayRepository: widget.selectedDayRepository,
      legacySessionRepository: widget.sessionRepository,
      legacyCacheRepository: widget.boardCacheRepository,
      legacyApiFactory: widget.apiFactory,
      legacyTestMode: legacyTestMode,
    );
    final printer = PrinterController(
      workspaceController: workspace,
      printRecoveryRepository: widget.printRecoveryRepository,
      mutationOutbox:
          widget.printRecoveryRepository == null ? mutationOutbox : null,
    );
    _runtime = AppRuntime(
      configuration: configuration,
      session: SessionController(authRepository),
      workspace: workspace,
      printer: printer,
    );
    unawaited(_runtime.start());
  }

  @override
  void dispose() {
    _runtime.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PrinterScope(
      runtime: _runtime,
      child: MaterialApp(
        title: 'Capture This Coffee',
        debugShowCheckedModeBanner: false,
        theme: buildCaptureTheme(),
        home: const RootScreen(),
        routes: {
          DaysScreen.route: (_) => const DaysScreen(popAfterSelection: true),
          CollectScreen.route: (_) => const CollectScreen(),
          PrintScreen.route: (_) => const PrintScreen(),
          RosterScreen.route: (_) => const RosterScreen(),
          RecoveryScreen.route: (_) => const RecoveryScreen(),
          AboutScreen.route: (_) => const AboutScreen(),
        },
      ),
    );
  }
}

class RootScreen extends StatelessWidget {
  const RootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final runtime = PrinterScope.runtimeOf(context);
    final session = runtime.session;
    final workspace = runtime.workspace;

    if (runtime.showLegacy) {
      if (workspace.loadingLegacy) return const _OpeningScreen();
      if (workspace.legacySession == null) {
        return LinkScreen(
          onShowHelp: () => showQuickStart(context),
          onBackToSignIn: runtime.legacyOnly ? null : runtime.leaveLegacy,
        );
      }
      return const HomeScreen();
    }

    if (session.status == SessionStatus.restoring) {
      return const _OpeningScreen();
    }
    if (!runtime.isConfigured) return const ConfigurationScreen();
    if (!session.isSignedIn) return const SignInScreen();
    if (workspace.hasSelectedBoard) return const HomeScreen();
    return const DaysScreen();
  }
}

class _OpeningScreen extends StatelessWidget {
  const _OpeningScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
        body: Center(
          child: BrandPulse(size: 76, semanticLabel: 'Opening Capture This'),
        ),
      );
}
