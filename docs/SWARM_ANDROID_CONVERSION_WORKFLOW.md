# Swarm Android Conversion Workflow

A reusable, battle-tested workflow for converting web apps to Android using Capacitor.

---

## Phase 1: Repo Audit

### 1.1 Clone & Branch

```bash
git clone <repo-url> <project-name>-android
cd <project-name>-android
git checkout -b android-conversion-<agent>
```

### 1.2 Inspect These Files

| File | What to check |
|------|--------------|
| `package.json` | Dependencies, scripts, build steps |
| `server.js` / API entry | Endpoints, auth, CORS, bind address |
| `public/` or `dist/` | Static assets, entry point |
| Frontend JS | Framework (vanilla/React/Vue), API calls, WebRTC |
| `README.md` | Setup instructions, env vars |
| Mobile meta tags | viewport, theme-color, PWA tags |

### 1.3 Audit Checklist

- [ ] Identify framework (vanilla / React / Vue / etc.)
- [ ] Check if app is already mobile-responsive
- [ ] Note API endpoint paths (absolute vs relative)
- [ ] Check for hardcoded `localhost` URLs
- [ ] Identify WebRTC/Socket.io/real-time usage
- [ ] Check camera/microphone permissions flow
- [ ] Note storage mechanism (localStorage, cookies, files)
- [ ] Check authentication method (cookies, tokens, etc.)
- [ ] Identify if server bind address is configurable
- [ ] Check for CORS configuration
- [ ] List all environment variables

### 1.4 Decision: Is Capacitor the Right Choice?

Use this decision tree:

```
Is the frontend pure HTML/CSS/JS?
  Yes -> Capacitor (fastest)
  No -> Is it React/Vue/Angular with a build step?
    Yes -> Capacitor (build to static, then wrap)
    No -> Is it a complex native app?
      Yes -> Expo/React Native (full rewrite)
      No -> PWA only (no native build)
```

**Capacitor is best when:**
- Web app already works on mobile browsers
- Need Play Store distribution
- Want native app shell + web content
- WebRTC/camera/SSE already work in browser

**Expo/RN is best when:**
- Need deep native integrations
- Complex native UI patterns
- Performance is critical
- Budget for rewrite exists

**PWA only is best when:**
- No Play Store needed
- Fastest deployment
- Users can bookmark/add to home screen

---

## Phase 2: Safety & Setup

### 2.1 Safety Rules

1. Create branch BEFORE any edits
2. Do not delete original web files
3. Keep web version working independently
4. Commit in logical stages
5. Test web version after each change

### 2.2 Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 2.3 Initialize

```bash
npx cap init <AppName> <com.company.appid> --web-dir <dist-or-public>
```

### 2.4 Add Android Platform

```bash
npx cap add android
```

---

## Phase 3: Server Readiness

### 3.1 Must-Have Server Changes

| Change | Why | Priority |
|--------|-----|----------|
| Bind to `0.0.0.0` | LAN accessibility | Critical |
| Add `/health` endpoint | Health checks, monitoring | High |
| Add `/api/status` endpoint | Client diagnostics | Medium |
| CORS headers | Cross-origin from Android WebView | Critical |
| OPTIONS preflight | CORS compliance | High |

### 3.2 Server Bind Pattern

