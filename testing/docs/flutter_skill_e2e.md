# JyotishConnect — flutter-skill E2E Test Scenarios

These tests are driven by Claude through the flutter-skill MCP server.
Each scenario maps directly to the 253 MCP tools available after
`flutter-skill server` is running and the app is launched in debug mode.

## Setup

```bash
# 1. Start backend
cd backend/api && node app.js

# 2. Run app in debug mode on a connected device / emulator
cd apps/mobile
flutter run --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000

# 3. flutter-skill auto-connects via FlutterSkillBinding (no extra steps)
```

Claude then uses `scan_and_connect` to attach and drives the app.

---

## Scenario 1 — Registration & Login

```
scan_and_connect
screenshot                                    # confirm login screen

# Register
tap: "Don't have an account? Register"
screenshot
smart_enter_text: name field → "Test User"
smart_enter_text: email field → "e2e@test.com"
smart_enter_text: password field → "TestPass99!"
tap: "Create account"
wait_for_element: "Astrologers"               # home screen loaded
assert_visible: "Wallet Balance"

# Logout (back to login for next scenario)
go_back

# Login with existing account
smart_enter_text: email field → "e2e@test.com"
smart_enter_text: password field → "TestPass99!"
tap: "Sign in"
wait_for_element: "Astrologers"
```

---

## Scenario 2 — Login Validation

```
scan_and_connect
screenshot

# Empty form
tap: "Sign in"
assert_visible: "Email required"

# Invalid email
smart_enter_text: email → "notanemail"
tap: "Sign in"
assert_visible: "valid email"

# Wrong password
smart_enter_text: email → "e2e@test.com"
smart_enter_text: password → "WrongPass!"
tap: "Sign in"
wait_for_element: "Incorrect email or password"
screenshot
```

---

## Scenario 3 — Wallet Top-up

```
scan_and_connect
# (assume logged in — use smart_assert to verify home)
smart_assert: "Wallet Balance is visible"

# Check initial balance
assert_visible: "₹0.00"

# Select ₹500 chip (default) and add money
assert_visible: "Add ₹500"
tap: "Add ₹500"
# Razorpay sheet opens — handled by test environment with mock payment
wait_for_element: "₹500.00"                  # balance updated after success
screenshot
```

---

## Scenario 4 — Astrologer List

```
scan_and_connect
smart_assert: "Astrologer list is visible"

# Verify available astrologers shown
assert_visible: "Online"
assert_visible: "Call"

# Verify busy astrologers show Busy badge
assert_visible: "Busy"

# Scroll list if needed
scroll_to: "Pt. Sharma"
assert_visible: "₹35/min"
screenshot
```

---

## Scenario 5 — Start & End Voice Call

```
scan_and_connect
# Ensure wallet has balance first (seed via API or run Scenario 3)

smart_assert: "Call button for online astrologer is visible"
tap: "Call"           # first online astrologer

# Connecting screen
wait_for_element: "Connecting…"
screenshot

# Wait for call to connect (Agora join)
wait_for_element: "00:00"                     # timer appeared
assert_visible: "Mute"
assert_visible: "End Call"
screenshot

# Wait 5 seconds — timer should increment
wait_for_element: "00:05"

# End call
tap: "End Call"
wait_for_element: "Astrologers"               # back on home
screenshot

# Verify balance was deducted
assert_not_visible: "₹500.00"                 # was 500, now less
```

---

## Scenario 6 — Call History

```
scan_and_connect
# Navigate to History tab
tap: "History"        # bottom nav
wait_for_idle

# Verify last call appears
assert_visible: "completed"
assert_visible: "₹"                           # cost shown
assert_visible: "Pt. Sharma"
screenshot
```

---

## Scenario 7 — Insufficient Balance Guard

```
scan_and_connect
# Assuming wallet is at ₹0 (new account or depleted)

tap: "Call"           # any online astrologer
wait_for_element: "Insufficient balance"      # snackbar or error
assert_not_visible: "Connecting…"             # call never started
screenshot
```

---

## Scenario 8 — Accessibility Audit

```
scan_and_connect
accessibility_audit                           # WCAG check on login screen
a11y_color_contrast                           # amber on dark — verify ratio
a11y_tab_order                                # keyboard nav order correct
```

---

## Running via Claude

With `flutter-skill server` in `.mcp.json`, Claude can run any scenario above
by invoking the MCP tools directly during a session:

```
"Run Scenario 5 — Start & End Voice Call on the connected emulator"
```

Claude will use `scan_and_connect`, then drive through each step,
taking screenshots at key points and asserting expected UI state.
