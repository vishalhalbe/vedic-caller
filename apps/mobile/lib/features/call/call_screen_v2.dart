import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/call_service.dart';

class CallScreen extends StatefulWidget {
  final double rate;
  const CallScreen({super.key, required this.rate});

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  int seconds = 0;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => seconds++);
    });
  }

  void endCall() async {
    timer?.cancel();
    await CallService().endCall(widget.rate, seconds);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final cost = (widget.rate / 60) * seconds;
    return Scaffold(
      body: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('Time: $seconds s'),
          Text('Cost: ₹${cost.toStringAsFixed(2)}'),
          ElevatedButton(onPressed: endCall, child: const Text('End Call'))
        ],
      ),
    );
  }
}
