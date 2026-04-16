import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_skill/flutter_skill.dart';
import 'package:go_router/go_router.dart';
import 'core/token_storage.dart';
import 'features/auth/login_screen_v2.dart';
import 'features/astrologer/astrologer_list_screen.dart';
import 'features/call/call_screen_v2.dart';
import 'features/history/history_screen.dart';
import 'features/wallet/wallet_provider.dart';
import 'features/admin/admin_screen.dart';
import 'services/auth_service.dart';

const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

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
      // Token string present — ApiClient's 401 interceptor handles expiry silently
      return onLogin ? '/home' : null;
    }

    // No access token — try to restore session with refresh token
    final refresh = await storage.getRefresh();
    if (refresh != null) {
      try {
        final res = await Dio(BaseOptions(baseUrl: _apiBaseUrl))
            .post('/auth/refresh', data: {'refresh_token': refresh});
        await storage.save(res.data['token'] as String);
        await storage.saveRefresh(res.data['refresh_token'] as String);
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
        );
      },
    ),
    GoRoute(
      path: '/admin',
      builder: (context, state) => const AdminScreen(),
    ),
  ],
  initialLocation: '/login',
);

void main() {
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

/// Bottom-tab shell wrapping the three main screens.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _screens = [
    AstrologerListScreen(),
    HistoryScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_index],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Astrologers'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'History'),
        ],
      ),
    );
  }
}
