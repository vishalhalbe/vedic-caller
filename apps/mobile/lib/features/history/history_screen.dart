import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/history_service.dart';

final _historyProvider = FutureProvider<List<dynamic>>((ref) async {
  // JWT identity used server-side — no hardcoded userId
  return HistoryService().getHistory();
});

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(_historyProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Call History')),
      body: history.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: Colors.red))),
        data: (calls) => calls.isEmpty
            ? const Center(child: Text('No calls yet.', style: TextStyle(color: Colors.white54)))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_historyProvider.future),
                child: ListView.builder(
                  itemCount: calls.length,
                  itemBuilder: (_, i) {
                    final c = calls[i];
                    final duration = c['duration_seconds'] ?? 0;
                    final cost = (c['cost'] as num?)?.toDouble() ?? 0.0;
                    final astrologer = c['Astrologer']?['name'] ?? 'Astrologer';
                    return ListTile(
                      leading: const Icon(Icons.call, color: Colors.greenAccent),
                      title: Text(astrologer, style: const TextStyle(color: Colors.white)),
                      subtitle: Text('${duration}s  ·  ₹${cost.toStringAsFixed(2)}',
                          style: const TextStyle(color: Colors.white54)),
                      trailing: Text(c['status'] ?? '',
                          style: TextStyle(
                            color: c['status'] == 'completed' ? Colors.greenAccent : Colors.orange,
                          )),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
