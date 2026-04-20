# Skill: Flutter UI System (JyotishConnect)

## Goal
Build and maintain a Flutter mobile app for astrology voice consulting — covering phone auth, astrologer marketplace, real-time call screen with live cost display, wallet management, and call history.

## Architecture

```
lib/
├── core/
│   ├── api_client.dart       # HTTP client (base URL, headers)
│   ├── app_provider.dart     # App-level state/DI
│   ├── theme.dart            # Global theme tokens
│   └── token_storage.dart    # Secure JWT persistence
├── features/
│   ├── auth/
│   │   └── login_screen_v2.dart    # Phone input → JWT
│   ├── home/
│   │   └── home_screen.dart        # Entry hub
│   ├── astrologer/
│   │   └── astrologer_list_screen.dart  # Browse + select
│   ├── call/
│   │   └── call_screen_v2.dart     # Live timer + cost display
│   ├── wallet/
│   │   ├── wallet_provider.dart    # Wallet state management
│   │   └── wallet_widget.dart      # Balance display widget
│   └── history/
│       └── history_screen.dart     # Past calls list
└── services/
    ├── auth_service.dart     # POST /auth/login
    ├── call_service.dart     # POST /call/start + /call/end
    ├── wallet_service.dart   # Wallet balance queries
    └── history_service.dart  # GET /callHistory
```

## Key Concepts

1. **JWT storage** — `TokenStorage` persists JWT securely; loaded on app start and attached to all API requests via `api_client.dart`.
2. **Call screen timer** — `Timer.periodic(1s)` increments `seconds` state; cost displayed as `(rate / 60) * seconds` in real-time.
3. **Service layer isolation** — Each feature has a dedicated service class; screens never call HTTP directly.
4. **Wallet provider** — `WalletProvider` holds current balance in `ChangeNotifier`; refreshed after call end and payment.
5. **Navigation pattern** — `Navigator.pushNamed` with route names; login redirects to `/home` after token save.

## Screens

### Login Screen (`login_screen_v2.dart`)
- Phone number input → `AuthService().login(phone)` → save token → navigate to `/home`
- Shows `CircularProgressIndicator` during API call

### Astrologer List Screen
- Fetches astrologers from `/astrologer`
- Displays name + `rate_per_minute`
- Taps navigate to call screen with selected rate

### Call Screen (`call_screen_v2.dart`)
```dart
// Real-time cost tracking
Timer.periodic(Duration(seconds: 1), (_) => setState(() => seconds++));
final cost = (rate / 60) * seconds;  // display only

// End call
await CallService().endCall(rate, seconds);
Navigator.pop(context);
```

### Wallet Widget
- Displays current balance
- `WalletProvider` notifies on change
- Refreshed post-call and post-payment

## Quick Start

```bash
cd apps/mobile
flutter pub get
flutter run
# For release:
flutter build apk --release
flutter build ipa
```

### Add a new screen
```dart
// 1. Create in features/<name>/<name>_screen.dart
// 2. Register route in app_provider.dart or MaterialApp routes
// 3. Add service in services/<name>_service.dart
// 4. Navigate with Navigator.pushNamed(context, '/route')
```

## Rules

- **Never embed API base URL** in screen files — use `api_client.dart`
- **Never store JWT in SharedPreferences plaintext** — use `token_storage.dart` (secure storage)
- **All async actions must handle loading state** — show `CircularProgressIndicator` during fetch
- **Call cost is display-only on client** — server recomputes on `/call/end`
- **Wallet balance always refreshed after transactions** — never trust stale state

## Pending Work (from EXECUTION_MASTER)

| Task | Priority | File |
|------|----------|------|
| JWT interceptor (auto-attach token to all requests) | High | `core/api_client.dart` |
| Call screen timer UI polish | High | `features/call/call_screen_v2.dart` |
| Wallet refresh after call end | High | `features/wallet/wallet_provider.dart` |
| Error + loading state polish | Medium | All screens |

## Outputs
- Pixel-perfect UI for all 5 core screens
- Real-time call cost display
- Secure session persistence
- Clean service/screen separation
