# LoveLink Android — Runbook

Quick reference for running, building, and deploying LoveLink on Android.

---

## 1. Run the Server

### Local development

```bash
npm install
npm start
```

Server starts on `http://0.0.0.0:3000` (LAN accessible).

### With custom settings

```bash
PORT=4000 HOST=0.0.0.0 LOVE_LINK_PASSWORD='my-secret' SESSION_SECRET='strong-secret' npm start
```

### Run on PRIME (permanent host)

```bash
cd /path/to/lovelink
HOST=0.0.0.0 PORT=3000 LOVE_LINK_PASSWORD='your-password' npm start
```

Find PRIME's LAN IP:

```bash
# Linux/macOS
ip addr show | grep "inet " | head -3

# Windows
ipconfig | findstr IPv4
```

---

## 2. Open Web Version

### Same machine

```
http://localhost:3000
```

### From another device on LAN

```
http://<PRIME-LAN-IP>:3000
```

Example: `http://192.168.1.50:3000`

### From Android (web browser)

1. Connect to same WiFi as PRIME
2. Open Chrome on Android
3. Navigate to `http://<PRIME-LAN-IP>:3000`
4. Log in with password

---

## 3. Build Android App

### Prerequisites

- Android Studio installed
- JDK 17+
- Android SDK with API 34+

### Quick build path

```bash
# 1. Install dependencies
npm install

# 2. Sync web assets to Android
npm run android:sync

# 3. Build debug APK
npm run android:build

# 4. Or open in Android Studio
npm run android:open
```

### Output location

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### Manual CLI build (without Android Studio)

```bash
cd android
./gradlew assembleDebug
```

### Build release APK (signed)

1. Generate keystore (once):
```bash
cd android
keytool -genkey -v -keystore lovelink-release.keystore -alias lovelink -keyalg RSA -keysize 2048 -validity 10000
```

2. Update `capacitor.config.json`:
```json
{
  "android": {
    "buildOptions": {
      "keystorePath": "lovelink-release.keystore",
      "keystorePassword": "your-keystore-password",
      "keystoreAlias": "lovelink",
      "keystoreAliasPassword": "your-alias-password",
      "releaseType": "APK"
    }
  }
}
```

3. Build:
```bash
cd android && ./gradlew assembleRelease
```

---

## 4. Point Android App at PRIME

### Method A: Inject server URL before build

Edit `public/lovelink-config.js` and set:

```javascript
window.LOVE_LINK_SERVER_URL = 'http://192.168.1.50:3000';
```

Then rebuild:
```bash
npm run android:sync
npm run android:build
```

### Method B: Runtime configuration (recommended)

Modify `MainActivity.java` to inject the server URL at app startup:

```java
// android/app/src/main/java/com/xsytrance/lovelink/MainActivity.java
package com.xsytrance.lovelink;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Inject PRIME server URL
        bridge.setServerUrl("http://192.168.1.50:3000");
    }
}
```

> Note: Replace `192.168.1.50` with your actual PRIME LAN IP.

### Method C: In-app settings screen (future)

Add a settings UI to let Snooky enter the server URL dynamically.

---

## 5. Install on Phone/Tablet

### Via ADB (USB debugging)

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Via file transfer

1. Build APK
2. Copy `app-debug.apk` to Android device
3. Open file manager on device
4. Tap APK to install (allow unknown sources if prompted)

### Via Android Studio

1. `npm run android:open`
2. Connect device via USB (enable developer mode + USB debugging)
3. Click "Run" in Android Studio

---

## 6. Test Checklist

### Web version
- [ ] `npm start` starts without errors
- [ ] `curl http://localhost:3000/health` returns `{status: "ok"}`
- [ ] `curl http://localhost:3000/api/status` returns server stats
- [ ] Open `http://localhost:3000` in browser
- [ ] Login with password works
- [ ] Chat sends/receives
- [ ] Capture moment works

### Android app
- [ ] `npm run android:sync` completes without errors
- [ ] `npm run android:build` produces APK
- [ ] App installs on device
- [ ] App launches (shows splash screen)
- [ ] Login screen appears
- [ ] Can connect to PRIME server
- [ ] Chat works
- [ ] Video stream works (host on PRIME, viewer on Android)
- [ ] Moment capture works

---

## 7. Troubleshooting

### Camera/WebRTC not working

1. Check AndroidManifest.xml has camera permission:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

2. Ensure app requests runtime permissions on Android 6+

3. Check WebView version is up to date (Chrome 90+)

### SSE not connecting from Android

1. Verify server is bound to `0.0.0.0` (not just `localhost`)
2. Check firewall allows port 3000
3. Test with `curl http://<PRIME-IP>:3000/health` from another device
4. Ensure `LOVE_LINK_SERVER_URL` is set correctly in the app

### CORS errors

Server CORS is configured. If issues persist:
- Check `Access-Control-Allow-Origin` header is present
- Ensure `credentials: 'include'` is used in fetch requests
- For SSE, `withCredentials: true` is set

### Cannot connect to PRIME from Android

1. Verify same WiFi network
2. Check PRIME firewall: `sudo ufw allow 3000/tcp`
3. Test with `ping <PRIME-IP>` from Android terminal
4. Try Tailscale IP for off-network access

### App shows blank screen

1. Check `npm run android:sync` was run after web changes
2. Open Chrome on Android, go to `chrome://inspect`
3. Find WebView and check console for errors
4. Verify `lovelink-config.js` is loaded before `main.js`

### Build fails

```bash
# Clean and rebuild
cd android && ./gradlew clean
cd ..
npm run android:sync
npm run android:build
```

---

## 8. Network Access Matrix

| From | To | URL | Works? |
|------|-----|-----|--------|
| PC browser | Local server | `http://localhost:3000` | Yes |
| PC browser | PRIME LAN | `http://192.168.x.x:3000` | Yes |
| Android browser | PRIME LAN | `http://192.168.x.x:3000` | Yes |
| Android app (local) | Local server | `http://10.0.2.2:3000` | Emulator only |
| Android app | PRIME LAN | `http://192.168.x.x:3000` | Yes (with config) |
| Android app | Tailscale | `http://100.x.x.x:3000` | Yes (with config) |
| Android app | Public HTTPS | `https://domain.com` | Yes (with config) |

---

## 9. Known Limitations

- Server URL must be configured at build time or via native code
- No push notifications (would need Firebase + server integration)
- No background audio (app pauses when in background)
- WebRTC may need TURN server for some NAT configurations
- Base64 image data can grow large in lovelink.json over time

---

## 10. Quick Reference Commands

```bash
# Start server
npm start

# Server with custom port/password
PORT=4000 LOVE_LINK_PASSWORD='secret' npm start

# Check syntax
npm run check

# Sync web to Android
npm run android:sync

# Open Android Studio
npm run android:open

# Build debug APK
npm run android:build

# Capacitor CLI
npm run cap -- sync android
npm run cap -- open android

# Git status
git status

# View log
git log --oneline -5
```
