import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jyotishconnect/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Auth Flow', () {
    testWidgets('Login screen renders phone field and button', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Should land on login screen (no stored token)
      expect(find.byType(TextField), findsAtLeast(1));
      expect(find.text('Continue'), findsOneWidget);
    });

    testWidgets('Empty phone shows validation error', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Tap continue without entering phone
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      // Expect some error text
      expect(
        find.textContaining(RegExp(r'phone|number|required', caseSensitive: false)),
        findsOneWidget,
      );
    });

    testWidgets('Short phone number shows validation error', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '123');
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(RegExp(r'valid|invalid|10', caseSensitive: false)),
        findsOneWidget,
      );
    });
  });
}
