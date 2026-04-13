import '../core/api_client.dart';

class AuthService {
  final api = ApiClient();

  Future<String> login(String phone) async {
    final res = await api.post('/auth/login', data: {'phone': phone});
    return res.data['token'];
  }
}
