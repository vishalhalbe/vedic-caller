import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jyotishconnect/features/wallet/wallet_widget.dart';
import 'package:jyotishconnect/features/wallet/wallet_provider.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('WalletWidget', () {
    Widget buildWidget({AsyncValue<double> initialState = const AsyncValue.data(100.0)}) {
      return ProviderScope(
        overrides: [
          walletProvider.overrideWith(
            (ref) => _FakeWalletNotifier(initialState),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(body: WalletWidget()),
        ),
      );
    }

    testWidgets('shows balance when data available', (tester) async {
      await tester.pumpWidget(buildWidget());
      await tester.pumpAndSettle();

      expect(find.text('₹100.00'), findsOneWidget);
      expect(find.text('Wallet Balance'), findsOneWidget);
    });

    testWidgets('shows loading indicator when loading', (tester) async {
      await tester.pumpWidget(buildWidget(
        initialState: const AsyncValue.loading(),
      ));
      await tester.pump();

      expect(find.byType(LinearProgressIndicator), findsOneWidget);
    });

    testWidgets('shows error state', (tester) async {
      await tester.pumpWidget(buildWidget(
        initialState: AsyncValue.error('Network error', StackTrace.empty),
      ));
      await tester.pumpAndSettle();

      expect(find.text('—'), findsOneWidget);
    });

    testWidgets('amount chips are rendered', (tester) async {
      await tester.pumpWidget(buildWidget());
      await tester.pumpAndSettle();

      expect(find.text('₹100'), findsOneWidget);
      expect(find.text('₹500'), findsOneWidget);
      expect(find.text('₹1000'), findsOneWidget);
    });

    testWidgets('selecting amount chip updates Add button label', (tester) async {
      await tester.pumpWidget(buildWidget());
      await tester.pumpAndSettle();

      // Default selected is ₹500
      expect(find.text('Add ₹500'), findsOneWidget);

      // Tap ₹1000 chip
      await tester.tap(find.text('₹1000'));
      await tester.pumpAndSettle();

      expect(find.text('Add ₹1000'), findsOneWidget);
    });

    testWidgets('refresh button is present', (tester) async {
      await tester.pumpWidget(buildWidget());
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.refresh), findsOneWidget);
    });
  });
}

// Minimal fake notifier for widget tests
class _FakeWalletNotifier extends WalletNotifier {
  final AsyncValue<double> _initialState;
  _FakeWalletNotifier(this._initialState) : super.test(_initialState);
}
