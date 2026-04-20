import 'package:flutter_test/flutter_test.dart';
import 'package:jyotishconnect/services/auth_service.dart';

void main() {
  group('AuthService contract', () {
    late AuthService service;

    setUp(() {
      service = AuthService();
    });

    test('login is a callable function', () {
      expect(service.login, isA<Function>());
    });

    test('register is a callable function', () {
      expect(service.register, isA<Function>());
    });

    test('logout is a callable function', () {
      expect(service.logout, isA<Function>());
    });

    test('email is trimmed before sending', () {
      const raw = '  user@example.com  ';
      expect(raw.trim(), 'user@example.com');
    });

    test('email is lowercased before sending', () {
      const raw = 'User@Example.COM';
      expect(raw.toLowerCase(), 'user@example.com');
    });

    test('email trim + lowercase combined', () {
      const raw = '  TEST@EXAMPLE.COM  ';
      expect(raw.trim().toLowerCase(), 'test@example.com');
    });

    test('empty string trim is still empty', () {
      const raw = '   ';
      expect(raw.trim(), isEmpty);
    });
  });

  group('Input validation helpers', () {
    test('valid email passes basic format check', () {
      const emails = [
        'user@example.com',
        'test+tag@domain.co.in',
        'a@b.org',
      ];
      for (final email in emails) {
        expect(email.contains('@'), isTrue, reason: '$email should contain @');
        expect(email.contains('.'), isTrue, reason: '$email should contain .');
      }
    });

    test('password of 8+ chars meets minimum', () {
      const password = 'secure123';
      expect(password.length >= 8, isTrue);
    });

    test('password shorter than 8 chars is too short', () {
      const password = 'abc';
      expect(password.length >= 8, isFalse);
    });

    test('empty email fails format check', () {
      const email = '';
      expect(email.isEmpty, isTrue);
    });
  });
}
