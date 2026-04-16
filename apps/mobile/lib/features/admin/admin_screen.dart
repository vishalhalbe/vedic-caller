import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

final adminStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final res = await ApiClient().get('/admin/stats');
  return res.data as Map<String, dynamic>;
});

final adminAstrologersProvider = FutureProvider<List<dynamic>>((ref) async {
  final res = await ApiClient().get('/admin/astrologers');
  return res.data as List<dynamic>;
});

class AdminScreen extends ConsumerWidget {
  const AdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats       = ref.watch(adminStatsProvider);
    final astrologers = ref.watch(adminAstrologersProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Admin Dashboard',
            style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white54),
            onPressed: () {
              ref.invalidate(adminStatsProvider);
              ref.invalidate(adminAstrologersProvider);
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Stats cards ───────────────────────────────────────────────────
          stats.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Error loading stats: $e',
                style: const TextStyle(color: Colors.redAccent)),
            data: (data) => _StatsGrid(data: data),
          ),

          const SizedBox(height: 24),

          const Text('Astrologers',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),

          // ── Astrologer list ───────────────────────────────────────────────
          astrologers.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Error loading astrologers: $e',
                style: const TextStyle(color: Colors.redAccent)),
            data: (list) => Column(
              children: list.map<Widget>((a) => _AstrologerAdminTile(
                astrologer: a,
                onToggle: (available) async {
                  await ApiClient().post('/admin/astrologers/${a['id']}/toggle',
                      data: {'available': available});
                  ref.invalidate(adminAstrologersProvider);
                },
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final Map<String, dynamic> data;
  const _StatsGrid({required this.data});

  @override
  Widget build(BuildContext context) {
    final users       = data['users'] as Map<String, dynamic>;
    final astrologers = data['astrologers'] as Map<String, dynamic>;
    final calls       = data['calls'] as Map<String, dynamic>;
    final revenue     = data['revenue'] as Map<String, dynamic>;

    final cards = [
      _StatCard(label: 'Total Users',       value: '${users['total']}',           icon: Icons.people),
      _StatCard(label: 'Astrologers',        value: '${astrologers['total']}',      icon: Icons.stars),
      _StatCard(label: 'Online Now',         value: '${astrologers['online']}',     icon: Icons.circle, iconColor: Colors.greenAccent),
      _StatCard(label: 'Active Calls',       value: '${calls['active']}',           icon: Icons.phone_in_talk),
      _StatCard(label: 'Completed Calls',    value: '${calls['completed']}',        icon: Icons.check_circle_outline),
      _StatCard(label: 'Revenue (₹)',        value: '₹${(revenue['total_inr'] as num).toStringAsFixed(0)}', icon: Icons.currency_rupee),
    ];

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.6,
      children: cards,
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.iconColor = Colors.amber,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: iconColor, size: 20),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  style: const TextStyle(
                      color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              Text(label,
                  style: const TextStyle(color: Colors.white54, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}

class _AstrologerAdminTile extends StatelessWidget {
  final Map<String, dynamic> astrologer;
  final Future<void> Function(bool) onToggle;

  const _AstrologerAdminTile({required this.astrologer, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final isAvailable = astrologer['is_available'] == true;
    final earnings    = (astrologer['earnings_balance'] as num?)?.toDouble() ?? 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(astrologer['name'] as String,
                    style: const TextStyle(color: Colors.white, fontSize: 14)),
                const SizedBox(height: 2),
                Text('₹${earnings.toStringAsFixed(0)} earned  •  '
                    '₹${(astrologer['rate_per_minute'] as num).toStringAsFixed(0)}/min',
                    style: const TextStyle(color: Colors.white54, fontSize: 11)),
              ],
            ),
          ),
          Switch(
            value: isAvailable,
            activeColor: Colors.greenAccent,
            onChanged: onToggle,
          ),
        ],
      ),
    );
  }
}
