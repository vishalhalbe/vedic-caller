import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jyotishconnect/features/history/history_screen.dart';
import 'package:jyotishconnect/features/history/history_screen.dart'
    show historyProvider;

final _fakeHistory = [
  {
    'id': 'call-1',
    'duration_seconds': 120,
    'cost': 2.0,
    'status': 'completed',
    'created_at': '2026-04-15T10:00:00Z',
    'Astrologer': {'name': 'Pandit Sharma'},
  },
  {
    'id': 'call-2',
    'duration_seconds': 300,
    'cost': 5.0,
    'status': 'completed',
    'created_at': '2026-04-14T14:30:00Z',
    'Astrologer': {'name': 'Jyotish Gupta'},
  },
];

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('HistoryScreen', () {
    Widget buildScreen({List<dynamic> history = const []}) {
      return ProviderScope(
        overrides: [
          historyProvider.overrideWith((ref) async => history),
        ],
        child: const MaterialApp(
          home: HistoryScreen(),
        ),
      );
    }

    testWidgets('shows loading indicator initially', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          historyProvider.overrideWith(
            (ref) async {
              await Future.delayed(const Duration(seconds: 1));
              return _fakeHistory;
            },
          ),
        ],
        child: const MaterialApp(home: HistoryScreen()),
      ));
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows empty state when history is empty', (tester) async {
      await tester.pumpWidget(buildScreen(history: []));
      await tester.pumpAndSettle();

      expect(find.textContaining(RegExp(r'no calls|empty|history', caseSensitive: false)), findsOneWidget);
    });

    testWidgets('renders call history items', (tester) async {
      await tester.pumpWidget(buildScreen(history: _fakeHistory));
      await tester.pumpAndSettle();

      expect(find.text('Pandit Sharma'), findsOneWidget);
      expect(find.text('Jyotish Gupta'), findsOneWidget);
    });

    testWidgets('shows duration and cost for each call', (tester) async {
      await tester.pumpWidget(buildScreen(history: _fakeHistory));
      await tester.pumpAndSettle();

      // 120 seconds = 2 min
      expect(find.textContaining('2'), findsAtLeast(1));
      // Cost ₹2.00
      expect(find.textContaining('₹2'), findsAtLeast(1));
    });

    testWidgets('shows completed status badge', (tester) async {
      await tester.pumpWidget(buildScreen(history: _fakeHistory));
      await tester.pumpAndSettle();

      expect(find.text('completed'), findsAtLeast(1));
    });
  });
}
