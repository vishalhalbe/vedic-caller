import 'package:flutter/material.dart';
import '../../core/api_client.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  bool _withdrawing = false;
  final _amountCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiClient().get('/astrologer/me/earnings');
      setState(() => _data = Map<String, dynamic>.from(res.data as Map));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _requestWithdrawal() async {
    final amount = double.tryParse(_amountCtrl.text.trim());
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid amount')),
      );
      return;
    }

    setState(() => _withdrawing = true);
    try {
      await ApiClient().post('/astrologer/me/withdrawal', data: {'amount': amount});
      _amountCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Withdrawal request submitted'),
            backgroundColor: Colors.green,
          ),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _withdrawing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0E1A),
        elevation: 0,
        title: const Text('Earnings',
            style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white54),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white54),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.amber))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.white54)),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: _load,
                        child: const Text('Retry',
                            style: TextStyle(color: Colors.amber)),
                      ),
                    ],
                  ),
                )
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final balance = double.tryParse(_data?['balance']?.toString() ?? '0') ?? 0;
    final calls = (_data?['recent_calls'] as List?) ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Balance card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.amber.shade800, Colors.deepPurple.shade700],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Available Balance',
                    style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 8),
                Text('₹${balance.toStringAsFixed(2)}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 36,
                        fontWeight: FontWeight.bold)),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Withdrawal form
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Request Withdrawal',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _amountCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Amount (₹)',
                    hintStyle: const TextStyle(color: Colors.white38),
                    prefixIcon:
                        const Icon(Icons.currency_rupee, color: Colors.white38),
                    filled: true,
                    fillColor: Colors.white.withOpacity(0.07),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber.shade600,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _withdrawing ? null : _requestWithdrawal,
                    child: _withdrawing
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.black))
                        : const Text('Request Payout',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          if (calls.isNotEmpty) ...[
            const Text('Recent Calls',
                style: TextStyle(
                    color: Colors.white54,
                    fontSize: 13,
                    fontWeight: FontWeight.w500)),
            const SizedBox(height: 10),
            ...calls.map((c) {
              final call = c as Map;
              final cost = double.tryParse(call['cost']?.toString() ?? '0') ?? 0;
              final dur = call['duration_seconds'] as int? ?? 0;
              final mins = dur ~/ 60;
              final secs = dur % 60;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.call, color: Colors.white38, size: 18),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '${mins}m ${secs}s',
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ),
                    Text('₹${cost.toStringAsFixed(2)}',
                        style: const TextStyle(
                            color: Colors.amber,
                            fontWeight: FontWeight.bold)),
                  ],
                ),
              );
            }),
          ] else
            const Center(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('No completed calls yet',
                    style: TextStyle(color: Colors.white38)),
              ),
            ),
        ],
      ),
    );
  }
}
