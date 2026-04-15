import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_skill/flutter_skill.dart';
import 'package:go_router/go_router.dart';
import 'core/token_storage.dart';
import 'features/auth/login_screen_v2.dart';
import 'features/home/home_screen.dart';
import 'features/astrologer/astrologer_list_screen.dart';
import 'features/call/call_screen_v2.dart';
import 'features/history/history_screen.dart';
import 'features/wallet/wallet_provider.dart';
import 'services/auth_service.dart';

/// Call from any screen to log the user out.
Future<void> logoutUser(WidgetRef ref, BuildContext context) async {
  await AuthService().logout();
  await TokenStorage().delete();
  ref.invalidate(walletProvider);
  if (context.mounted) context.go('/login');
}

final _authTokenProvider = FutureProvider<String?>((ref) async {
  return TokenStorage().get();
});

final _router = GoRouter(
  redirect: (context, state) async {
    final token = await TokenStorage().get();
    final onLogin = state.matchedLocation == '/login';
    if (token == null && !onLogin) return '/login';
    if (token != null && onLogin) return '/home';
    return null;
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
