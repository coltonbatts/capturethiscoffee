// Capture This Coffee — NIIMBOT M2_H direct BLE printer app.
//
// Load a production share link, render label PNGs on device, print over BLE,
// and mark label_printed via the public order PATCH route.
//
// Labels are rendered locally by label_painter.dart rather than downloaded, so
// printing does not require a signal. The board is cached on disk, so a cold
// start with no signal is usable and can print.
//
// This file is now only three things: the app, the route table, and the root
// state machine that decides which of splash / link / home you are looking at.
// State lives in printer_controller.dart; surfaces live in screens/.

import 'dart:async';

import 'package:flutter/material.dart';

import 'app_scope.dart';
import 'board_cache.dart';
import 'print_recovery.dart';
import 'printer_controller.dart';
import 'screens/about_screen.dart';
import 'screens/help_sheet.dart';
import 'screens/home_screen.dart';
import 'screens/link_screen.dart';
import 'screens/print_screen.dart';
import 'screens/recovery_screen.dart';
import 'screens/roster_screen.dart';
import 'session_store.dart';
import 'theme.dart';
import 'widgets/brand_mark.dart';

export 'printer_controller.dart' show CtcApiFactory;
export 'screens/about_screen.dart' show kAppVersion;

void main() => runApp(const PrinterApp());

class PrinterApp extends StatefulWidget {
  const PrinterApp({
    super.key,
    this.sessionRepository,
    this.printRecoveryRepository,
    this.boardCacheRepository,
    this.apiFactory,
  });

  // Injected by tests and by tool/app_store_screenshot.dart. Production passes
  // nothing and the controller builds the real repositories.
  final SessionRepository? sessionRepository;
  final PrintRecoveryRepository? printRecoveryRepository;
  final BoardCacheRepository? boardCacheRepository;
  final CtcApiFactory? apiFactory;

  @override
  State<PrinterApp> createState() => _PrinterAppState();
}

class _PrinterAppState extends State<PrinterApp> {
  late final PrinterController _controller;

  @override
  void initState() {
    super.initState();
    _controller = PrinterController(
      sessionRepository: widget.sessionRepository,
      printRecoveryRepository: widget.printRecoveryRepository,
      boardCacheRepository: widget.boardCacheRepository,
      apiFactory: widget.apiFactory,
    );
    unawaited(_controller.start());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PrinterScope(
      controller: _controller,
      child: MaterialApp(
        title: 'Capture This Coffee',
        debugShowCheckedModeBanner: false,
        theme: buildCaptureTheme(),
        home: const RootScreen(),
        routes: {
          PrintScreen.route: (_) => const PrintScreen(),
          RosterScreen.route: (_) => const RosterScreen(),
          RecoveryScreen.route: (_) => const RecoveryScreen(),
          AboutScreen.route: (_) => const AboutScreen(),
        },
      ),
    );
  }
}

/// Splash, link, or home.
///
/// These three are not routes. They are states of the same root: there is
/// nothing to navigate *back* to from a cold start, and an operator with no
/// linked production has exactly one thing they can do. Making them routes
/// would invite a back gesture that lands on an empty app.
class RootScreen extends StatelessWidget {
  const RootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = PrinterScope.of(context);

    if (controller.loadingSession) {
      return const Scaffold(
        body: Center(
          child: BrandPulse(size: 76, semanticLabel: 'Opening Capture This'),
        ),
      );
    }

    if (controller.session == null) {
      return LinkScreen(onShowHelp: () => showQuickStart(context));
    }

    return const HomeScreen();
  }
}
