import 'package:dio/dio.dart';
import 'token_storage.dart';

const String _baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');

class ApiClient {
  final Dio dio = Dio(BaseOptions(baseUrl: _baseUrl));

  ApiClient() {
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) async {
      final token = await TokenStorage().get();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      return handler.next(options);
    }));
  }

  Future<Response> get(String path) => dio.get(path);
  Future<Response> post(String path, {dynamic data}) => dio.post(path, data: data);
}
