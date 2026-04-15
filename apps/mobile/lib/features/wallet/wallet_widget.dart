import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../core/app_provider.dart';
import '../../services/wallet_service.dart';

class WalletWidget extends ConsumerStatefulWidget {
  const WalletWidget({super.key});

  @override
  ConsumerState<WalletWidget> createState() => _WalletWidgetState();
}

class _WalletWidgetState extends ConsumerState<WalletWidget> {
  late final Razorpay _razorpay;
  static const _topUpAmount = 500.0; // ₹500 fixed top-up (can be made configurable)

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR,   _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  void _openRazorpay() {
    _razorpay.open({
      'key': kRazorpayKeyId,
      'amount': (_topUpAmount * 100).toInt(), // paise
      'name': 'JyotishConnect',
      'description': 'Wallet Top-up ₹${_topUpAmount.toStringAsFixed(0)}',
      'currency': 'INR',
      'theme': {'color': '#F59E0B'},
    });
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    try {
      // Server verifies signature and credits wallet atomically
      await WalletService().addMoney(
        response.orderId ?? '',
        response.paymentId ?? '',
        response.signature ?? '',
        _topUpAmount,
      );
      // Refresh balance from DB
      ref.read(walletProvider.notifier).refresh();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('₹${_topUpAmount.toStringAsFixed(0)} added to wallet'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment received but credit failed: $e'), backgroundColor: Colors.orange),
        );
      }
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment failed: ${response.message ?? "Unknown error"}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    // External wallet selected (UPI, etc.) — payment continues asynchronously
  }

  @override
  Widget build(BuildContext context) {
    final walletState = ref.watch(walletProvider);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Wallet', style: TextStyle(color: Colors.white54, fontSize: 12)),
              const SizedBox(height: 2),
              walletState.when(
                loading: () => const SizedBox(
                  width: 60, height: 20,
                  child: LinearProgressIndicator(backgroundColor: Colors.transparent),
                ),
                error: (_, __) => const Text('—', style: TextStyle(color: Colors.red)),
                data: (bal) => Text(
                  '₹${bal.toStringAsFixed(2)}',
                  style: const TextStyle(color: Colors.greenAccent, fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          TextButton.icon(
            style: TextButton.styleFrom(
              backgroundColor: Colors.amber.withOpacity(0.15),
              foregroundColor: Colors.amber,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
            onPressed: _openRazorpay,
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Add ₹500'),
          ),
        ],
      ),
    );
  }
}
