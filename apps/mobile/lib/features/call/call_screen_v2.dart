import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../core/api_client.dart';
import '../../core/app_provider.dart';
import '../../services/call_service.dart';
import '../wallet/wallet_provider.dart';

class CallScreen extends ConsumerStatefulWidget {
  final String astrologerId;
  final String astrologerName;
  final double rate;
  // Astrologer-side: pre-resolved channel/token from incoming call notification
  final String? prebuiltChannel;
  final String? prebuiltToken;
  final String? prebuiltCallId;
  final bool isAstrologer;

  const CallScreen({
    super.key,
    required this.astrologerId,
    required this.astrologerName,
    required this.rate,
    this.prebuiltChannel,
    this.prebuiltToken,
    this.prebuiltCallId,
    this.isAstrologer = false,
  });

  @override
  ConsumerState<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends ConsumerState<CallScreen> {
  // ── State ──────────────────────────────────────────────────────────────────
  late final RtcEngine _engine;
  bool   _engineReady   = false;
  bool   _starting      = true;
  bool   _ending        = false;
  bool   _muted         = false;
  bool   _remoteJoined  = false;
  String? _callId;
  String? _error;

  int    _seconds = 0;
  Timer? _timer;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _initAndStart();
  }

  @override
  void dispose() {
    _timer?.cancel();
    if (_engineReady) {
      _engine.leaveChannel();
      _engine.release();
    }
    super.dispose();
  }

