import '../core/api_client.dart';

class WalletService {
  final _api = ApiClient();

  Future<double> getBalance() async {
    final res = await _api.get('/wallet/balance');
    return (res.data['balance'] as num).toDouble();
  }

  Future<double> addMoney(String orderId, String paymentId, String signature, double amount) async {
    final res = await _api.post('/payment/success', data: {
      'order_id': orderId,
      'payment_id': paymentId,
      'signature': signature,
      'amount': amount,
    });
    return (res.data['balance'] as num).toDouble();
  }
}
