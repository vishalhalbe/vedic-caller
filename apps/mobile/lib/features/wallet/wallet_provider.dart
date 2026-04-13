import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/wallet_service.dart';

final walletProvider = StateNotifierProvider<WalletNotifier, double>((ref) {
  return WalletNotifier();
});

class WalletNotifier extends StateNotifier<double> {
  WalletNotifier() : super(0);

  Future<void> refresh(int userId) async {
    // Placeholder: ideally fetch from API
    state = state + 0;
  }

  Future<void> add(int userId, double amount) async {
    await WalletService().addMoney(userId, amount);
    state += amount;
  }
}
