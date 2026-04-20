# MASTER TEST PLAN (All Personas + E2E Validation)

## Personas
1. New User
2. Returning User
3. Paying User
4. Low Balance User
5. Concurrent Users

---

## Test Cases

| Persona | Flow | Steps | Expected | Status |
|--------|------|-------|----------|--------|
| New User | Login | Enter phone → login | JWT generated | PASS |
| Returning User | Session | Open app | Auto login | PASS |
| Paying User | Add Money | Add ₹100 | Wallet updated | PASS |
| Paying User | Start Call | Start call | Timer starts | PASS |
| Paying User | End Call | End call | Correct deduction | PASS |
| Low Balance | Call attempt | Start call | Blocked | PASS |
| Concurrent | Parallel calls | Multiple calls | No corruption | PASS |
| Retry | Duplicate API | Retry request | No duplicate charge | PASS |

---

## Playwright E2E Coverage

| Flow | Result |
|------|--------|
| Login | PASS |
| Payment | PASS |
| Call Start | PASS |
| Call End | PASS |
| Wallet Update | PASS |

---

## Edge Cases

| Case | Result |
|------|--------|
| Network retry | Safe |
| Invalid token | Rejected |
| Negative balance | Prevented |

---

## Conclusion

System verified end-to-end:
- No money loss
- No duplicate transactions
- Accurate billing

Status: READY FOR PRODUCTION
