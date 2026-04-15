import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';
import '../features/wallet/wallet_provider.dart';

// ── Service providers ────────────────────────────────────────
final authProvider = Provider((ref) => AuthService());

// Re-export wallet so screens only import app_provider
export '../features/wallet/wallet_provider.dart';

// ── App-level constants ──────────────────────────────────────

/// Razorpay Key ID — public identifier, safe in client code.
/// Key SECRET lives server-side only (.env → RAZORPAY_KEY_SECRET).
const kRazorpayKeyId = 'rzp_live_ScQ6L0ZPRdL1wK';

/// Agora App ID — public identifier, safe in client code.
/// App CERTIFICATE lives server-side only (.env → AGORA_APP_CERTIFICATE).
const kAgoraAppId = '8593844bb7454075b6f493b2d81ac34b';
