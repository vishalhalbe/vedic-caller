import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../core/token_storage.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final phoneController = TextEditingController();
  bool loading = false;

  void login() async {
    setState(() => loading = true);
    final token = await AuthService().login(phoneController.text);
    await TokenStorage().save(token);
    setState(() => loading = false);
    Navigator.pushNamed(context, '/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(controller: phoneController, decoration: const InputDecoration(hintText: 'Phone')),
            const SizedBox(height: 20),
            loading
                ? const CircularProgressIndicator()
                : ElevatedButton(onPressed: login, child: const Text('Login'))
          ],
        ),
      ),
    );
  }
}