import '../core/api_client_v2.dart';

class HistoryService {
  final api = ApiClient();

  Future<List> getHistory(int userId) async {
    final res = await api.get('/callHistory/$userId');
    return res.data;
  }
}