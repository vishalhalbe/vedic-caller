# Skill: Call Lifecycle (JyotishConnect)

## Goal
Manage the complete lifecycle of a voice consultation — from astrologer selection through Agora channel join, real-time duration tracking, to call termination and atomic wallet billing.

## Call State Machine

```
[Idle]
   │  User selects astrologer + taps "Call"
   ▼
[Starting]  →  POST /call/start
               Returns: { channel, token }  (Agora credentials)
   │
   ▼
[Active]    →  Flutter joins Agora channel
               Client timer: Timer.periodic(1s) → seconds++
               Cost display: (rate / 60) * seconds  (display only)
   │
   │  User taps "End Call"
   ▼
[Ending]    →  Timer cancelled
               POST /call/end  (client sends rate + seconds as context)
               Server: duration = (now - startTime) / 1000
                       cost = (rate / 60) * duration
                       atomicDeduct(userId, cost)
   │
   ▼
[Completed] →  Navigator.pop(context)
               WalletProvider.refresh()
```

## Backend Implementation

### Start Call (`callLifecycle.js`)
```javascript
exports.startCall = async (userId, rate) => {
  return {
    userId,
    rate,
    startTime: Date.now(),
    status: 'ACTIVE'
  };
};
```

### End Call (`callLifecycle.js`)
```javascript
exports.endCall = async (session) => {
  const duration = Math.floor((Date.now() - session.startTime) / 1000);
  const cost = (session.rate / 60) * duration;
  await atomicDeduct(session.userId, cost);
  return { duration, cost };
};
```

### API Routes
```
POST /call/start   → { channel: 'demo-channel', token: 'demo-token' }
POST /call/end     → { duration: <seconds>, cost: <INR> }
```

## Flutter Implementation (`call_screen_v2.dart`)

```dart
class _CallScreenState extends State<CallScreen> {
  int seconds = 0;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(Duration(seconds: 1), (_) {
      setState(() => seconds++);
    });
  }

  void endCall() async {
    timer?.cancel();
    await CallService().endCall(widget.rate, seconds);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final cost = (widget.rate / 60) * seconds;  // display only
    return Scaffold(
      body: Column(
        children: [
          Text('Time: ${seconds}s'),
          Text('Cost: ₹${cost.toStringAsFixed(2)}'),
          ElevatedButton(onPressed: endCall, child: Text('End Call')),
        ],
      ),
    );
  }
}
```

## Agora Integration

Agora provides the actual voice channel. The backend generates:
- **channel** — unique room name (typically `call-{userId}-{timestamp}`)
- **token** — short-lived RTC token signed with `AGORA_APP_CERTIFICATE`

Both the caller (user) and the astrologer join the same Agora channel using these credentials.

### Environment Variables Required
```
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
```

## Key Rules

- **Server owns the clock** — `startTime = Date.now()` on `startCall`; duration computed on `endCall`
- **Client timer is display-only** — never trust client-submitted duration for billing
- **Cancel Flutter timer before `endCall`** — prevents UI updates after nav pop
- **Wallet must be checked before call starts** — prevent users with ₹0 balance from initiating
- **Call record must be saved** — `calls` table tracks `started_at`, `ended_at`, `duration_seconds`, `cost`, `status`

## Pending Work

| Task | Priority |
|------|----------|
| Pre-call balance check (block if insufficient) | High |
| Save call record to `calls` table on start + end | High |
| Astrologer availability check before start | Medium |
| Agora token generation (replace demo-token) | High |
| Handle call drop / network disconnect gracefully | Medium |

## Files

| File | Role |
|------|------|
| `backend/api/services/callLifecycle.js` | Session management |
| `backend/api/routes/call.js` | `/call/start` + `/call/end` endpoints |
| `apps/mobile/lib/features/call/call_screen_v2.dart` | Call UI + client timer |
| `apps/mobile/lib/services/call_service.dart` | Flutter API calls |

## Outputs
- Accurate call duration tracking
- Atomic wallet deduction on call end
- Real-time cost visibility for users
- Complete call audit trail in DB
