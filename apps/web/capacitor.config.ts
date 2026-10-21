import type { CapacitorConfig } from '@capacitor/cli';

// The APK (plan 7, spec 8.4) ships the web build in `www-android` and talks to the server the reader
// sets in the app. The page is served from http://localhost inside the WebView, and the server is plain
// http in the LAN, so both the scheme and cleartext traffic are allowed.
const config: CapacitorConfig = {
  appId: 'th.jaeng.app',
  appName: 'แจ้ง',
  webDir: 'www-android',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    // Android 15+ draws edge to edge; the app reads the bar sizes from the safe-area CSS variables
    SystemBars: { insetsHandling: 'css' },
  },
};

export default config;
