import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../main.dart' show logoutUser;
import '../wallet/wallet_provider.dart';
import '../wallet/wallet_widget.dart';

final _astrologersProvider = FutureProvider<List<dynamic>>((ref) async {
  final res = await ApiClient().get('/astrologer');
  return res.data as List<dynamic>;
});

class AstrologerListScreen extends ConsumerWidget {
  const AstrologerListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final astrologers = ref.watch(_astrologersProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text(
          'JyotishConnect',
          style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white54),
            tooltip: 'Logout',
            onPressed: () => logoutUser(ref, context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Wallet balance + top-up always visible at top
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: WalletWidget(),
          ),
          const SizedBox(height: 8),
          // Astrologer list fills remaining space
          Expanded(
            child: astrologers.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Error: $e', style: const TextStyle(color: Colors.red)),
              ),
              data: (list) => RefreshIndicator(
                onRefresh: () => ref.refresh(_astrologersProvider.future),
                child: list.isEmpty
                    ? const Center(
                        child: Text(
                          'No astrologers available right now.',
                          style: TextStyle(color: Colors.white54),
                        ),
                      )
                    : Consumer(
                        builder: (context, ref, _) {
                          final balance = ref.watch(walletProvider).valueOrNull ?? 0.0;
                          return ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: list.length,
                            itemBuilder: (context, index) {
                              final a = list[index];
                              final rate = (a['rate_per_minute'] as num).toDouble();
                              return _AstrologerTile(
                                id: a['id'] as String,
                                name: a['name'] as String,
                                rate: rate,
                                isAvailable: a['is_available'] == true,
                                walletBalance: balance,
                              );
                            },
                          );
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AstrologerTile extends StatelessWidget {
  final String id;
  final String name;
  final double rate;
  final bool isAvailable;
  final double walletBalance;

  const _AstrologerTile({
    required this.id,
    required this.name,
    required this.rate,
    required this.isAvailable,
    required this.walletBalance,
  });

  @override
  Widget build(BuildContext context) {
    // Require at least 1 minute of balance before allowing a call
    final canCall = isAvailable && walletBalance >= rate;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      '₹${rate.toStringAsFixed(0)}/min',
                      style: const TextStyle(color: Colors.white70),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isAvailable
                            ? Colors.green.withOpacity(0.2)
                            : Colors.red.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        isAvailable ? 'Online' : 'Busy',
                        style: TextStyle(
                          color: isAvailable ? Colors.greenAccent : Colors.redAccent,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
                // Low balance hint — only shown when astrologer is available but balance is too low
                if (isAvailable && walletBalance < rate)
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      'Add funds to call',
                      style: TextStyle(color: Colors.orangeAccent, fontSize: 11),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: canCall
                  ? Colors.amber.shade600
                  : Colors.grey.shade800,
              foregroundColor: canCall ? Colors.black : Colors.white38,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: canCall
                ? () => context.push('/call', extra: {
                      'astrologer_id': id,
                      'name': name,
                      'rate': rate,
                    })
                : null,
            child: const Text('Call'),
          ),
        ],
      ),
    );
  }
}
