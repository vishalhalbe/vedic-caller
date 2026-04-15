import '../core/api_client.dart';

class HistoryService {
  final _api = ApiClient();

  // Server identifies the user from the JWT — no userId param needed
  Future<List<dynamic>> getHistory() async {
    final res = await _api.get('/callHistory');
    return res.data as List<dynamic>;
  }
}
