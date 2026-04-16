import '../core/api_client.dart';

class HistoryService {
  final _api = ApiClient();

  // Returns the raw paginated response map: { data: [...], pagination: {...} }
  Future<Map<String, dynamic>> getHistoryPage({int page = 1, int limit = 20}) async {
    final res = await _api.get('/callHistory?page=$page&limit=$limit');
    return res.data as Map<String, dynamic>;
  }
}
