import '../core/api_client.dart';

class AuthService {
  final _api = ApiClient();

  Future<String> login(String email, String password) async {
    final res = await _api.post('/auth/login', data: {
      'email':    email.trim().toLowerCase(),
      'password': password,
    });
    return res.data['token'] as String;
  }

  Future<String> register(String email, String password, {String name = ''}) async {
    final res = await _api.post('/auth/register', data: {
      'email':    email.trim().toLowerCase(),
      'password': password,
      'name':     name,
    });
    return res.data['token'] as String;
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // Best-effort — client always clears local token regardless
    }
  }
}
