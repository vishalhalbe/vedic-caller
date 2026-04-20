import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../wallet/wallet_provider.dart';

final _profileProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final res = await ApiClient().get('/astrologer/$id');
  return res.data as Map<String, dynamic>;
});

class AstrologerProfileScreen extends ConsumerWidget {
  final String astrologerId;

  const AstrologerProfileScreen({super.key, required this.astrologerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(_profileProvider(astrologerId));
    final balance = ref.watch(walletProvider).valueOrNull ?? 0.0;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Colors.amber)),
        error: (e, _) => Center(
          child: Text('Error loading profile', style: const TextStyle(color: Colors.red)),
        ),
        data: (a) {
          final rate        = (a['rate_per_minute'] as num).toDouble();
          final isAvailable = a['is_available'] == true;
          final canCall     = isAvailable && balance >= rate;
          final avgRating   = (a['avg_rating'] as num?)?.toDouble();
          final ratingCount = (a['rating_count'] as num?)?.toInt() ?? 0;
          final reviews     = (a['reviews'] as List<dynamic>?) ?? [];

          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 220,
                pinned: true,
                backgroundColor: const Color(0xFF131726),
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFF1A0A3A), Color(0xFF131726)],
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 48),
                        CircleAvatar(
                          radius: 44,
                          backgroundColor: Colors.deepPurple.withOpacity(0.4),
                          backgroundImage: a['photo_url'] != null
                              ? NetworkImage(a['photo_url'] as String)
                              : null,
                          child: a['photo_url'] == null
                              ? Text(
                                  (a['name'] as String).isNotEmpty
                                      ? (a['name'] as String)[0].toUpperCase()
                                      : '?',
                                  style: const TextStyle(color: Colors.white, fontSize: 32),
                                )
                              : null,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          a['name'] as String,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        if (avgRating != null) ...[
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              ...List.generate(5, (i) => Icon(
                                i < avgRating.round()
                                    ? Icons.star_rounded
                                    : Icons.star_outline_rounded,
                                color: Colors.amber,
                                size: 18,
                              )),
                              const SizedBox(width: 6),
                              Text(
                                '${avgRating.toStringAsFixed(1)} ($ratingCount)',
                                style: const TextStyle(color: Colors.amber, fontSize: 13),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => context.pop(),
                ),
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Info chips ────────────────────────────────────────
                      Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        children: [
                          _chip(Icons.currency_rupee,
                              '₹${rate.toStringAsFixed(0)}/min', Colors.amber),
                          if (a['specialty'] != null)
                            _chip(Icons.auto_awesome, a['specialty'] as String,
                                Colors.deepPurpleAccent),
                          if ((a['years_experience'] as int? ?? 0) > 0)
                            _chip(Icons.workspace_premium,
                                '${a['years_experience']} yrs exp', Colors.tealAccent),
                          _chip(
                            isAvailable ? Icons.circle : Icons.circle_outlined,
                            isAvailable ? 'Available' : 'Offline',
                            isAvailable ? Colors.greenAccent : Colors.redAccent,
                          ),
                        ],
                      ),

                      // ── Bio ───────────────────────────────────────────────
                      if (a['bio'] != null && (a['bio'] as String).isNotEmpty) ...[
                        const SizedBox(height: 24),
                        const Text('About',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Text(
                          a['bio'] as String,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 14, height: 1.6),
                        ),
                      ],

                      // ── Reviews ───────────────────────────────────────────
                      if (reviews.isNotEmpty) ...[
                        const SizedBox(height: 28),
                        Text('Reviews (${reviews.length})',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 12),
                        ...reviews.map((r) {
                          final stars = r['rating'] as int;
                          final seeker = r['seeker'] as String? ?? 'Seeker';
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundColor: Colors.deepPurple.withOpacity(0.3),
                                  child: Text(
                                    seeker[0].toUpperCase(),
                                    style: const TextStyle(color: Colors.white, fontSize: 12),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(seeker,
                                          style: const TextStyle(
                                              color: Colors.white70, fontSize: 13)),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: List.generate(
                                          5,
                                          (i) => Icon(
                                            i < stars
                                                ? Icons.star_rounded
                                                : Icons.star_outline_rounded,
                                            color: Colors.amber,
                                            size: 14,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ] else ...[
                        const SizedBox(height: 28),
                        const Center(
                          child: Text('No reviews yet',
                              style: TextStyle(color: Colors.white38, fontSize: 13)),
                        ),
                      ],

                      const SizedBox(height: 32),

                      // ── CTA ────────────────────────────────────────────────
                      if (isAvailable && balance < rate)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Text(
                            'Add at least ₹${rate.toStringAsFixed(0)} to your wallet to call',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.orangeAccent, fontSize: 13),
                          ),
                        ),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor:
                                canCall ? Colors.amber.shade600 : Colors.grey.shade800,
                            foregroundColor: canCall ? Colors.black : Colors.white38,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: canCall
                              ? () => context.push('/call', extra: {
                                    'astrologer_id': astrologerId,
                                    'name': a['name'] as String,
                                    'rate': rate,
                                  })
                              : null,
                          icon: const Icon(Icons.call),
                          label: Text(
                            isAvailable ? 'Call Now' : 'Not Available',
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _chip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 13),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(color: color, fontSize: 12)),
        ],
      ),
    );
  }
}