```javascript
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;
server.listen(PORT, HOST, () => {
  console.log(`Server on http://${HOST}:${PORT}`);
});
```

### 3.3 CORS Pattern

```javascript
function sendCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}
```

### 3.4 Health Endpoint Pattern

```javascript
if (pathname === '/health') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: Date.now() - startTime }));
  return;
}
```

---

## Phase 4: Client Configuration

### 4.1 Server URL Config Pattern

Create `public/<app>-config.js`:

```javascript
(function() {
  const DEFAULT_URL = ''; // empty = same-origin
  window.AppConfig = {
    serverUrl: window.APP_SERVER_URL || DEFAULT_URL,
    resolve(path) {
      if (!this.serverUrl) return path;
      const base = this.serverUrl.replace(/\/$/, '');
      const rel = path.replace(/^\//, '');
      return `${base}/${rel}`;
    }
  };
})();
```

### 4.2 Update API Calls

Replace direct paths with config resolver:

```javascript
// Before
const res = await fetch('/api/data', {...});
const es = new EventSource('/events');

// After
const url = window.AppConfig.resolve('/api/data');
const res = await fetch(url, {...});
const es = new EventSource(window.AppConfig.resolve('/events'));
```

### 4.3 PWA Manifest

Create `public/manifest.json`:

```json
{
  "name": "AppName",
  "short_name": "AppName",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF",
  "theme_color": "#FF5FA2",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 4.4 HTML Meta Tags

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#FF5FA2" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

---

## Phase 5: Mobile UX Pass

### 5.1 Checklist

- [ ] `viewport-fit=cover` for edge-to-edge display
- [ ] `user-scalable=no` to prevent pinch-zoom
- [ ] `playsinline` on video elements (prevents fullscreen takeover)
- [ ] Touch targets >= 44px (add `min-height: 44px` to buttons)
- [ ] Safe area insets for notched devices
- [ ] No horizontal scroll (check `overflow-x: hidden`)
- [ ] Keyboard doesn't break layout (use `env(keyboard-inset-height)`)
- [ ] Tab/Enter key navigation works
- [ ] Swipe gestures don't conflict with browser back

### 5.2 Safe Area CSS

```css
@supports (padding-top: env(safe-area-inset-top)) {
  .header { padding-top: env(safe-area-inset-top); }
  .footer { padding-bottom: env(safe-area-inset-bottom); }
}
```

### 5.3 Responsive Breakpoints

```css
/* Tablet */
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}

/* Desktop */
@media (min-width: 900px) {
  .app { max-width: 680px; margin: 0 auto; }
}

/* Landscape phone */
@media (max-height: 500px) and (orientation: landscape) {
  .app { grid-template-columns: 1fr 1fr; }
}
```

---

## Phase 6: Build & Test

### 6.1 Proof Checklist

```bash
# 1. Install
npm install

# 2. Syntax check
npm run check

# 3. Start server
npm start

# 4. Test health
curl http://localhost:3000/health

# 5. Test API status
curl http://localhost:3000/api/status

# 6. Open web in browser
# http://localhost:3000

# 7. Sync Capacitor
npx cap sync android

# 8. Build APK
cd android && ./gradlew assembleDebug

# 9. Check output
ls -la android/app/build/outputs/apk/debug/

# 10. Git status
git status
```

### 6.2 Common Build Errors

| Error | Fix |
|-------|-----|
| `EADDRINUSE` | Kill process on port 3000: `kill $(lsof -t -i:3000)` |
| `gradlew permission denied` | `chmod +x android/gradlew` |
| `SDK not found` | Set `ANDROID_HOME` env var |
| `JAVA_HOME not set` | `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk` |
| Web assets not updated | Run `npx cap sync android` |

---

## Phase 7: Documentation

### 7.1 Required Docs

| Document | Purpose |
|----------|---------|
| `ANDROID_CONVERSION_SITREP.md` | Audit results, decisions, risks |
| `ANDROID_RUNBOOK.md` | How to run, build, troubleshoot |
| `SWARM_ANDROID_CONVERSION_WORKFLOW.md` | Reusable process (this doc) |

### 7.2 SITREP Template

```markdown
# AppName Android Conversion — SITREP

## Date
YYYY-MM-DD

## Stack Summary
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js X+ |
| Frontend | Vanilla / React / Vue |
| Real-time | SSE / WebSocket / WebRTC |

## What Works
- [ ] Web version loads
- [ ] Android app builds
- [ ] Login works
- [ ] Core features work

## What Failed
- [ ] (document with error messages)

## Blockers
- (none / list with details)

## Next Steps
1. (action item)
```

---

## Phase 8: Commit & Deliver

### 8.1 Commit Pattern

```bash
git add -A
git commit -m "feat(android): Capacitor wrapper + server readiness

- Add Capacitor with Android platform
- Server: health endpoint, CORS, 0.0.0.0 bind
- Client: configurable server URL, PWA manifest
- Mobile UX: safe areas, touch targets, responsive
- Docs: SITREP, RUNBOOK, WORKFLOW"
```

### 8.2 Deliverables Checklist

- [ ] Working branch pushed
- [ ] `docs/ANDROID_CONVERSION_SITREP.md`
- [ ] `docs/ANDROID_RUNBOOK.md`
- [ ] `docs/SWARM_ANDROID_CONVERSION_WORKFLOW.md`
- [ ] Capacitor config and Android platform
- [ ] Server improvements (health, CORS, bind)
- [ ] Client config pattern
- [ ] PWA manifest + icons
- [ ] Final SITREP with proof

---

## Quick Reference: Decision Tree

```
START
  |
  v
Is there a web app that works on mobile browsers?
  |
  +-- YES -> Use Capacitor (wrap it)
  |           |
  |           v
  |       Does it need deep native features?
  |           |
  |           +-- YES -> Add Capacitor plugins
  |           +-- NO  -> Capacitor basic is enough
  |
  +-- NO  -> Is it worth building from scratch?
              |
              +-- YES -> Expo / React Native
              +-- NO  -> Don't build native, use PWA
```

---

## Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `LOVE_LINK_PASSWORD` | lovelink | Login password |
| `SESSION_SECRET` | lovelink-secret | Cookie signing |
| `ANDROID_HOME` | - | Android SDK path |
| `JAVA_HOME` | - | JDK path |
