import 'package:flutter/material.dart';

class AstrologerListScreen extends StatelessWidget {
  const AstrologerListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(title: const Text('Astrologers')),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 10,
        itemBuilder: (context, index) {
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('Astrologer Name', style: TextStyle(color: Colors.white)),
                    Text('₹50/min', style: TextStyle(color: Colors.white70)),
                  ],
                ),
                ElevatedButton(onPressed: () {}, child: const Text('Call'))
              ],
            ),
          );
        },
      ),
    );
  }
}