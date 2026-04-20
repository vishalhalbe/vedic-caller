import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';

// Re-export wallet so screens only import app_provider
export '../features/wallet/wallet_provider.dart';

// ── Service providers ────────────────────────────────────────
final authProvider = Provider((ref) => AuthService());

// ── Razorpay keys ────────────────────────────────────────────
// Injected at build time via --dart-define. NEVER hardcode these.
//
// Development:
//   flutter run \
//     --dart-define=RAZORPAY_KEY_ID=rzp_test_xxx \
//     --dart-define=AGORA_APP_ID=your_agora_app_id
//
// Release build:
//   flutter build apk \
//     --dart-define=RAZORPAY_KEY_ID=rzp_live_xxx \
//     --dart-define=AGORA_APP_ID=your_agora_app_id
//
// CI/CD: set RAZORPAY_KEY_ID and AGORA_APP_ID as build secrets,
// then pass --dart-define=RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID etc.

const kRazorpayKeyId = String.fromEnvironment(
  'RAZORPAY_KEY_ID',
  defaultValue: '', // empty string triggers Razorpay SDK error — intentional in unset builds
);

// ── Agora ────────────────────────────────────────────────────
// App ID is passed at build time — never hardcoded in source.
// App CERTIFICATE is server-side only (.env → AGORA_APP_CERTIFICATE).
const kAgoraAppId = String.fromEnvironment(
  'AGORA_APP_ID',
  defaultValue: '',
);
