import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'token_storage.dart';

const String _envUrl = String.fromEnvironment('API_BASE_URL');

// Android emulator uses 10.0.2.2 to reach host localhost.
// Web and desktop run on the host itself, so localhost:3000 is correct.
String get _baseUrl {
  if (_envUrl.isNotEmpty) return _envUrl;
  return kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
}

class ApiClient {
  final Dio dio = Dio(BaseOptions(
    baseUrl:        _baseUrl,
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 60),
    sendTimeout:    const Duration(seconds: 30),
  ));
  final _storage = TokenStorage();

  ApiClient() {
    // 1. Attach access token to every request
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.get();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },

      // 2. On 401 — attempt silent token refresh, then retry once
      onError: (DioException err, handler) async {
        if (err.response?.statusCode != 401) return handler.next(err);

        // Avoid infinite loop on the refresh endpoint itself
        if (err.requestOptions.path.contains('/auth/refresh')) return handler.next(err);

        final refreshToken = await _storage.getRefresh();
        if (refreshToken == null) return handler.next(err);

        try {
          final refreshRes = await Dio(BaseOptions(baseUrl: _baseUrl))
              .post('/auth/refresh', data: {'refresh_token': refreshToken});

          final newAccess  = refreshRes.data['token'] as String;
          final newRefresh = refreshRes.data['refresh_token'] as String;

          await _storage.save(newAccess);
          await _storage.saveRefresh(newRefresh);

          // Retry the original request with the new access token
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newAccess';
          final retried = await dio.fetch(opts);
          return handler.resolve(retried);
        } catch (_) {
          // Refresh failed — propagate original 401; caller routes to login
          return handler.next(err);
        }
      },
    ));
  }

  Future<Response> get(String path) => dio.get(path);
  Future<Response> post(String path, {dynamic data}) => dio.post(path, data: data);
}
