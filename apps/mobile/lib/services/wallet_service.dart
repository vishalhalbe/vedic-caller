import '../core/api_client.dart';

class WalletService {
  final api = ApiClient();

  Future<void> addMoney(int userId, double amount) async {
    await api.post('/payment/success', data: {
      'user_id': userId,
      'amount': amount,
      'reference': DateTime.now().toString()
    });
  }
}
