import '../core/api_client.dart';

class CallService {
  final api = ApiClient();

  Future<Map> startCall(int userId, int astrologerId, double rate) async {
    final res = await api.post('/call/start', data: {
      'user_id': userId,
      'astrologer_id': astrologerId,
      'rate': rate
    });
    return res.data;
  }

  Future<Map> endCall(double rate, int seconds) async {
    final res = await api.post('/call/end', data: {
      'rate': rate,
      'seconds': seconds
    });
    return res.data;
  }
}
