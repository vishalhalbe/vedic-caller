import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../main.dart';
import '../call/incoming_call_screen.dart';

// ── providers ────────────────────────────────────────────────────────────────

final _dashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final res = await ApiClient().get('/astrologer/me');
  return Map<String, dynamic>.from(res.data as Map);
});

final _availabilityProvider = StateProvider<bool?>((ref) => null);

// ── screen ───────────────────────────────────────────────────────────────────

class AstrologerDashboardScreen extends ConsumerStatefulWidget {
  const AstrologerDashboardScreen({super.key});

  @override
  ConsumerState<AstrologerDashboardScreen> createState() =>
      _AstrologerDashboardScreenState();
}

class _AstrologerDashboardScreenState
    extends ConsumerState<AstrologerDashboardScreen> {
  bool _togglingAvailability = false;
  Timer? _pollTimer;
  bool _incomingCallNavigating = false;

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _pollIncoming());
  }

  Future<void> _pollIncoming() async {
    if (_incomingCallNavigating) return;
    final isAvailable = ref.read(_availabilityProvider);
    // Also check the loaded profile value
    final profileSnap = ref.read(_dashboardProvider);
    final profileAvailable = profileSnap.valueOrNull?['is_available'] as bool? ?? false;
    final available = isAvailable ?? profileAvailable;
    if (!available) return;

    try {
      final res = await ApiClient().get('/call/incoming');
      final call = (res.data as Map?)?['call'];
      if (call == null || !mounted) return;

      _incomingCallNavigating = true;
      _pollTimer?.cancel();

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => IncomingCallScreen(
            callId: call['id'] as String,
            channelName: call['channel'] as String? ?? '',
            agoraToken: call['agora_token'] as String? ?? '',
            seekerName: call['seeker_name'] as String? ?? 'Seeker',
            ratePerMinute:
                double.tryParse(call['rate_per_minute']?.toString() ?? '0') ?? 0,
          ),
        ),
      );

      _incomingCallNavigating = false;
      _startPolling();
      ref.invalidate(_dashboardProvider);
    } on Object catch (_) {
      // Network error — silently ignore and retry next tick
    }
  }

  Future<void> _toggleAvailability(bool current) async {
    setState(() => _togglingAvailability = true);
    try {
      final next = !current;
      final res = await ApiClient().post(
        '/astrologer/me/availability',
        data: {'available': next},
      );
      final updated = res.data as Map;
      ref.read(_availabilityProvider.notifier).state =
          updated['is_available'] as bool;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _togglingAvailability = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final snap = ref.watch(_dashboardProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0E1A),
        elevation: 0,
        title: const Text('Dashboard',
            style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white54),
            onPressed: () => ref.invalidate(_dashboardProvider),
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white54),
            onPressed: () => logoutUser(ref, context),
          ),
        ],
      ),
      body: snap.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: Colors.amber)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load', style: TextStyle(color: Colors.white54)),
              TextButton(
                onPressed: () => ref.invalidate(_dashboardProvider),
                child: const Text('Retry', style: TextStyle(color: Colors.amber)),
              ),
            ],
          ),
        ),
        data: (profile) {
          final isAvailable =
              ref.watch(_availabilityProvider) ?? (profile['is_available'] as bool? ?? false);
          final earnings =
              double.tryParse(profile['earnings_balance']?.toString() ?? '0') ?? 0;
          final rate =
              double.tryParse(profile['rate_per_minute']?.toString() ?? '0') ?? 0;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Profile card ────────────────────────────────────────────
                _Card(
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: Colors.amber.withOpacity(0.15),
                        child: Text(
                          (profile['name'] as String? ?? '?')[0].toUpperCase(),
                          style: const TextStyle(
                              color: Colors.amber,
                              fontSize: 24,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              profile['name'] as String? ?? '',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              profile['email'] as String? ?? '',
                              style: const TextStyle(
                                  color: Colors.white54, fontSize: 13),
                            ),
                            Text(
                              '₹$rate / min',
                              style: TextStyle(
                                  color: Colors.amber.shade300, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ── Availability toggle ──────────────────────────────────────
                _Card(
                  child: Row(
                    children: [
                      Icon(
                        isAvailable ? Icons.circle : Icons.circle_outlined,
                        color: isAvailable ? Colors.greenAccent : Colors.white38,
                        size: 14,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isAvailable ? 'Online — accepting calls' : 'Offline',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isAvailable
                                  ? 'Seekers can see and call you'
                                  : 'You are hidden from seekers',
                              style: const TextStyle(
                                  color: Colors.white38, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      _togglingAvailability
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.amber))
                          : Switch(
                              value: isAvailable,
                              activeColor: Colors.greenAccent,
                              onChanged: (_) => _toggleAvailability(isAvailable),
                            ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ── Earnings card ────────────────────────────────────────────
                _Card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Earnings Balance',
                          style:
                              TextStyle(color: Colors.white54, fontSize: 13)),
                      const SizedBox(height: 8),
                      Text(
                        '₹${earnings.toStringAsFixed(2)}',
                        style: const TextStyle(
                            color: Colors.amber,
                            fontSize: 32,
                            fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.amber,
                            side: const BorderSide(color: Colors.amber),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () => context.push('/astrologer/earnings'),
                          child: const Text('View earnings & withdraw'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── shared card widget ────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: child,
    );
  }
}
