import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../services/auth_service.dart';
import '../../core/token_storage.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey   = GlobalKey<FormState>();
  final _email     = TextEditingController();
  final _password  = TextEditingController();
  final _name      = TextEditingController();

  bool    _isRegister     = false;
  bool    _loading        = false;
  bool    _obscurePass    = true;
  bool    _isAstrologer   = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    try {
      final svc     = AuthService();
      final storage = TokenStorage();
      AuthTokens tokens;

      if (_isAstrologer) {
        tokens = _isRegister
            ? await svc.astrologerRegister(_name.text.trim(), _email.text, _password.text)
            : await svc.astrologerLogin(_email.text, _password.text);
      } else {
        tokens = _isRegister
            ? await svc.register(_email.text, _password.text, name: _name.text.trim())
            : await svc.login(_email.text, _password.text);
      }

      await storage.save(tokens.accessToken);
      await storage.saveRole(tokens.role);
      if (tokens.refreshToken.isNotEmpty) {
        await storage.saveRefresh(tokens.refreshToken);
      }
      await storage.saveIsAdmin(tokens.isAdmin);
      if (tokens.astrologerId != null) {
        await storage.saveAstrologerId(tokens.astrologerId!);
      }

      if (!mounted) return;
      if (tokens.role == 'astrologer') {
        context.go('/astrologer/dashboard');
      } else {
        context.go('/home');
      }
    } catch (e) {
      setState(() {
        final msg = e.toString().toLowerCase();
        if (msg.contains('409') || msg.contains('already registered')) {
          _error = 'Email already registered. Try logging in.';
        } else if (msg.contains('401') || msg.contains('invalid credentials')) {
          _error = 'Incorrect email or password.';
        } else {
          _error = 'Connection error. Please try again.';
        }
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 48),
                const Text(
                  '✨ JyotishConnect',
                  style: TextStyle(color: Colors.amber, fontSize: 28, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _isRegister ? 'Create your account' : 'Sign in to continue',
                  style: const TextStyle(color: Colors.white54),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),

                // Role toggle
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      _roleTab('Seeker',      !_isAstrologer),
                      _roleTab('Astrologer',   _isAstrologer),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Name field — register only
                if (_isRegister) ...[
                  _field(
                    controller: _name,
                    hint: 'Your name',
                    icon: Icons.person_outline,
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Name required' : null,
                  ),
                  const SizedBox(height: 16),
                ],

                // Email
                _field(
                  controller: _email,
                  hint: 'Email address',
                  icon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Email required';
                    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v)) {
                      return 'Enter a valid email';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Password
                _field(
                  controller: _password,
                  hint: 'Password',
                  icon: Icons.lock_outline,
                  obscure: _obscurePass,
                  suffix: IconButton(
                    icon: Icon(
                      _obscurePass ? Icons.visibility_off : Icons.visibility,
                      color: Colors.white38, size: 20,
                    ),
                    onPressed: () => setState(() => _obscurePass = !_obscurePass),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Password required';
                    if (_isRegister && v.length < 8) return 'Minimum 8 characters';
                    return null;
                  },
                ),

                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],

                const SizedBox(height: 28),

                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber.shade600,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(width: 22, height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                        : Text(
                            _isRegister ? 'Create account' : 'Sign in',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),

                const SizedBox(height: 20),

                TextButton(
                  onPressed: () => setState(() {
                    _isRegister = !_isRegister;
                    _error = null;
                  }),
                  child: Text(
                    _isRegister
                        ? 'Already have an account? Sign in'
                        : "Don't have an account? Register",
                    style: const TextStyle(color: Colors.white54, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _roleTab(String label, bool active) {
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _isAstrologer = label == 'Astrologer';
          _isRegister   = false;
          _error        = null;
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? Colors.amber.shade600 : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color:      active ? Colors.black : Colors.white54,
              fontWeight: active ? FontWeight.bold : FontWeight.normal,
              fontSize:   14,
            ),
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    bool obscure = false,
    Widget? suffix,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscure,
      style: const TextStyle(color: Colors.white),
      validator: validator,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.white38),
        prefixIcon: Icon(icon, color: Colors.white38, size: 20),
        suffixIcon: suffix,
        filled: true,
        fillColor: Colors.white.withOpacity(0.07),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        errorStyle: const TextStyle(color: Colors.redAccent, fontSize: 12),
      ),
    );
  }
}
