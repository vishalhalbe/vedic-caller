import 'package:dio/dio.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

/// Provides a Dio instance with a DioAdapter for test interception.
/// Usage:
///   final (dio, adapter) = buildMockDio();
///   adapter.onGet('/wallet/balance', ...).reply(200, { 'balance': 100.0 });
(Dio, DioAdapter) buildMockDio() {
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
  final adapter = DioAdapter(dio: dio);
  return (dio, adapter);
}

/// Preset responses for a happy-path session.
void setupHappyPath(DioAdapter adapter, {double balance = 100.0}) {
  adapter
    ..onPost('/auth/login').reply(200, {
      'token': 'eyJ.test.token',
      'user_id': 'test-user-uuid',
    })
    ..onGet('/wallet/balance').reply(200, {'balance': balance})
    ..onGet('/astrologer').reply(200, [
      {
        'id': 'astro-uuid-1',
        'name': 'Pandit Sharma',
        'rate_per_minute': 60.0,
        'is_available': true,
      }
    ])
    ..onPost('/payment/create-order').reply(200, {
      'order_id': 'order_test_123',
      'amount': 50000, // paise
      'currency': 'INR',
    })
    ..onPost('/payment/success').reply(200, {'balance': balance + 500})
    ..onPost('/call/start').reply(200, {
      'call_id': 'call-uuid-1',
      'channel': 'test-channel',
      'agora_token': 'test-agora-token',
    })
    ..onPost('/call/end').reply(200, {'success': true})
    ..onGet('/callHistory').reply(200, [
      {
        'id': 'call-uuid-1',
        'duration_seconds': 120,
        'cost': 2.0,
        'status': 'completed',
        'created_at': DateTime.now().toIso8601String(),
        'Astrologer': {'name': 'Pandit Sharma'},
      }
    ]);
}
