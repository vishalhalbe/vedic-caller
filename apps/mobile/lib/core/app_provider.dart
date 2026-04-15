import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';

// ── Service providers ────────────────────────────────────────
final authProvider = Provider((ref) => AuthService());

// Re-export wallet so screens only import app_provider
export '../features/wallet/wallet_provider.dart';

// ── Razorpay keys ────────────────────────────────────────────
// Key ID is a PUBLIC identifier — safe to embed in the app.
// Key SECRET never leaves the server (.env → RAZORPAY_KEY_SECRET).
//
// kDebugMode / kProfileMode are Flutter built-in constants:
//   flutter run            → kDebugMode = true   → test key used
//   flutter run --release  → kDebugMode = false  → live key used
//   flutter build apk      → kDebugMode = false  → live key used

const _kRazorpayLiveKey = 'rzp_live_ScQ6L0ZPRdL1wK';
const _kRazorpayTestKey = 'rzp_test_REPLACE_WITH_YOUR_TEST_KEY';

/// Use this constant everywhere in the app.
/// Automatically picks test key in debug builds, live key in release builds.
String get kRazorpayKeyId => kDebugMode ? _kRazorpayTestKey : _kRazorpayLiveKey;

// ── Agora ────────────────────────────────────────────────────
// App ID is a PUBLIC identifier — safe in client code.
// App CERTIFICATE is server-side only (.env → AGORA_APP_CERTIFICATE).
const kAgoraAppId = '8593844bb7454075b6f493b2d81ac34b';
