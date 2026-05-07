# LoveLink Android Conversion — SITREP

## Audit Date
2026-05-07

## Current Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 18+ | No framework dependencies |
| Server | Vanilla `http` module | No Express, no build step |
| Frontend | Vanilla HTML/CSS/JS | Single file each, no bundler |
| Real-time | SSE (Server-Sent Events) | `/events` endpoint |
| Streaming | WebRTC | STUN via Google, P2P after signaling |
| Auth | Cookie-based HMAC sessions | Password login, role selection |
| Storage | `lovelink.json` local file | Gitignored, auto-created |
| UI | Mobile-first CSS Grid | Single-screen, no page scroll |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/login` | Auth + session cookie |
| GET | `/api/session` | Check auth status |
| GET | `/api/moments` | List captured moments |
| POST | `/api/moments` | Capture moment (base64 image) |
| DELETE | `/api/moments/:id` | Delete moment |
| POST | `/api/moments/:id/reaction` | React to moment |
| POST | `/api/moments/:id/comment` | Comment on moment |
| POST | `/api/event` | Event bus (role, signal, chat, typing, reaction, miss-you, mood) |
| GET | `/events` | SSE stream (presence, chat, signals) |
| POST | `/api/logout` | Clear session |
| GET | `/*` | Static files from `public/` |

## WebRTC Signaling Flow

1. Viewer connects → POST `/api/event` `{type: "set-role", role: "viewer"}`
2. Host connects → POST `/api/event` `{type: "set-role", role: "host"}`
3. Viewer-ready signal triggers host to create offer
4. Offer → Answer via SSE signal events
5. ICE candidates exchanged via SSE

## What Already Works on Mobile Browser

- ✅ Mobile-first single-screen layout (no page scrolling)
- ✅ Touch swipe between Feed/Memories tabs
- ✅ `playsinline` on video elements (prevents fullscreen takeover)
- ✅ `user-scalable=no` viewport (app-like feel)
- ✅ Relative API paths (work on any host)
- ✅ Camera access via `getUserMedia` (with permissions)
- ✅ Touch targets sized appropriately
- ✅ Keyboard Enter key support on login/chat

## What Needs Native Android Support

- ❌ Server URL is hardcoded to same-origin (needs runtime config for LAN/Tailscale)
- ❌ No PWA manifest (needed for installable experience)
- ❌ No Android app wrapper (Capacitor needed)
- ❌ No server health/status endpoint
- ❌ No CORS headers (could be issue on some LAN configs)
- ❌ Server binds only to implicit host (needs explicit `0.0.0.0`)

## Android Path Decision

**Chosen: OPTION A — Capacitor Android wrapper**

Rationale:
- App is pure HTML/CSS/JS with zero dependencies → Capacitor wraps natively
- Already mobile-first → minimal UX changes needed
- No build step → Capacitor can serve `public/` directly
- WebRTC + SSE work in Android WebView (with permissions)
- Fastest path to working APK
- Preserves web version entirely

**Not chosen:**
- PWA only: Play Store distribution not possible, less native feel
- Expo/RN: Would require complete rewrite — unjustified for this stack

## Risks

| Risk | Mitigation |
|------|-----------|
| WebRTC in Android WebView | Modern WebView supports WebRTC; test with Capacitor |
| Camera permission in WebView | Capacitor handles native permission prompts |
| Hardcoded same-origin API calls | Inject configurable server URL at build/runtime |
| SSE over non-localhost | Works over LAN; ensure no proxy issues |
| Large base64 image payloads | Already handled; 640x360 JPEG at 0.74 quality |

## Blockers

**None identified.** All dependencies are available and paths are clear.

## Recommended Next Commands

```bash
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize Capacitor
npx cap init LoveLink com.xsytrance.lovelink --web-dir public

# 3. Add Android platform
npx cap add android

# 4. Sync web assets
npx cap sync

# 5. Open in Android Studio
npx cap open android
```

## Assumptions Made

1. Capacitor 6+ will be used (latest stable)
2. Android Studio or CLI build tools available for APK generation
3. PRIME runs the server on LAN with known IP
4. Target SDK: Android 14+ (API 34+)
5. Server URL config will use a simple global variable pattern
