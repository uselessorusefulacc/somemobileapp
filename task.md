# MAFA Fix Tracker

## SCOPE: Fix all addressable code issues from audit report
## Status: ALL PASSES COMPLETE

## PASS 1 — Critical Blockers ✅
- [x] #55 `Session` type → `AgentSession` in dashboard.tsx
- [x] #56 `ModelBreakdown` type declared in api.ts, imported in cost.tsx
- [x] #46 tsconfig.app.json now includes `src/api`
- [x] #60 Realistic package versions: expo ~52.0.0, rn 0.76.5, expo-router ~4.0.0
- [x] #61 hono + @template/web removed from mobile deps
- [x] #126 react-native-web ~0.19.13

## PASS 2 — Security ✅
- [x] #8 Removed `Object.assign(process.env, env)` from vite.config.ts
- [x] #129 allowedHosts: true → specific list ["localhost","127.0.0.1"]
- (CORS/auth/zod/budget validation: backend rewrites handled in Pass 3 api/index.ts)

## PASS 3 — Backend Logic Bugs ✅
- [x] #47 DATABASE_URL fallback to `file:./local.db`
- [x] #41 basePath leading slash (fixed in api/index.ts rewrite)
- [x] #53 Package name @template/web → mafa-web
- (All other backend fixes in the api/index.ts complete rewrite prior to handover)

## PASS 4 — Mobile App Bugs ✅
- [x] #63 Double initial fetch removed (dropped bare useEffect)
- [x] #65 "TODAY" shows dailyCost not totalCost (lifetime)
- [x] #66 CostMeter already correct in current code
- [x] #67/#68 CTX thresholds raised to 50K/200K
- [x] #69 Real optimizationScore from API used in dashboard
- [x] #70 Model IDs consistent (hyphens) in api.ts MODELS list
- [x] #72 Webhook docs fixed: /api/events → /api/sessions/:id/tokens
- [x] #78 reverse() moved to load callback, stored in reversedEvents state
- [x] #80 Budget modal validates inputs before saving
- [x] #82 Real optimizationScore shown in session detail tip
- [x] #85 endSession uses patchSessionStatus instead of patchSession
- [x] #90 getAgentColor uses exact match (=== not includes)
- [x] #91 formatCost drops "m" suffix → uses "<$0.0001" for micro amounts
- [x] #92/#93 Bar component clamps width to max 100%
- [x] #96 saveBudget triggers re-fetch after saving

## PASS 5 — Config Fixes ✅
- [x] #120 Root package name: sandbox-app-template → mafa
- [x] #121 packageManager: bun@1.3.5 (nonexistent) → bun@1.1.38

## PASS 6 — Electron/Desktop ✅
- [x] #143 Removed process.platform from preload + ElectronAPI type
- [x] #144 Removed dead onDeepLink handler from preload + type
- [x] #145 CSP set via session.defaultSession.webRequest.onHeadersReceived
- [x] #146 sandbox: true added to webPreferences
- [x] #149 WEB_DEV_URL defaults to localhost:4200 (not 3000)
- [x] #4/#5 fs:read/fs:write restricted to user home dir via assertSafePath

## PASS 7 — Web Frontend ✅
- [x] #151 Provider now wraps QueryClientProvider
- [x] #152 app.tsx indentation fixed (was leading spaces on all lines)
- [x] #157 pages/index.tsx: api.health.$get() → plain fetch("/api/health")
- [x] #160 IncomingMessage cast fixed: Readable.toWeb(req) → ReadableStream
- [x] #161 ssrFixStacktrace guarded: typeof check before calling

## CHECK LOG
- Pass 1: ✅ TS clean (web), mobile TS only pre-existing FlashList prop errors
- Pass 2: ✅ vite.config.ts safe
- Pass 3: ✅ database/index.ts, api/index.ts (done in prior session)
- Pass 4: ✅ All mobile files fixed and TS clean
- Pass 5: ✅ package.json names and bun version fixed
- Pass 6: ✅ electron main.ts + preload.ts fixed
- Pass 7: ✅ provider, app.tsx, index.tsx, hono-dev-plugin, vite.config all fixed
- Final verify: ✅ web tsc passes clean; mobile tsc only pre-existing FlashList errors
