import 'package:shared_preferences/shared_preferences.dart';

class TokenStorage {
  static const _key = 'jwt_token';

  Future<void> save(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, token);
  }

  Future<String?> get() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_key);
  }
}
