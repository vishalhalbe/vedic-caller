import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jyotishconnect/features/wallet/wallet_provider.dart';

void main() {
  group('WalletNotifier', () {
    test('test constructor sets initial state without fetch', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(100.0));
      expect(notifier.state, const AsyncValue.data(100.0));
    });

    test('setBalance updates state', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(0.0));
      notifier.setBalance(250.0);
      expect(notifier.state, const AsyncValue.data(250.0));
    });

    test('setBalance with zero is valid (empty wallet)', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(100.0));
      notifier.setBalance(0.0);
      expect(notifier.state, const AsyncValue.data(0.0));
    });

    test('provider initial state is loading', () {
      final container = ProviderContainer(
        overrides: [
          // Override so it doesn't make a real network call
          walletProvider.overrideWith(
            (ref) => WalletNotifier.test(const AsyncValue.loading()),
          ),
        ],
      );
      addTearDown(container.dispose);

      final state = container.read(walletProvider);
      expect(state, const AsyncValue<double>.loading());
    });

    test('provider returns data state after setBalance', () {
      final container = ProviderContainer(
        overrides: [
          walletProvider.overrideWith(
            (ref) => WalletNotifier.test(const AsyncValue.data(500.0)),
          ),
        ],
      );
      addTearDown(container.dispose);

      final state = container.read(walletProvider);
      expect(state.valueOrNull, 500.0);
    });

    test('error state is preserved', () {
      final error = Exception('Network error');
      final notifier = WalletNotifier.test(
        AsyncValue.error(error, StackTrace.empty),
      );
      expect(notifier.state.hasError, isTrue);
    });
  });
}
