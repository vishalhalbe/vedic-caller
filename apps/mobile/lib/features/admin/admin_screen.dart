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

final adminWithdrawalsProvider = FutureProvider<List<dynamic>>((ref) async {
  final res = await ApiClient().get('/admin/withdrawals?status=pending');
  return res.data as List<dynamic>;
});

class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(adminStatsProvider);
    ref.invalidate(adminAstrologersProvider);
    ref.invalidate(adminWithdrawalsProvider);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Admin Dashboard',
            style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white54),
            onPressed: _refresh,
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: Colors.amber,
          labelColor: Colors.amber,
          unselectedLabelColor: Colors.white54,
          tabs: const [
            Tab(text: 'Stats'),
            Tab(text: 'Astrologers'),
            Tab(text: 'Withdrawals'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _StatsTab(ref: ref),
          _AstrologersTab(ref: ref),
          _WithdrawalsTab(ref: ref, onRefresh: _refresh),
        ],
      ),
    );
  }
}

// ── Stats tab ──────────────────────────────────────────────────────────────────

class _StatsTab extends StatelessWidget {
  final WidgetRef ref;
  const _StatsTab({required this.ref});

  @override
  Widget build(BuildContext context) {
    final stats = ref.watch(adminStatsProvider);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        stats.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e',
              style: const TextStyle(color: Colors.redAccent)),
          data: (data) => _StatsGrid(data: data),
        ),
      ],
    );
  }
}

// ── Astrologers tab ────────────────────────────────────────────────────────────

class _AstrologersTab extends StatelessWidget {
  final WidgetRef ref;
  const _AstrologersTab({required this.ref});

  @override
  Widget build(BuildContext context) {
    final astrologers = ref.watch(adminAstrologersProvider);
    return astrologers.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
          child: Text('Error: $e', style: const TextStyle(color: Colors.redAccent))),
      data: (list) => list.isEmpty
          ? const Center(
              child: Text('No astrologers yet',
                  style: TextStyle(color: Colors.white54)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              itemBuilder: (ctx, i) => _AstrologerAdminTile(
                astrologer: list[i] as Map<String, dynamic>,
                onToggle: (available) async {
                  try {
                    await ApiClient().post(
                        '/admin/astrologers/${list[i]['id']}/toggle',
                        data: {'available': available});
                    ref.invalidate(adminAstrologersProvider);
                  } on Exception catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(
                            content: Text('Toggle failed: $e'),
                            backgroundColor: Colors.redAccent),
                      );
                    }
                  }
                },
              ),
            ),
    );
  }
}

// ── Withdrawals tab ────────────────────────────────────────────────────────────

class _WithdrawalsTab extends StatelessWidget {
  final WidgetRef ref;
  final VoidCallback onRefresh;
  const _WithdrawalsTab({required this.ref, required this.onRefresh});

  Future<void> _approve(
      BuildContext context, String id, double amount) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1F35),
        title: const Text('Approve Withdrawal',
            style: TextStyle(color: Colors.white)),
        content: Text('Approve ₹${amount.toStringAsFixed(0)} payout?',
            style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Approve')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient().post('/admin/withdrawals/$id/approve');
      onRefresh();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Withdrawal approved'),
              backgroundColor: Colors.green),
        );
      }
    } on Exception catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: $e'),
              backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  Future<void> _reject(BuildContext context, String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1F35),
        title: const Text('Reject Withdrawal',
            style: TextStyle(color: Colors.white)),
        content: const Text('Are you sure? This cannot be undone.',
            style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Reject')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient().post('/admin/withdrawals/$id/reject');
      onRefresh();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Withdrawal rejected'),
              backgroundColor: Colors.orangeAccent),
        );
      }
    } on Exception catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Error: $e'),
              backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final withdrawals = ref.watch(adminWithdrawalsProvider);
    return withdrawals.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
          child: Text('Error: $e', style: const TextStyle(color: Colors.redAccent))),
      data: (list) => list.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_outline, color: Colors.greenAccent, size: 48),
                  SizedBox(height: 12),
                  Text('No pending withdrawals',
                      style: TextStyle(color: Colors.white54)),
                ],
              ))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              itemBuilder: (ctx, i) {
                final w = list[i] as Map<String, dynamic>;
                final amount = (w['amount'] as num).toDouble();
                final astro = w['astrologers'] as Map<String, dynamic>?;
                final name = astro?['name'] as String? ?? 'Unknown';
                final email = astro?['email'] as String? ?? '';
                final createdAt = w['created_at'] as String? ?? '';
                final dateStr = createdAt.length >= 10 ? createdAt.substring(0, 10) : createdAt;

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold)),
                          Text('₹${amount.toStringAsFixed(0)}',
                              style: const TextStyle(
                                  color: Colors.amber,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('$email  •  $dateStr',
                          style: const TextStyle(color: Colors.white54, fontSize: 11)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.redAccent,
                                side: const BorderSide(color: Colors.redAccent),
                              ),
                              onPressed: () => _reject(ctx, w['id'] as String),
                              child: const Text('Reject'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                              ),
                              onPressed: () =>
                                  _approve(ctx, w['id'] as String, amount),
                              child: const Text('Approve'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

// ── Shared widgets ─────────────────────────────────────────────────────────────

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
      _StatCard(label: 'Total Users',    value: '${users['total']}',        icon: Icons.people),
      _StatCard(label: 'Astrologers',    value: '${astrologers['total']}',   icon: Icons.stars),
      _StatCard(label: 'Online Now',     value: '${astrologers['online']}',  icon: Icons.circle, iconColor: Colors.greenAccent),
      _StatCard(label: 'Active Calls',   value: '${calls['active']}',        icon: Icons.phone_in_talk),
      _StatCard(label: 'Completed',      value: '${calls['completed']}',     icon: Icons.check_circle_outline),
      _StatCard(label: 'Revenue (₹)',    value: '₹${(revenue['total_inr'] as num).toStringAsFixed(0)}', icon: Icons.currency_rupee),
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
