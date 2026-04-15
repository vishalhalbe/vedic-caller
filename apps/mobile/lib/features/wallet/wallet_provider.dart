import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/wallet_service.dart';

final walletProvider = StateNotifierProvider<WalletNotifier, AsyncValue<double>>((ref) {
  return WalletNotifier();
});

class WalletNotifier extends StateNotifier<AsyncValue<double>> {
  WalletNotifier() : super(const AsyncValue.loading()) {
    refresh();
  }

  final _service = WalletService();

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    try {
      final balance = await _service.getBalance();
      state = AsyncValue.data(balance);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void setBalance(double balance) {
    state = AsyncValue.data(balance);
  }
}
