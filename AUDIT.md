# AgentPilot Mobile — 10-Agent Audit Report
**Date:** 2026-05-24  
**Scope:** All mobile package source files  
**Agents:** 10 independent reviewers + orchestrator synthesis

---

## Severity Legend
| Level | Meaning |
|-------|---------|
| CRITICAL | App-breaking, affects core function |
| HIGH | Significant UX break or data loss risk |
| MEDIUM | Noticeable bug or fragile code |
| LOW | Code smell, edge case, or style issue |

---

## CRITICAL (1)

### BUG-01 — Relay context: stale `null` client forever
**File:** `lib/relay-context.tsx:34`  
**Agent:** 1 (State Management)

```tsx
// BROKEN — clientRef.current captured at render, never triggers re-render
<RelayContext.Provider value={{ client: clientRef.current, ... }}>
```

`clientRef.current` is read once at render time. When `connect()` sets `clientRef.current = client`, React doesn't know — no re-render fires. Every consumer gets `client: null` indefinitely. This breaks **all relay commands** in `session/[id].tsx`.

**Fix:**
```tsx
const [client, setClient] = useState<RelayClient | null>(null);

// inside connect():
clientRef.current = newClient;
setClient(newClient);

// inside disconnect():
clientRef.current = null;
setClient(null);

// in JSX:
<RelayContext.Provider value={{ client, isConnected, connect, disconnect }}>
```

---

## HIGH (6)

### BUG-02 — Event listener leak in RelayProvider
**File:** `lib/relay-context.tsx`  
**Agent:** 1

`connect()` registers `client.on("connected", ...)` and `client.on("disconnected", ...)` but never removes them. On reconnect, old clients still fire `setIsConnected` — dead clients flip UI state. Call `clientRef.current.removeAllListeners()` before replacing the client.

---

### BUG-03 — Message queue has no TTL (stale commands fire on reconnect)
**File:** `lib/relay.ts:flushQueue`  
**Agent:** 1

A "kill" command queued offline fires when the connection restores — potentially terminating a new/unrelated session. The queue stores raw strings with no timestamp check.

**Fix:**
```ts
// Change messageQueue to store tuples:
private messageQueue: Array<{ msg: string; ts: number }> = [];

// In send():
this.messageQueue.push({ msg, ts: Date.now() });
if (this.messageQueue.length > 100) this.messageQueue.shift();

// In flushQueue():
const cutoff = Date.now() - 30_000; // discard messages older than 30s
while (this.messageQueue.length > 0) {
  const { msg, ts } = this.messageQueue.shift()!;
  if (ts > cutoff) this.ws?.send(msg);
}
```

---

### BUG-06 — White screen during font load
**File:** `app/_layout.tsx:25`  
**Agent:** 2

`if (!fontsLoaded) return null` renders a blank white screen on slow starts. Expo Router with `Slot` doesn't hold the native splash when the root layout returns null.

**Fix:**
```tsx
import * as SplashScreen from "expo-splash-screen";
SplashScreen.preventAutoHideAsync(); // call at module level

// In component:
useEffect(() => {
  if (fontsLoaded) SplashScreen.hideAsync();
}, [fontsLoaded]);

if (!fontsLoaded) return null; // splash holds while this is null
```

---

### BUG-12 — API response shape inconsistency
**File:** `lib/api.ts`  
**Agent:** 3

`getSession()` correctly unwraps `{ session: AgentSession }`. But `patchSession()` and `patchSessionStatus()` are typed as returning `AgentSession` directly. If the backend wraps these in `{ session: ... }` too, callers silently get the wrong object. Verify backend contract and align types.

---

### BUG-18 — Session detail: relay events never subscribed
**File:** `app/session/[id].tsx`  
**Agent:** 4

The screen fetches token events via REST only. `relay.ts` emits `tokens`, `status`, `tool_call`, and `output` events in real-time, but `session/[id].tsx` never calls `relay.client?.on(...)`. The `useLiveAnalytics` hook is completely unused. Users must pull-to-refresh to see any updates.

