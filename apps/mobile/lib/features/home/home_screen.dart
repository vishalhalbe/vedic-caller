import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(title: const Text('JyotishConnect')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Text('✨ Recommended Astrologers', style: TextStyle(fontSize: 18)),
          SizedBox(height: 12),
          AstrologerCard(name: 'Pt. Sharma', rate: 35),
          AstrologerCard(name: 'Jyotika Devi', rate: 75),
        ],
      ),
    );
  }
}

class AstrologerCard extends StatelessWidget {
  final String name;
  final int rate;

  const AstrologerCard({super.key, required this.name, required this.rate});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(name),
        subtitle: Text('₹$rate/min'),
        trailing: ElevatedButton(
          onPressed: () {},
          child: const Text('Call'),
        ),
      ),
    );
  }
}