  // ── Agora init ─────────────────────────────────────────────────────────────
  Future<void> _initAndStart() async {
    // 1. Microphone permission
    final status = await Permission.microphone.request();
    if (!status.isGranted) {
      if (mounted) setState(() {
        _error = 'Microphone permission is required to make calls.';
        _starting = false;
      });
      return;
    }

    // 2. Create and initialise engine
    _engine = createAgoraRtcEngine();
    await _engine.initialize(RtcEngineContext(
      appId: kAgoraAppId,
      channelProfile: ChannelProfileType.channelProfileCommunication,
    ));

    await _engine.enableAudio();
    await _engine.setDefaultAudioRouteToSpeakerphone(true);

    // 3. Register event callbacks
    _engine.registerEventHandler(RtcEngineEventHandler(
      onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
        if (mounted) setState(() { _engineReady = true; });
      },
      onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
        // Astrologer joined — start billing timer
        if (mounted) setState(() => _remoteJoined = true);
        _startTimer();
      },
      onUserOffline: (RtcConnection connection, int remoteUid,
          UserOfflineReasonType reason) {
        // Astrologer disconnected — end the call
        if (mounted) setState(() => _remoteJoined = false);
        _endCall();
      },
      onError: (ErrorCodeType err, String msg) {
        if (mounted) setState(() {
          _error = 'Call error ($err): $msg';
          _starting = false;
        });
      },
    ));

    _engineReady = true;

    // 4. Create server-side call record and get Agora token
    await _startCall();
  }

  Future<void> _startCall() async {
    try {
      final String channel;
      final String agoraToken;

      if (widget.prebuiltChannel != null && widget.prebuiltToken != null) {
        // Astrologer path — channel + token already known from incoming call
        _callId    = widget.prebuiltCallId;
        channel    = widget.prebuiltChannel!;
        agoraToken = widget.prebuiltToken!;
      } else {
        final data = await CallService().startCall(widget.astrologerId);
        _callId    = data['call_id'] as String?;
        channel    = data['channel'] as String;
        agoraToken = data['token']   as String;
      }

      // 5. Join the Agora channel with the server-issued token
      await _engine.joinChannel(
        token:     agoraToken,
        channelId: channel,
        uid:       0,
        options:   const ChannelMediaOptions(
          channelProfile:       ChannelProfileType.channelProfileCommunication,
          clientRoleType:       ClientRoleType.clientRoleBroadcaster,
          publishMicrophoneTrack: true,
          autoSubscribeAudio:   true,
        ),
      );

      if (mounted) setState(() => _starting = false);
    } catch (e) {
      if (mounted) setState(() {
        _error    = 'Failed to connect: ${e.toString().replaceAll('Exception: ', '')}';
        _starting = false;
      });
    }
  }

  // ── Call control ───────────────────────────────────────────────────────────
  // Agora tokens expire after 1 hour — auto-end the call at 55 minutes
  // to give the user a graceful exit before the token lapses.
  static const _maxCallSeconds = 55 * 60; // 55 minutes

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _seconds++);
      if (_seconds >= _maxCallSeconds && !_ending) {
        _endCall();
      }
    });
  }

  Future<void> _endCall() async {
    if (_ending) return;
    if (mounted) setState(() => _ending = true);
    _timer?.cancel();

    try {
      await _engine.leaveChannel();
    } catch (_) {}

    int?    finalDuration;
    double? finalCost;

    if (!widget.isAstrologer) {
      try {
        final result = await CallService().endCall(_callId);
        finalDuration = result['duration'] as int?;
        finalCost     = (result['cost'] as num?)?.toDouble();
        await ref.read(walletProvider.notifier).refresh();
      } catch (_) {
        // Navigate back regardless — server will eventually time out the call
      }
    }

    if (!mounted) return;
    // Only show summary + rating for seekers (billing is seeker-side).
    if (_callId != null && !widget.isAstrologer) {
      await _showCallSummary(
        duration: finalDuration ?? _seconds,
        cost:     finalCost ?? (widget.rate / 60) * _seconds,
      );
      if (mounted) {
        await _showRatingDialog();
      }
    }

    if (mounted) context.pop();
  }

  Future<void> _showCallSummary({required int duration, required double cost}) async {
    final m = (duration ~/ 60).toString().padLeft(2, '0');
    final s = (duration  % 60).toString().padLeft(2, '0');

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF131726),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isDismissible: false,
      enableDrag: false,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle_outline, color: Colors.greenAccent, size: 48),
            const SizedBox(height: 12),
            const Text('Call Ended',
                style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _summaryTile(label: 'Duration', value: '$m:$s'),
                _summaryTile(label: 'Charged',  value: '₹${cost.toStringAsFixed(2)}'),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber.shade600,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Done', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showRatingDialog() async {
    int selected = 0;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF131726),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Rate your session',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('How was your call with ${widget.astrologerName}?',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white54, fontSize: 14)),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final star = i + 1;
                  return GestureDetector(
                    onTap: () => setModalState(() => selected = star),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Icon(
                        selected >= star ? Icons.star_rounded : Icons.star_outline_rounded,
                        color: Colors.amber,
                        size: 44,
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white54,
                        side: const BorderSide(color: Colors.white24),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Skip'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber.shade600,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: selected == 0
                          ? null
                          : () async {
                              Navigator.of(ctx).pop();
                              try {
                                await ApiClient().post('/call/rate',
                                    data: {'call_id': _callId, 'rating': selected});
                              } catch (_) {
                                // Rating failure is silent — don't block user
                              }
                            },
                      child: const Text('Submit', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryTile({required String label, required String value}) {
    return Column(children: [
      Text(label, style: const TextStyle(color: Colors.white54, fontSize: 13)),
      const SizedBox(height: 4),
      Text(value, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
    ]);
  }

  Future<void> _toggleMute() async {
    final next = !_muted;
    await _engine.muteLocalAudioStream(next);
    setState(() => _muted = next);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  String get _formattedTime {
    final m = (_seconds ~/ 60).toString().padLeft(2, '0');
    final s = (_seconds  % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    if (_error != null) return _errorScreen();

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(widget.astrologerName,
            style: const TextStyle(color: Colors.white)),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: _starting
            ? _connectingView()
            : _callView(),
      ),
    );
  }

  Widget _connectingView() {
    return const Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        CircularProgressIndicator(color: Colors.amber),
        SizedBox(height: 20),
        Text('Connecting…', style: TextStyle(color: Colors.white54, fontSize: 16)),
      ]),
    );
  }

  Widget _callView() {
    final cost = (widget.rate / 60) * _seconds;
    final walletBalance = ref.watch(walletProvider).valueOrNull ?? 0.0;
    final remainingBalance = walletBalance - cost;
    final secondsRemaining = (remainingBalance / (widget.rate / 60)).floor();
    final lowBalance = _remoteJoined && secondsRemaining < 60 && secondsRemaining >= 0;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Low balance warning banner
        if (lowBalance)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.orange.shade900.withOpacity(0.85),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.orangeAccent, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Low balance — ~$secondsRemaining seconds left',
                  style: const TextStyle(color: Colors.orangeAccent, fontSize: 13),
                ),
              ],
            ),
          ),
        // ── Avatar ──────────────────────────────────────────────────────────
        Container(
          width: 100, height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.amber.shade900.withOpacity(0.3),
            border: Border.all(
              color: _remoteJoined ? Colors.greenAccent : Colors.white24,
              width: 2,
            ),
          ),
          child: const Icon(Icons.person, color: Colors.amber, size: 52),
        ),
        const SizedBox(height: 16),

        // ── Status label ────────────────────────────────────────────────────
        Text(
          _remoteJoined ? 'Connected' : 'Waiting for astrologer…',
          style: TextStyle(
            color: _remoteJoined ? Colors.greenAccent : Colors.white38,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 32),

        // ── Timer ───────────────────────────────────────────────────────────
        Text(_formattedTime,
            style: const TextStyle(
                color: Colors.white, fontSize: 52, fontWeight: FontWeight.bold,
                letterSpacing: 4)),
        const SizedBox(height: 8),

        // ── Cost ────────────────────────────────────────────────────────────
        Text('₹${cost.toStringAsFixed(2)}',
            style: const TextStyle(color: Colors.amber, fontSize: 26,
                fontWeight: FontWeight.w600)),
        Text('₹${widget.rate.toStringAsFixed(0)}/min',
            style: const TextStyle(color: Colors.white38, fontSize: 13)),
        const SizedBox(height: 56),

        // ── Controls ────────────────────────────────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Mute toggle
            _controlButton(
              icon: _muted ? Icons.mic_off : Icons.mic,
              label: _muted ? 'Unmute' : 'Mute',
              color: _muted ? Colors.red.shade700 : Colors.white24,
              onTap: _toggleMute,
            ),
            const SizedBox(width: 32),
            // End call
            _controlButton(
              icon: Icons.call_end,
              label: _ending ? 'Ending…' : 'End Call',
              color: Colors.red,
              size: 64,
              onTap: _ending ? null : _endCall,
            ),
          ],
        ),
      ],
    );
  }

  Widget _controlButton({
    required IconData icon,
    required String label,
    required Color color,
    double size = 52,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(children: [
        Container(
          width: size, height: size,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          child: Icon(icon, color: Colors.white, size: size * 0.45),
        ),
        const SizedBox(height: 6),
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
      ]),
    );
  }

  Widget _errorScreen() {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.call_end, color: Colors.redAccent, size: 56),
            const SizedBox(height: 16),
            Text(_error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 15)),
            const SizedBox(height: 28),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.white12),
              onPressed: () => context.pop(),
              child: const Text('Go Back', style: TextStyle(color: Colors.white)),
            ),
          ]),
        ),
      ),
    );
  }
}
