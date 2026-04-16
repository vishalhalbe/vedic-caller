import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores JWT access + refresh tokens in platform secure storage:
/// - iOS: Keychain
/// - Android: EncryptedSharedPreferences / Keystore
class TokenStorage {
  static const _accessKey  = 'jwt_token';
  static const _refreshKey = 'jwt_refresh_token';
  static const _storage    = FlutterSecureStorage(
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

  /// Delete both tokens — call on logout.
  Future<void> deleteAll() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
