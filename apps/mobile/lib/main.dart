import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_skill/flutter_skill.dart';
import 'package:go_router/go_router.dart';
import 'core/api_client.dart';
import 'core/token_storage.dart';
import 'features/auth/login_screen_v2.dart';
import 'features/astrologer/astrologer_list_screen.dart';
import 'features/astrologer/astrologer_dashboard_screen.dart';
import 'features/astrologer/astrologer_profile_screen.dart';
import 'features/astrologer/earnings_screen.dart';
import 'features/wallet/wallet_topup_screen.dart';
import 'features/call/call_screen_v2.dart';
import 'features/history/history_screen.dart';
import 'features/wallet/wallet_provider.dart';
import 'features/admin/admin_screen.dart';
import 'services/auth_service.dart';

/// Shared ApiClient used in router redirect — ensures interceptor chain is consistent.
final _routerApiClient = ApiClient();

/// Call from any screen to log the user out.
Future<void> logoutUser(WidgetRef ref, BuildContext context) async {
  final storage      = TokenStorage();
  final refreshToken = await storage.getRefresh();
  await AuthService().logout(refreshToken: refreshToken);
  await storage.deleteAll();
  ref.invalidate(walletProvider);
  if (context.mounted) context.go('/login');
}

final _router = GoRouter(
  redirect: (context, state) async {
    final storage  = TokenStorage();
    final onLogin  = state.matchedLocation == '/login';
    final access   = await storage.get();

    if (access != null) {
      if (!onLogin) return null;
      final role = await storage.getRole();
      return role == 'astrologer' ? '/astrologer/dashboard' : '/home';
    }

    // No access token — try to restore session with refresh token
    final refresh = await storage.getRefresh();
    if (refresh != null) {
      try {
        final res = await _routerApiClient.post(
            '/auth/refresh', data: {'refresh_token': refresh});
        final body = res.data as Map<String, dynamic>;
        await storage.save(body['token'] as String);
        await storage.saveRefresh(body['refresh_token'] as String);
        return onLogin ? '/home' : null;
      } catch (_) {
        // Refresh token invalid/expired — clear and force login
        await storage.deleteAll();
      }
    }

    return onLogin ? null : '/login';
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const MainShell(),
    ),
    GoRoute(
      path: '/call',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>;
        return CallScreen(
          astrologerId: extra['astrologer_id'] as String,
          astrologerName: extra['name'] as String,
          rate: (extra['rate'] as num).toDouble(),
          prebuiltChannel: extra['channel'] as String?,
          prebuiltToken: extra['token'] as String?,
          prebuiltCallId: extra['call_id'] as String?,
          isAstrologer: extra['role'] == 'astrologer',
        );
      },
    ),
    GoRoute(
      path: '/astrologer/:id',
      builder: (context, state) => AstrologerProfileScreen(
        astrologerId: state.pathParameters['id']!,
      ),
    ),
    GoRoute(
      path: '/wallet',
      builder: (context, state) => const WalletTopUpScreen(),
    ),
    GoRoute(
      path: '/admin',
      builder: (context, state) => const AdminScreen(),
    ),
    GoRoute(
      path: '/astrologer/dashboard',
      builder: (context, state) => const AstrologerDashboardScreen(),
    ),
    GoRoute(
      path: '/astrologer/earnings',
      builder: (context, state) => const EarningsScreen(),
    ),
  ],
  initialLocation: '/login',
);

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    if (kReleaseMode) {
      // TODO(ops): forward to crash reporting (Sentry / Firebase Crashlytics)
      debugPrint('[fatal] ${details.exceptionAsString()}');
    }
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[unhandled] $error\n$stack');
    return true;
  };

  // flutter-skill: gives AI agents live eyes & hands inside the app (debug only)
  if (kDebugMode) FlutterSkillBinding.ensureInitialized();
  runApp(const ProviderScope(child: JyotishApp()));
}

class JyotishApp extends StatelessWidget {
  const JyotishApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'JyotishConnect',
      theme: ThemeData.dark().copyWith(
        colorScheme: ColorScheme.dark(
          primary: Colors.amber.shade600,
          secondary: Colors.deepPurple,
        ),
      ),
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}

/// Bottom-tab shell wrapping the main screens.
/// Admin users see an extra Admin tab loaded from secure storage.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int  _index   = 0;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    TokenStorage().getIsAdmin().then((v) {
      if (mounted) setState(() => _isAdmin = v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      const AstrologerListScreen(),
      const HistoryScreen(),
      if (_isAdmin) const AdminScreen(),
    ];

    return Scaffold(
      body: screens[_index.clamp(0, screens.length - 1)],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index.clamp(0, screens.length - 1),
        onTap: (i) => setState(() => _index = i),
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.people),  label: 'Astrologers'),
          const BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
          if (_isAdmin)
            const BottomNavigationBarItem(icon: Icon(Icons.admin_panel_settings), label: 'Admin'),
        ],
      ),
    );
  }
}
