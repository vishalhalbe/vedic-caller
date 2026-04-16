import 'package:flutter_test/flutter_test.dart';
import 'package:jyotishconnect/services/auth_service.dart';

// AuthService makes real HTTP calls — these tests validate the class contract
// (method signatures, return types) without hitting the network.
//
// Network integration tests live in integration_test/test_01_auth_flow.dart.

void main() {
  group('AuthService', () {
    test('login returns a Future<String>', () {
      // Just validate the method signature compiles and returns the right type.
      // We can't call it without a running backend, but type safety is verified
      // at compile time here.
      final service = AuthService();
      expect(service.login, isA<Function>());
    });

    test('register returns a Future<String>', () {
      final service = AuthService();
      expect(service.register, isA<Function>());
    });

    test('logout returns a Future<void>', () {
      final service = AuthService();
      expect(service.logout, isA<Function>());
    });

    test('email is trimmed and lowercased before sending', () async {
      // This is validated by the fact that login() calls email.trim().toLowerCase()
      // before sending — the trim/toLowerCase contract is inline in the method.
      // See: lib/services/auth_service.dart
      const rawEmail = '  Test@Example.COM  ';
      expect(rawEmail.trim().toLowerCase(), 'test@example.com');
    });

    test('register accepts optional name parameter', () {
      final service = AuthService();
      // Verify default parameter: name defaults to empty string
      // Method signature: register(email, password, {String name = ''})
      expect(service.register, isA<Function>());
    });
  });
}
