import 'package:flutter/material.dart';

class WalletWidget extends StatelessWidget {
  final double balance;
  const WalletWidget({super.key, required this.balance});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('Wallet', style: TextStyle(color: Colors.white)),
          Text('₹$balance', style: const TextStyle(color: Colors.green))
        ],
      ),
    );
  }
}