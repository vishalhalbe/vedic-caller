import 'package:flutter/material.dart';
import '../../services/history_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List data = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  void load() async {
    final res = await HistoryService().getHistory(1);
    setState(() => data = res);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Call History')),
      body: ListView.builder(
        itemCount: data.length,
        itemBuilder: (_, i) => ListTile(
          title: Text('Call ${data[i]['duration']} sec'),
          subtitle: Text('₹${data[i]['cost']}'),
        ),
      ),
    );
  }
}