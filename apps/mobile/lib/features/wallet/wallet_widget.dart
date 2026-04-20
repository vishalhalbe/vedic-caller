import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
  final _walletService = WalletService();

  bool _creatingOrder = false;

  // Amount options (INR) — user taps to select
  static const _amounts = [100.0, 500.0, 1000.0];
  double _selectedAmount = 500.0;
  // null means a chip is selected; non-null means the user typed a custom amount
  double? _customAmount;
  final _customController = TextEditingController();

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
    _customController.dispose();
    super.dispose();
  }

  static const _minAmount = 10.0; // ₹10 minimum top-up

  double get _effectiveAmount => _customAmount ?? _selectedAmount;

  bool get _amountValid => _effectiveAmount >= _minAmount;

  // ── Step 1: Create order server-side, then open Razorpay sheet ─────────────
  Future<void> _startTopUp() async {
    if (!_amountValid) {
      _showSnack('Minimum top-up is ₹${_minAmount.toStringAsFixed(0)}', isError: true);
      return;
    }
    setState(() => _creatingOrder = true);
    try {
      // Backend creates a Razorpay order — required for signature verification
      final order = await _walletService.createOrder(_effectiveAmount);

      _razorpay.open({
        'key':         kRazorpayKeyId,
        'order_id':    order['order_id'],  // ← links payment to server order
        'amount':      order['amount'],    // paise, returned from server
        'currency':    'INR',
        'name':        'JyotishConnect',
        'description': 'Wallet Top-up ₹${_effectiveAmount.toStringAsFixed(0)}',
        'theme':       {'color': '#F59E0B'},
      });
    } catch (e) {
      if (mounted) {
        _showSnack('Could not initiate payment: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _creatingOrder = false);
    }
  }

  // ── Step 2: SDK confirmed payment — verify on server and credit wallet ──────
  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    try {
      final newBalance = await _walletService.confirmPayment(
        orderId:    response.orderId    ?? '',
        paymentId:  response.paymentId  ?? '',
        signature:  response.signature  ?? '',
        amountInr:  _effectiveAmount,
      );

      // Update wallet provider with the server-confirmed balance
      ref.read(walletProvider.notifier).setBalance(newBalance);

      if (mounted) {
        _showSnack('₹${_effectiveAmount.toStringAsFixed(0)} added successfully!');
      }
    } catch (e) {
      // Payment was captured but credit failed — surface clearly
      if (mounted) {
        _showSnack('Payment received but wallet not updated. Contact support. (${response.paymentId})',
            isError: true);
      }
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (mounted) {
      _showSnack('Payment failed: ${response.message ?? "Unknown error"}', isError: true);
    }
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    // UPI / external wallet selected; payment continues async via webhook
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? Colors.red.shade700 : Colors.green.shade700,
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final walletState = ref.watch(walletProvider);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Balance row ───────────────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Wallet Balance',
                      style: TextStyle(color: Colors.white54, fontSize: 12)),
                  const SizedBox(height: 4),
                  walletState.when(
                    loading: () => const SizedBox(
                      width: 80, height: 22,
                      child: LinearProgressIndicator(backgroundColor: Colors.transparent),
                    ),
                    error: (_, __) => const Text('—',
                        style: TextStyle(color: Colors.redAccent, fontSize: 20)),
                    data: (bal) => Text(
                      '₹${bal.toStringAsFixed(2)}',
                      style: const TextStyle(
                          color: Colors.greenAccent,
                          fontSize: 22,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  IconButton(
                    onPressed: () => context.push('/wallet'),
                    icon: const Icon(Icons.account_balance_wallet_outlined,
                        color: Colors.amber, size: 20),
                    tooltip: 'Wallet details',
                  ),
                  IconButton(
                    onPressed: () => ref.read(walletProvider.notifier).refresh(),
                    icon: const Icon(Icons.refresh, color: Colors.white38, size: 18),
                    tooltip: 'Refresh balance',
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 12),

          // ── Amount selector ───────────────────────────────────────────────
          Row(
            children: _amounts.map((amt) {
              final selected = _customAmount == null && amt == _selectedAmount;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text('₹${amt.toStringAsFixed(0)}'),
                  selected: selected,
                  onSelected: (_) => setState(() {
                    _selectedAmount = amt;
                    _customAmount = null;
                    _customController.clear();
                  }),
                  selectedColor: Colors.amber.shade700,
                  backgroundColor: Colors.white.withOpacity(0.07),
                  labelStyle: TextStyle(
                    color: selected ? Colors.black : Colors.white70,
                    fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 10),

          // ── Custom amount input ───────────────────────────────────────────
          TextField(
            controller: _customController,
            keyboardType: const TextInputType.numberWithOptions(decimal: false),
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Custom amount (₹)',
              hintStyle: const TextStyle(color: Colors.white38),
              prefixText: '₹ ',
              prefixStyle: const TextStyle(color: Colors.white54),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              filled: true,
              fillColor: Colors.white.withOpacity(0.07),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.white.withOpacity(0.12)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.white.withOpacity(0.12)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Colors.amber),
              ),
            ),
            onChanged: (val) {
              final parsed = double.tryParse(val.trim());
              setState(() => _customAmount = (parsed != null && parsed > 0) ? parsed : null);
            },
          ),

          const SizedBox(height: 12),

          // ── Add money button ──────────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber.shade600,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: (_creatingOrder || !_amountValid) ? null : _startTopUp,
              icon: _creatingOrder
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Icon(Icons.add, size: 18),
              label: Text(
                _creatingOrder
                    ? 'Creating order…'
                    : 'Add ₹${_effectiveAmount.toStringAsFixed(0)}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
