// Makes the controller reachable from anywhere below MaterialApp.
//
// It lives in its own file rather than in main.dart so that screens can reach
// the controller without importing the app that routes to them.
//
// It sits above the navigator on purpose: state that lives on a screen's State
// cannot survive that screen being popped, and the print queue has to outlive
// every navigation the operator makes.

import 'package:flutter/material.dart';

import 'printer_controller.dart';

class PrinterScope extends InheritedNotifier<PrinterController> {
  const PrinterScope({
    super.key,
    required PrinterController controller,
    required super.child,
  }) : super(notifier: controller);

  static PrinterController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<PrinterScope>();
    assert(scope?.notifier != null, 'No PrinterScope found in context.');
    return scope!.notifier!;
  }
}