**Fix:** Subscribe in `useFocusEffect`, unsubscribe on cleanup:
```tsx
useFocusEffect(useCallback(() => {
  if (!relay.client) return;
  const onTokens = (p: TokenPayload) => { /* append to local state */ };
  const onStatus = (p: StatusPayload) => { /* update session.status */ };
  relay.client.on("tokens", onTokens);
  relay.client.on("status", onStatus);
  return () => {
    relay.client?.off("tokens", onTokens);
    relay.client?.off("status", onStatus);
  };
}, [relay.client]));
```

---

### BUG-23 — Deprecated `Clipboard` import
**File:** `app/(tabs)/connect.tsx:8`  
**Agent:** 6

```tsx
// BROKEN
import { ..., Clipboard } from "react-native";
Clipboard.setString(value);

// FIX
import * as Clipboard from "expo-clipboard";
await Clipboard.setStringAsync(value); // or fire-and-forget
```

`Clipboard` from `react-native` is deprecated since RN 0.59. Raises runtime warnings in current Expo SDK.

---

### BUG-33 — All screens: errors swallowed silently
**File:** All tab screens  
**Agent:** 8

Every `catch(e)` block only calls `console.error(e)`. On API failure, users see empty/stale data with zero feedback. On first load failure in `sessions.tsx`, users see "NO SESSIONS" — indistinguishable from actually having no sessions.

**Fix:** Add `error` state to each screen:
```tsx
const [error, setError] = useState<string | null>(null);
// in catch: setError("Failed to load. Pull to retry.");
// in render: {error && <Text style={e.errText}>{error}</Text>}
```

---

## MEDIUM (14)

| ID | File | Issue |
|----|------|-------|
| BUG-04 | relay.ts | `sendCommand` action type includes "inject"/"status" but dedicated methods bypass this — confusing API surface |
| BUG-10 | dashboard.tsx | `totalCost` is string (parsed via `parseFloat`), `dailyCost` is number — split type convention in `Analytics` type, never unified |
| BUG-13 | api.ts | `apiFetch` has no request timeout — hanging requests freeze spinners forever. Add `AbortController` with 10s limit |
| BUG-15 | sessions.tsx | API error on first load shows empty state ("NO SESSIONS") instead of error. No `error` state exists |
| BUG-16 | sessions.tsx | When `active.length === 0`, no "RECENT" section label appears — `isFirst` check fails for index 0 |
| BUG-17 | dashboard.tsx | `load(false)` sets `setRefreshing(false)` immediately before fetch — premature spinner stop. Fragile, never currently triggered |
| BUG-19 | dashboard.tsx | `router.push("/cost" as any)` — wrong path, correct is `"/(tabs)/cost"` |
| BUG-22 | tabs/_layout.tsx | Tab 1 is Sessions but app redirects to Dashboard (tab 2) — cognitive mismatch on first open |
| BUG-28 | all screens | `formatCost(-0.005)` outputs `"$-500.0μ"` — negative costs render nonsensically |
| BUG-30 | dashboard/cost | `totalTokens = 0` shows "0" not "—"; `formatTokens(42)` returns `"42"` with no unit — inconsistent |
| BUG-32 | sessions.tsx | Cost color thresholds differ: sessions use `>1` for danger, dashboard uses `>10`. Inconsistent |
| BUG-34 | session/[id].tsx | `Promise.all([getSession, getEvents])` — one failure hides all data. Use `Promise.allSettled` |
| BUG-35 | new-session.tsx | `Alert.alert("Error", String(e))` shows raw `Error: API /api → 422: ...` text |
| BUG-39 | session/[id].tsx | `events.slice().reverse()` allocates new array every render — should `useMemo` |
| BUG-40 | dashboard/cost | `modelBreakdown.sort()` mutates React state in-place — use `[...arr].sort()` |

---

## LOW (10)

