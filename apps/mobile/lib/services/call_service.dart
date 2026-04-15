import '../core/api_client.dart';

class CallService {
  final _api = ApiClient();

  Future<Map<String, dynamic>> startCall(String astrologerId, double rate) async {
    final res = await _api.post('/call/start', data: {
      'astrologer_id': astrologerId,
      'rate': rate,
    });
    return Map<String, dynamic>.from(res.data);
  }

  Future<Map<String, dynamic>> endCall(String? callId, double rate) async {
    final res = await _api.post('/call/end', data: {
      if (callId != null) 'call_id': callId,
      'rate': rate,
    });
    return Map<String, dynamic>.from(res.data);
  }
}
