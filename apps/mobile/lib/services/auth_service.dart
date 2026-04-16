import '../core/api_client.dart';

class AuthTokens {
  final String accessToken;
  final String refreshToken;
  AuthTokens({required this.accessToken, required this.refreshToken});
}

class AuthService {
  final _api = ApiClient();

  Future<AuthTokens> login(String email, String password) async {
    final res = await _api.post('/auth/login', data: {
      'email':    email.trim().toLowerCase(),
      'password': password,
    });
    return AuthTokens(
      accessToken:  res.data['token'] as String,
      refreshToken: res.data['refresh_token'] as String,
    );
  }

  Future<AuthTokens> register(String email, String password, {String name = ''}) async {
    final res = await _api.post('/auth/register', data: {
      'email':    email.trim().toLowerCase(),
      'password': password,
      'name':     name,
    });
    return AuthTokens(
      accessToken:  res.data['token'] as String,
      refreshToken: res.data['refresh_token'] as String,
    );
  }

  Future<void> logout({String? refreshToken}) async {
    try {
      await _api.post('/auth/logout', data: refreshToken != null
          ? {'refresh_token': refreshToken}
          : null);
    } catch (_) {
      // Best-effort — client always clears local tokens regardless
    }
  }
}
