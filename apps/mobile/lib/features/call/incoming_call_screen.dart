import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import 'call_screen_v2.dart';

class IncomingCallScreen extends StatefulWidget {
  final String callId;
  final String channelName;
  final String agoraToken;
  final String seekerName;
  final double ratePerMinute;

  const IncomingCallScreen({
    super.key,
    required this.callId,
    required this.channelName,
    required this.agoraToken,
    required this.seekerName,
    required this.ratePerMinute,
  });

  @override
  State<IncomingCallScreen> createState() => _IncomingCallScreenState();
}

class _IncomingCallScreenState extends State<IncomingCallScreen>
    with SingleTickerProviderStateMixin {
  static const _countdownSeconds = 30;

  int _remaining = _countdownSeconds;
  Timer? _countdown;
  bool _acting = false;

  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _pulseAnim = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _countdown = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _remaining--);
      if (_remaining <= 0) _decline();
    });
  }

  @override
  void dispose() {
    _countdown?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    if (_acting) return;
    setState(() => _acting = true);
    _countdown?.cancel();

    if (!mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => CallScreen(
          astrologerId: '',
          astrologerName: widget.seekerName,
          rate: widget.ratePerMinute,
          prebuiltChannel: widget.channelName,
          prebuiltToken: widget.agoraToken,
          prebuiltCallId: widget.callId,
          isAstrologer: true,
        ),
      ),
    );
  }

  Future<void> _decline() async {
    if (_acting) return;
    setState(() => _acting = true);
    _countdown?.cancel();

    try {
      await ApiClient().post('/call/decline/${widget.callId}');
    } catch (_) {}

    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final progress = _remaining / _countdownSeconds;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),

            // ── Pulsing avatar ─────────────────────────────────────────────
            ScaleTransition(
              scale: _pulseAnim,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.amber.shade900.withOpacity(0.25),
                  border: Border.all(color: Colors.amber, width: 2.5),
                ),
                child: const Icon(Icons.person, color: Colors.amber, size: 64),
              ),
            ),

            const SizedBox(height: 24),

            Text(
              widget.seekerName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 8),

            Text(
              'Incoming call · ₹${widget.ratePerMinute.toStringAsFixed(0)}/min',
              style: const TextStyle(color: Colors.white54, fontSize: 15),
            ),

            const SizedBox(height: 32),

            // ── Countdown ring ─────────────────────────────────────────────
            SizedBox(
              width: 72,
              height: 72,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 5,
                    backgroundColor: Colors.white12,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      _remaining <= 10 ? Colors.redAccent : Colors.amber,
                    ),
                  ),
                  Text(
                    '$_remaining',
                    style: TextStyle(
                      color: _remaining <= 10 ? Colors.redAccent : Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            const Spacer(),

            // ── Accept / Decline ───────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 32),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _actionButton(
                    icon: Icons.call_end,
                    label: 'Decline',
                    color: Colors.red.shade700,
                    onTap: _acting ? null : _decline,
                  ),
                  _actionButton(
                    icon: Icons.call,
                    label: 'Accept',
                    color: Colors.green.shade600,
                    onTap: _acting ? null : _accept,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionButton({
    required IconData icon,
    required String label,
    required Color color,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: onTap != null ? color : color.withOpacity(0.4),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 32),
          ),
          const SizedBox(height: 8),
          Text(label,
              style: const TextStyle(color: Colors.white70, fontSize: 13)),
        ],
      ),
    );
  }
}