| ID | File | Issue |
|----|------|-------|
| BUG-20 | new-session.tsx | `setTimeout(120)` hack after `router.dismiss()` — fragile on slow devices |
| BUG-21 | session/[id].tsx | `Array.isArray(params.id)` — dead code, expo-router `[id]` is never array |
| BUG-24 | relay.ts | Global `WebSocket` assumption — fine for Expo SDK 50+, note for bare RN |
| BUG-27 | 4 files | `formatCost()` duplicated across dashboard, cost, sessions, session detail — extract to `lib/format.ts` |
| BUG-29 | cost.tsx | `MODEL_PRICING` hardcoded — will drift when providers change pricing |
| BUG-31 | cost.tsx | `stats!.totalSessions` non-null assertion — safe but fragile |
| BUG-36 | relay.ts | `emit("error", event)` emits a DOM `Event` not an `Error` — no `.message` property |
| BUG-37 | relay.ts | JSON parse failure in `onmessage` is silently swallowed |
| BUG-41 | relay.ts | Pre-emptive: EventEmitter listener accumulation when live events are wired (BUG-18 fix needs cleanup) |
| BUG-44 | relay.ts | 30s heartbeat too long for flaky mobile connections — consider 15s |

---

## UX Gaps

| ID | Severity | Description |
|----|----------|-------------|
| GAP-01 | HIGH | `useLiveAnalytics` hook is dead code — burn rate, tips, hourly projection unused |
| GAP-02 | HIGH | Session detail is static snapshot — no live relay event subscription |
| GAP-03 | MEDIUM | PAUSE button shown even when paused (should toggle PAUSE/RESUME based on `session.status`) |
| GAP-04 | MEDIUM | Budget alerts API (`getAlerts`, `getBudget`) defined but no UI consumes them |
| GAP-05 | LOW | `RELAY_URL` / `EXPO_URL` hardcoded in connect.tsx — should come from config |
| GAP-06 | LOW | No session search or status filter |
| GAP-07 | LOW | Model not user-selectable in new-session flow despite `MODELS` constant existing |
| GAP-08 | MEDIUM | No offline banner — stale data shown silently when API unreachable |

---

## Fix Priority Order

### Do now (blocks core functionality):
1. **BUG-01** — Relay stale client → all commands broken
2. **BUG-23** — Clipboard deprecated → warnings/crash
3. **BUG-03** — Message queue TTL → stale kill commands
4. **BUG-06** — White screen on startup
5. **BUG-02** — Listener leak on reconnect

### Do next (data correctness):
6. **BUG-40** — Mutating sort on state
7. **BUG-19** — Wrong router.push path
8. **BUG-34** — Promise.all hides partial data
9. **BUG-13** — No request timeout
10. **BUG-16** — Missing "RECENT" label with no active sessions

### Do after (polish):
11. **BUG-27** — Extract `formatCost` to shared util
12. **BUG-33** — User-facing error states
13. **GAP-03** — PAUSE/RESUME toggle
14. **BUG-18 + GAP-01** — Wire relay live events + useLiveAnalytics

---

## Files Touched

| File | Issues |
|------|--------|
| `lib/relay-context.tsx` | BUG-01, BUG-02 |
| `lib/relay.ts` | BUG-03, BUG-04, BUG-36, BUG-37, BUG-41, BUG-44 |
| `app/_layout.tsx` | BUG-06 |
| `app/(tabs)/connect.tsx` | BUG-23, GAP-05 |
| `app/(tabs)/dashboard.tsx` | BUG-17, BUG-19, BUG-22, BUG-40 |
| `app/(tabs)/sessions.tsx` | BUG-15, BUG-16, BUG-32 |
| `app/(tabs)/cost.tsx` | BUG-29, BUG-31, BUG-40 |
| `app/session/[id].tsx` | BUG-18, BUG-21, BUG-34, BUG-39, GAP-02, GAP-03 |
| `app/new-session.tsx` | BUG-20, BUG-35 |
| `lib/api.ts` | BUG-12, BUG-13, BUG-14 |
| `hooks/use-live-analytics.ts` | GAP-01 |

---

*10 independent agents · 44 findings · 1 critical · 6 high · 14 medium · 10 low · 8 UX gaps*
