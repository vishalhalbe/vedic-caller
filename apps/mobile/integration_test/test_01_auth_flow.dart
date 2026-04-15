import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jyotishconnect/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Auth Flow — email/password login', () {
    testWidgets('Login screen renders email, password fields and Sign in button', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Should land on login screen (no stored token)
      expect(find.byType(TextFormField), findsAtLeast(2)); // email + password
      expect(find.text('Sign in'), findsOneWidget);
    });

    testWidgets('Empty form shows validation errors on submit', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(RegExp(r'email|required', caseSensitive: false)),
        findsAtLeast(1),
      );
    });

    testWidgets('Invalid email format shows validation error', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Enter invalid email
      await tester.enterText(
        find.byType(TextFormField).first,
        'notanemail',
      );
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(RegExp(r'valid email', caseSensitive: false)),
        findsOneWidget,
      );
    });

    testWidgets('Short password shows validation error on register', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Switch to register mode
      await tester.tap(find.text("Don't have an account? Register"));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).first, 'test@example.com');
      // Find and enter password field (index 1 is name, index 2 is email in register mode —
      // actually name is first, email is second, password is third)
      await tester.enterText(find.byType(TextFormField).last, 'short');
      await tester.tap(find.text('Create account'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(RegExp(r'8 characters|minimum', caseSensitive: false)),
        findsOneWidget,
      );
    });

    testWidgets('Toggle between login and register modes', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Default: login mode
      expect(find.text('Sign in'), findsOneWidget);
      expect(find.text('Create account'), findsNothing);

      // Switch to register
      await tester.tap(find.text("Don't have an account? Register"));
      await tester.pumpAndSettle();

      expect(find.text('Create account'), findsOneWidget);
      expect(find.text('Sign in'), findsNothing);

      // Switch back
      await tester.tap(find.text('Already have an account? Sign in'));
      await tester.pumpAndSettle();

      expect(find.text('Sign in'), findsOneWidget);
    });
  });
}
