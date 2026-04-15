import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../main.dart' show logoutUser;
import '../../services/history_service.dart';

String _formatDuration(int seconds) {
  final m = seconds ~/ 60;
  final s = seconds % 60;
  if (m == 0) return '${s}s';
  return '${m}m ${s}s';
}

String _formatDate(String? isoString) {
  if (isoString == null) return '';
  final dt = DateTime.tryParse(isoString)?.toLocal();
  if (dt == null) return '';
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final callDay = DateTime(dt.year, dt.month, dt.day);
  final hour = dt.hour.toString().padLeft(2, '0');
  final min  = dt.minute.toString().padLeft(2, '0');
  if (callDay == today) return 'Today $hour:$min';
  if (callDay == today.subtract(const Duration(days: 1))) return 'Yesterday $hour:$min';
  return '${dt.day}/${dt.month}/${dt.year} $hour:$min';
}

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
      appBar: AppBar(
        title: const Text('Call History'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
            onPressed: () => logoutUser(ref, context),
          ),
        ],
      ),
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
                    final dateStr = _formatDate(c['created_at'] as String?);
                    return ListTile(
                      leading: const Icon(Icons.call, color: Colors.greenAccent),
                      title: Text(astrologer, style: const TextStyle(color: Colors.white)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${_formatDuration(duration as int)}  ·  ₹${cost.toStringAsFixed(2)}',
                            style: const TextStyle(color: Colors.white54),
                          ),
                          if (dateStr.isNotEmpty)
                            Text(dateStr, style: const TextStyle(color: Colors.white38, fontSize: 11)),
                        ],
                      ),
                      isThreeLine: dateStr.isNotEmpty,
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
