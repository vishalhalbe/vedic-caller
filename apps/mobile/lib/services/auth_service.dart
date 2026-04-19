import '../core/api_client.dart';

class AuthTokens {
  final String  accessToken;
  final String  refreshToken;
  final bool    isAdmin;
  final String  role;          // 'seeker' | 'astrologer'
  final String? astrologerId;
  AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    this.isAdmin       = false,
    this.role          = 'seeker',
    this.astrologerId,
  });
}

class AuthService {
  final _api = ApiClient();

  Future<AuthTokens> login(String email, String password) async {
    final res = await _api.post('/auth/login', data: {
      'email':    email.trim().toLowerCase(),
      'password': password,
    });
    return AuthTokens(
      accessToken:  res.data['token']         as String,
      refreshToken: res.data['refresh_token'] as String,
      isAdmin:      res.data['is_admin']       == true,
      role:         'seeker',
    );
  }

  Future<AuthTokens> register(String email, String password, {String name = ''}) async {
    final res = await _api.post('/auth/register', data: {
      'email':    email.trim().toLowerCase(),
      'password': password,
      'name':     name,
    });
    return AuthTokens(
      accessToken:  res.data['token']         as String,
      refreshToken: res.data['refresh_token'] as String,
      isAdmin:      res.data['is_admin']       == true,
      role:         'seeker',
    );
  }

  Future<AuthTokens> astrologerLogin(String email, String password) async {
    final res = await _api.post('/astrologer/auth/login', data: {
      'email':    email.trim().toLowerCase(),
      'password': password,
    });
    return AuthTokens(
      accessToken:   res.data['token']          as String,
      refreshToken:  '',
      role:          'astrologer',
      astrologerId:  res.data['astrologer_id']  as String?,
    );
  }

  Future<AuthTokens> astrologerRegister(String name, String email, String password) async {
    final res = await _api.post('/astrologer/auth/register', data: {
      'name':     name.trim(),
      'email':    email.trim().toLowerCase(),
      'password': password,
    });
    return AuthTokens(
      accessToken:   res.data['token']          as String,
      refreshToken:  '',
      role:          'astrologer',
      astrologerId:  res.data['astrologer_id']  as String?,
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
