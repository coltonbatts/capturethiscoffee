// Capture This — Build 9.
//
// Production startup only: initialize public Supabase configuration, then
// hand the resulting repositories to the app shell.

import 'package:flutter/material.dart';

import 'app.dart';
import 'supabase_bootstrap.dart';

export 'app.dart' show PrinterApp, RootScreen;
export 'printer_controller.dart' show CtcApiFactory;
export 'screens/about_screen.dart' show kAppVersion;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final dependencies = await initializeProductionSupabase();
  runApp(PrinterApp(productionDependencies: dependencies));
}
