import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import 'wallet_provider.dart';
import 'wallet_widget.dart';

final _transactionsProvider = FutureProvider<List<dynamic>>((ref) async {
  final res = await ApiClient().get('/wallet/transactions');
  final body = res.data as Map<String, dynamic>;
  return (body['data'] as List<dynamic>?) ?? [];
});

class WalletTopUpScreen extends ConsumerWidget {
  const WalletTopUpScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final txns = ref.watch(_transactionsProvider);
    final balance = ref.watch(walletProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text('Wallet', style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white54, size: 20),
            onPressed: () {
              ref.invalidate(walletProvider);
              ref.invalidate(_transactionsProvider);
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          // ── Balance card ─────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.deepPurple.shade900, Colors.deepPurple.shade700],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Available Balance',
                    style: TextStyle(color: Colors.white60, fontSize: 13)),
                const SizedBox(height: 8),
                balance.when(
                  loading: () => const CircularProgressIndicator(color: Colors.amber),
                  error: (_, __) => const Text('—',
                      style: TextStyle(color: Colors.redAccent, fontSize: 32)),
                  data: (bal) => Text(
                    '₹${bal.toStringAsFixed(2)}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 36,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Top-up widget ─────────────────────────────────────────────────
          const Text('Add Money',
              style: TextStyle(
                  color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 10),
          const WalletWidget(),

          const SizedBox(height: 28),

          // ── Transaction history ───────────────────────────────────────────
          const Text('Recent Transactions',
              style: TextStyle(
                  color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),

          txns.when(
            loading: () => const Center(
                child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: Colors.amber),
            )),
            error: (_, __) => const Center(
              child: Text('Could not load transactions',
                  style: TextStyle(color: Colors.white38)),
            ),
            data: (list) {
              if (list.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('No transactions yet',
                        style: TextStyle(color: Colors.white38)),
                  ),
                );
              }
              return Column(
                children: list.map((t) => _TxnTile(t)).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _TxnTile extends StatelessWidget {
  final dynamic txn;
  const _TxnTile(this.txn);

  @override
  Widget build(BuildContext context) {
    final type    = txn['type'] as String? ?? '';
    final amount  = (txn['amount'] as num?)?.toDouble() ?? 0;
    final isCredit = type == 'credit';
    final label   = isCredit ? 'Top-up' : 'Call charge';
    final dateStr = txn['created_at'] as String?;
    DateTime? dt;
    if (dateStr != null) dt = DateTime.tryParse(dateStr)?.toLocal();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isCredit
                  ? Colors.green.withOpacity(0.15)
                  : Colors.red.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isCredit ? Icons.add : Icons.remove,
              color: isCredit ? Colors.greenAccent : Colors.redAccent,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(color: Colors.white70, fontSize: 14)),
                if (dt != null)
                  Text(
                    '${dt.day}/${dt.month}/${dt.year}  '
                    '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}',
                    style: const TextStyle(color: Colors.white38, fontSize: 11),
                  ),
              ],
            ),
          ),
          Text(
            '${isCredit ? '+' : '-'}₹${amount.toStringAsFixed(2)}',
            style: TextStyle(
              color: isCredit ? Colors.greenAccent : Colors.redAccent,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
