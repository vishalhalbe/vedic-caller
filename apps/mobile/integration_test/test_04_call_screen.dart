import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jyotishconnect/features/call/call_screen_v2.dart';
import 'package:jyotishconnect/features/wallet/wallet_provider.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('CallScreen', () {
    Widget buildScreen({
      String astrologerId = 'astro-1',
      String astrologerName = 'Pandit Sharma',
      double rate = 60.0,
    }) {
      return ProviderScope(
        overrides: [
          walletProvider.overrideWith(
            (ref) => _FakeWalletNotifier(const AsyncValue.data(500.0)),
          ),
        ],
        child: MaterialApp(
          home: CallScreen(
            astrologerId: astrologerId,
            astrologerName: astrologerName,
            rate: rate,
          ),
        ),
      );
    }

    testWidgets('shows astrologer name in app bar', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pump(); // Don't pumpAndSettle — call start is async

      expect(find.text('Pandit Sharma'), findsOneWidget);
    });

    testWidgets('shows loading state while connecting', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pump();

      // While _starting == true, show a connecting indicator
      expect(
        find.byType(CircularProgressIndicator),
        findsAtLeast(1),
      );
    });

    testWidgets('shows timer once call starts', (tester) async {
      await tester.pumpWidget(buildScreen());
      // Wait for call start to complete (mocked network should be fast)
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Timer starts at 00:00
      expect(find.text('00:00'), findsOneWidget);
    }, skip: 'Requires running backend + Agora credentials');

    testWidgets('shows rate per minute label', (tester) async {
      await tester.pumpWidget(buildScreen(rate: 60.0));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      expect(find.textContaining('₹60'), findsOneWidget);
    }, skip: 'Requires running backend + Agora credentials');

    testWidgets('End Call button is present', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle(const Duration(seconds: 2));

      expect(find.text('End Call'), findsOneWidget);
    }, skip: 'Requires running backend + Agora credentials');
  });
}

class _FakeWalletNotifier extends WalletNotifier {
  final AsyncValue<double> _state;
  _FakeWalletNotifier(this._state) : super.test(_state);
}
