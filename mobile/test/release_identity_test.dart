import 'dart:io';

import 'package:ctc_printer/screens/about_screen.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('pubspec and in-app release identity cannot drift', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final version = RegExp(
      r'^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)\s*$',
      multiLine: true,
    ).firstMatch(pubspec);

    expect(version, isNotNull, reason: 'pubspec.yaml has no release version.');
    expect(
      kAppVersion,
      '${version!.group(1)} (${version.group(2)})',
      reason: 'About/help version text must match pubspec.yaml.',
    );
  });

  testWidgets('About renders the release identity from the shared constant',
      (tester) async {
    await tester.pumpWidget(
      PrinterApp(
        sessionRepository: MemorySessionRepository(),
        boardCacheRepository: MemoryBoardCacheRepository(),
        printRecoveryRepository: MemoryPrintRecoveryRepository(),
      ),
    );
    await tester.pumpAndSettle();

    tester
        .state<NavigatorState>(find.byType(Navigator).first)
        .pushNamed(AboutScreen.route);
    await tester.pumpAndSettle();

    expect(find.text('Version $kAppVersion'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Capture This $kAppVersion'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Capture This $kAppVersion'), findsOneWidget);
  });
}
