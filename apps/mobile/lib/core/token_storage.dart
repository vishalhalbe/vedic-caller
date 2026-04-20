import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores JWT access + refresh tokens and is_admin flag in platform secure storage:
/// - iOS: Keychain
/// - Android: EncryptedSharedPreferences / Keystore
class TokenStorage {
  static const _accessKey        = 'jwt_token';
  static const _refreshKey       = 'jwt_refresh_token';
  static const _isAdminKey       = 'is_admin';
  static const _roleKey          = 'user_role';
  static const _astrologerIdKey  = 'astrologer_id';
  static const _storage     = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  // Access token (15-minute JWT)
  Future<void>    save(String token)  => _storage.write(key: _accessKey, value: token);
  Future<String?> get()               => _storage.read(key: _accessKey);
  Future<void>    delete()            => _storage.delete(key: _accessKey);

  // Refresh token (30-day opaque hex token)
  Future<void>    saveRefresh(String token) => _storage.write(key: _refreshKey, value: token);
  Future<String?> getRefresh()              => _storage.read(key: _refreshKey);
  Future<void>    deleteRefresh()           => _storage.delete(key: _refreshKey);

  // Admin flag — persisted from login/register response
  Future<void> saveIsAdmin(bool v) =>
      _storage.write(key: _isAdminKey, value: v ? '1' : '0');
  Future<bool> getIsAdmin() async {
    final v = await _storage.read(key: _isAdminKey);
    return v == '1';
  }

  // Role: 'seeker' | 'astrologer'
  Future<void>    saveRole(String role)  => _storage.write(key: _roleKey, value: role);
  Future<String>  getRole()             async {
    final v = await _storage.read(key: _roleKey);
    return v ?? 'seeker';
  }

  // Astrologer ID (only set when role == 'astrologer')
  Future<void>    saveAstrologerId(String id) => _storage.write(key: _astrologerIdKey, value: id);
  Future<String?> getAstrologerId()           => _storage.read(key: _astrologerIdKey);

  /// Delete all stored values — call on logout.
  Future<void> deleteAll() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _isAdminKey);
    await _storage.delete(key: _roleKey);
    await _storage.delete(key: _astrologerIdKey);
  }
}
