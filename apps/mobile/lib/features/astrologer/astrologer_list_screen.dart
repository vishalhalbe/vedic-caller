import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../main.dart' show logoutUser;
import '../wallet/wallet_provider.dart';
import '../wallet/wallet_widget.dart';

final astrologersProvider = FutureProvider.family<List<dynamic>, String>((ref, query) async {
  final path = query.isEmpty ? '/astrologer' : '/astrologer?name=${Uri.encodeQueryComponent(query)}';
  final res = await ApiClient().get(path);
  return res.data as List<dynamic>;
});

class AstrologerListScreen extends ConsumerStatefulWidget {
  const AstrologerListScreen({super.key});

  @override
  ConsumerState<AstrologerListScreen> createState() => _AstrologerListScreenState();
}

class _AstrologerListScreenState extends ConsumerState<AstrologerListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final astrologers = ref.watch(astrologersProvider(_searchQuery));

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
          // Onboarding banner — only shown when balance is zero
          Consumer(
            builder: (context, ref, _) {
              final balance = ref.watch(walletProvider).valueOrNull;
              if (balance == null || balance > 0) return const SizedBox.shrink();
              return Container(
                margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.deepPurple.withOpacity(0.25),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.4)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.deepPurpleAccent, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Welcome! Add funds above to start consulting with an astrologer.',
                        style: TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 8),
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search astrologers…',
                hintStyle: const TextStyle(color: Colors.white38),
                prefixIcon: const Icon(Icons.search, color: Colors.white38, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.white38, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                filled: true,
                fillColor: Colors.white.withOpacity(0.06),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (val) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), () {
                if (mounted) setState(() => _searchQuery = val.trim());
              });
            },
            ),
          ),
          // Astrologer list fills remaining space
          Expanded(
            child: astrologers.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Error: $e', style: const TextStyle(color: Colors.red)),
              ),
              data: (list) => RefreshIndicator(
                onRefresh: () => ref.refresh(astrologersProvider(_searchQuery).future),
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
                                specialty: a['specialty'] as String?,
                                yearsExperience: a['years_experience'] as int?,
                                photoUrl: a['photo_url'] as String?,
                                avgRating: (a['avg_rating'] as num?)?.toDouble(),
                                ratingCount: (a['rating_count'] as num?)?.toInt() ?? 0,
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
  final String? specialty;
  final int? yearsExperience;
  final String? photoUrl;
  final double? avgRating;
  final int ratingCount;

  const _AstrologerTile({
    required this.id,
    required this.name,
    required this.rate,
    required this.isAvailable,
    required this.walletBalance,
    this.specialty,
    this.yearsExperience,
    this.photoUrl,
    this.avgRating,
    this.ratingCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    // Require at least 1 minute of balance before allowing a call
    final canCall = isAvailable && walletBalance >= rate;

    return GestureDetector(
      onTap: () => context.push('/astrologer/$id'),
      child: Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          CircleAvatar(
            radius: 28,
            backgroundColor: Colors.deepPurple.withOpacity(0.3),
            backgroundImage: photoUrl != null ? NetworkImage(photoUrl!) : null,
            child: photoUrl == null
                ? Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white, fontSize: 20),
                  )
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        name,
                        style: const TextStyle(color: Colors.white, fontSize: 16),
                      ),
                    ),
                    if (avgRating != null) ...[
                      const Icon(Icons.star_rounded, color: Colors.amber, size: 14),
                      const SizedBox(width: 2),
                      Text(
                        avgRating!.toStringAsFixed(1),
                        style: const TextStyle(color: Colors.amber, fontSize: 12),
                      ),
                      Text(
                        ' ($ratingCount)',
                        style: const TextStyle(color: Colors.white38, fontSize: 11),
                      ),
                    ],
                  ],
                ),
                if (specialty != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      specialty!,
                      style: const TextStyle(color: Colors.deepPurpleAccent, fontSize: 12),
                    ),
                  ),
                if (yearsExperience != null && yearsExperience! > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Text(
                      '$yearsExperience yrs exp',
                      style: const TextStyle(color: Colors.white38, fontSize: 11),
                    ),
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
            child: Text(isAvailable ? 'Call' : 'Busy'),
          ),
        ],
      ),
    )); // GestureDetector + Container
  }
}
