import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jyotishconnect/features/wallet/wallet_provider.dart';

void main() {
  group('WalletNotifier', () {
    test('test constructor sets initial state without fetch', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(100.0));
      expect(notifier.state, const AsyncValue.data(100.0));
    });

    test('setBalance updates state to new value', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(0.0));
      notifier.setBalance(250.0);
      expect(notifier.state, const AsyncValue.data(250.0));
    });

    test('setBalance with zero is valid (empty wallet)', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(100.0));
      notifier.setBalance(0.0);
      expect(notifier.state, const AsyncValue.data(0.0));
    });

    test('setBalance with large value is accepted', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(0.0));
      notifier.setBalance(99999.99);
      expect(notifier.state.valueOrNull, closeTo(99999.99, 0.001));
    });

    test('multiple setBalance calls use the latest value', () {
      final notifier = WalletNotifier.test(const AsyncValue.data(0.0));
      notifier.setBalance(100.0);
      notifier.setBalance(200.0);
      notifier.setBalance(50.0);
      expect(notifier.state, const AsyncValue.data(50.0));
    });

    test('error state is preserved', () {
      final error = Exception('Network error');
      final notifier = WalletNotifier.test(
        AsyncValue.error(error, StackTrace.empty),
      );
      expect(notifier.state.hasError, isTrue);
    });

    test('setBalance clears error state', () {
      final notifier = WalletNotifier.test(
        AsyncValue.error(Exception('err'), StackTrace.empty),
      );
      notifier.setBalance(150.0);
      expect(notifier.state.hasError, isFalse);
      expect(notifier.state.valueOrNull, 150.0);
    });

    test('loading state has no value', () {
      final notifier = WalletNotifier.test(const AsyncValue.loading());
      expect(notifier.state.valueOrNull, isNull);
      expect(notifier.state.hasValue, isFalse);
    });
  });

  group('walletProvider via ProviderContainer', () {
    test('initial state is loading', () {
      final container = ProviderContainer(
        overrides: [
          walletProvider.overrideWith(
            (ref) => WalletNotifier.test(const AsyncValue.loading()),
          ),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(walletProvider), const AsyncValue<double>.loading());
    });

    test('returns data state after setBalance', () {
      final container = ProviderContainer(
        overrides: [
          walletProvider.overrideWith(
            (ref) => WalletNotifier.test(const AsyncValue.data(500.0)),
          ),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(walletProvider).valueOrNull, 500.0);
    });

    test('notifier setBalance updates provider state', () {
      final container = ProviderContainer(
        overrides: [
          walletProvider.overrideWith(
            (ref) => WalletNotifier.test(const AsyncValue.data(0.0)),
          ),
        ],
      );
      addTearDown(container.dispose);
      container.read(walletProvider.notifier).setBalance(300.0);
      expect(container.read(walletProvider).valueOrNull, 300.0);
    });

    test('error state is accessible via provider', () {
      final error = Exception('fetch failed');
      final container = ProviderContainer(
        overrides: [
          walletProvider.overrideWith(
            (ref) => WalletNotifier.test(AsyncValue.error(error, StackTrace.empty)),
          ),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(walletProvider).hasError, isTrue);
    });
  });
}
