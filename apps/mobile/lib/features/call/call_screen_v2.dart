import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/call_service.dart';
import '../wallet/wallet_provider.dart';

class CallScreen extends ConsumerStatefulWidget {
  final String astrologerId;
  final String astrologerName;
  final double rate;

  const CallScreen({
    super.key,
    required this.astrologerId,
    required this.astrologerName,
    required this.rate,
  });

  @override
  ConsumerState<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends ConsumerState<CallScreen> {
  int _seconds = 0;
  Timer? _timer;
  String? _callId;
  bool _starting = true;
  bool _ending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startCall();
  }

  Future<void> _startCall() async {
    try {
      final data = await CallService().startCall(widget.astrologerId, widget.rate);
      _callId = data['call_id'] as String?;
      setState(() => _starting = false);
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() => _seconds++);
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _starting = false;
      });
    }
  }

  Future<void> _endCall() async {
    if (_ending) return;
    setState(() => _ending = true);
    _timer?.cancel();
    try {
      await CallService().endCall(_callId, widget.rate);
      // Refresh wallet balance after call
      ref.read(walletProvider.notifier).refresh();
    } catch (e) {
      // Call ended — navigate back regardless
    }
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String get _formattedTime {
    final m = (_seconds ~/ 60).toString().padLeft(2, '0');
    final s = (_seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final cost = (widget.rate / 60) * _seconds;

    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 48),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Go Back')),
          ]),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(widget.astrologerName),
        automaticallyImplyLeading: false,
      ),
      body: Center(
        child: _starting
            ? const CircularProgressIndicator()
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.call, color: Colors.greenAccent, size: 64),
                  const SizedBox(height: 24),
                  Text(_formattedTime,
                      style: const TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('₹${cost.toStringAsFixed(2)}',
                      style: const TextStyle(color: Colors.amber, fontSize: 24)),
                  const SizedBox(height: 8),
                  Text('₹${widget.rate.toStringAsFixed(0)}/min',
                      style: const TextStyle(color: Colors.white54)),
                  const SizedBox(height: 48),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
                    ),
                    onPressed: _ending ? null : _endCall,
                    icon: const Icon(Icons.call_end),
                    label: _ending
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('End Call'),
                  ),
                ],
              ),
      ),
    );
  }
}
