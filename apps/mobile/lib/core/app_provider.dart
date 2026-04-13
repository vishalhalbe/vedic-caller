import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';

final authProvider = Provider((ref) => AuthService());
