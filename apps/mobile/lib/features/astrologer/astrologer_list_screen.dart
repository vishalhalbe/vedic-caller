import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
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
    final wallet = ref.watch(walletProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Astrologers', style: TextStyle(color: Colors.white)),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: wallet.when(
              data: (bal) => Text('₹${bal.toStringAsFixed(0)}',
                  style: const TextStyle(color: Colors.greenAccent, fontSize: 16)),
              loading: () => const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
              error: (_, __) => const Icon(Icons.error_outline, color: Colors.red),
            ),
          ),
        ],
      ),
      body: astrologers.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: Colors.red))),
        data: (list) => RefreshIndicator(
          onRefresh: () => ref.refresh(_astrologersProvider.future),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            itemBuilder: (context, index) {
              final a = list[index];
              final rate = (a['rate_per_minute'] as num).toDouble();
              return _AstrologerTile(
                id: a['id'],
                name: a['name'],
                rate: rate,
                isAvailable: a['is_available'] == true,
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AstrologerTile extends StatelessWidget {
  final String id;
  final String name;
  final double rate;
  final bool isAvailable;

  const _AstrologerTile({
    required this.id,
    required this.name,
    required this.rate,
    required this.isAvailable,
  });

  @override
  Widget build(BuildContext context) {
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
                Text(name, style: const TextStyle(color: Colors.white, fontSize: 16)),
                const SizedBox(height: 4),
                Text('₹${rate.toStringAsFixed(0)}/min',
                    style: const TextStyle(color: Colors.white70)),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: isAvailable
                ? () => context.push('/call', extra: {
                      'astrologer_id': id,
                      'name': name,
                      'rate': rate,
                    })
                : null,
            child: Text(isAvailable ? 'Call' : 'Busy'),
          ),
        ],
      ),
    );
  }
}
