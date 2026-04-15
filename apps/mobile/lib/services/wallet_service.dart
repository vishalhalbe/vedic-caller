import '../core/api_client.dart';

class WalletService {
  final _api = ApiClient();

  /// Fetch current wallet balance from server.
  Future<double> getBalance() async {
    final res = await _api.get('/wallet/balance');
    return (res.data['balance'] as num).toDouble();
  }

  /// Step 1: Create a Razorpay order server-side.
  /// Returns { order_id, amount (paise), currency }.
  /// Pass order_id + amount to the Razorpay SDK options.
  Future<Map<String, dynamic>> createOrder(double amountInr) async {
    final res = await _api.post('/payment/create-order', data: {'amount': amountInr});
    return Map<String, dynamic>.from(res.data);
  }

  /// Step 2: After Razorpay SDK confirms payment, verify server-side and credit.
  /// Returns updated wallet balance.
  Future<double> confirmPayment({
    required String orderId,
    required String paymentId,
    required String signature,
    required double amountInr,
  }) async {
    final res = await _api.post('/payment/success', data: {
      'order_id':  orderId,
      'payment_id': paymentId,
      'signature':  signature,
      'amount':     amountInr,
    });
    return (res.data['balance'] as num).toDouble();
  }
}
