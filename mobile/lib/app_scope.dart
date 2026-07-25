// Makes the controller reachable from anywhere below MaterialApp.
//
// It lives in its own file rather than in main.dart so that screens can reach
// the controller without importing the app that routes to them.
//
// It sits above the navigator on purpose: state that lives on a screen's State
// cannot survive that screen being popped, and the print queue has to outlive
// every navigation the operator makes.

import 'package:flutter/material.dart';

import 'app_runtime.dart';
import 'board_controller.dart';
import 'printer_controller.dart';
import 'session_controller.dart';
import 'workspace_controller.dart';

class PrinterScope extends InheritedNotifier<AppRuntime> {
  const PrinterScope({
    super.key,
    required AppRuntime runtime,
    required super.child,
  }) : super(notifier: runtime);

  static AppRuntime runtimeOf(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<PrinterScope>();
    assert(scope?.notifier != null, 'No PrinterScope found in context.');
    return scope!.notifier!;
  }

  static PrinterController of(BuildContext context) {
    return runtimeOf(context).printer;
  }

  static WorkspaceController workspaceOf(BuildContext context) =>
      runtimeOf(context).workspace;

  static BoardController boardOf(BuildContext context) =>
      runtimeOf(context).board;

  static SessionController sessionOf(BuildContext context) =>
      runtimeOf(context).session;
}
