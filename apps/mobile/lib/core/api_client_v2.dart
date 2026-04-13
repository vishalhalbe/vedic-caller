import 'package:dio/dio.dart';
import 'token_storage.dart';

class ApiClient {
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://YOUR_PROD_URL'));

  ApiClient() {
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) async {
      final token = await TokenStorage().get();
      if (token != null) {
        options.headers['Authorization'] = token;
      }
      return handler.next(options);
    }));
  }

  Future<Response> get(String path) => dio.get(path);
  Future<Response> post(String path, {dynamic data}) => dio.post(path, data: data);
}
