import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores the JWT in platform secure storage:
/// - iOS: Keychain
/// - Android: EncryptedSharedPreferences / Keystore
class TokenStorage {
  static const _key = 'jwt_token';
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> save(String token) => _storage.write(key: _key, value: token);

  Future<String?> get() => _storage.read(key: _key);

  Future<void> delete() => _storage.delete(key: _key);
}
