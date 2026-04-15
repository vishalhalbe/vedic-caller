import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jyotishconnect/features/astrologer/astrologer_list_screen.dart';
import 'package:jyotishconnect/features/wallet/wallet_provider.dart';
import 'package:jyotishconnect/features/astrologer/astrologer_list_screen.dart'
    show astrologersProvider;

final _fakeAstrologers = [
  {
    'id': 'astro-1',
    'name': 'Pandit Sharma',
    'rate_per_minute': 60.0,
    'is_available': true,
  },
  {
    'id': 'astro-2',
    'name': 'Jyotish Gupta',
    'rate_per_minute': 40.0,
    'is_available': false,
  },
];

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('AstrologerListScreen', () {
    Widget buildScreen() {
      return ProviderScope(
        overrides: [
          walletProvider.overrideWith(
            (ref) => _FakeWalletNotifier(const AsyncValue.data(500.0)),
          ),
          astrologersProvider.overrideWith(
            (ref) async => _fakeAstrologers,
          ),
        ],
        child: const MaterialApp(
          home: AstrologerListScreen(),
        ),
      );
    }

    testWidgets('renders astrologer names', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle();

      expect(find.text('Pandit Sharma'), findsOneWidget);
      expect(find.text('Jyotish Gupta'), findsOneWidget);
    });

    testWidgets('shows Online badge for available astrologer', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle();

      expect(find.text('Online'), findsAtLeast(1));
    });

    testWidgets('shows Busy badge for unavailable astrologer', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle();

      expect(find.text('Busy'), findsOneWidget);
    });

    testWidgets('wallet balance is visible at top', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle();

      expect(find.text('₹500.00'), findsOneWidget);
    });

    testWidgets('Call button only shown for available astrologers', (tester) async {
      await tester.pumpWidget(buildScreen());
      await tester.pumpAndSettle();

      // Only one astrologer is available, so only one Call button
      expect(find.text('Call'), findsOneWidget);
    });
  });
}

class _FakeWalletNotifier extends WalletNotifier {
  final AsyncValue<double> _state;
  _FakeWalletNotifier(this._state) : super.test(_state);
}
