// LoveLink Client Configuration
// This file allows the Android app to configure the server URL at runtime.
// When running as a web app, these values are ignored (same-origin is used).

(function() {
  'use strict';

  // Default: empty string = use same-origin (works for web + localhost testing)
  // Override by setting window.LOVE_LINK_SERVER_URL before this script runs,
  // or by injecting the value from Android native code.
  const DEFAULT_SERVER_URL = '';

  window.LoveLinkConfig = {
    // Server URL for API calls. Empty string = same-origin.
    // Examples:
    //   ''                          -> web/localhost (auto)
    //   'http://192.168.1.50:3000'  -> PRIME LAN IP
    //   'http://100.x.x.x:3000'     -> Tailscale IP
    //   'https://lovelink.example.com' -> Public HTTPS domain
    serverUrl: window.LOVE_LINK_SERVER_URL || DEFAULT_SERVER_URL,

    // Build info (auto-populated by Capacitor sync)
    version: '1.0.0',
    platform: 'web', // 'web' | 'android' | 'ios'

    // Helper: resolve a relative API path to full URL
    resolve(path) {
      if (!this.serverUrl) return path;
      // Avoid double slashes
      const base = this.serverUrl.replace(/\/$/, '');
      const rel = path.replace(/^\//, '');
      return `${base}/${rel}`;
    }
  };

  // Auto-detect Capacitor/Android
  if (typeof Capacitor !== 'undefined') {
    window.LoveLinkConfig.platform = Capacitor.getPlatform();
  }
})();
