import 'package:flutter/material.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080618),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('JyotishConnect', style: TextStyle(fontSize: 32, color: Colors.amber)),
            const SizedBox(height: 20),
            TextField(decoration: InputDecoration(hintText: 'Phone', filled: true)),
            const SizedBox(height: 20),
            ElevatedButton(onPressed: () {
              Navigator.pushNamed(context, '/home');
            }, child: const Text('Get OTP'))
          ],
        ),
      ),
    );
  }
}