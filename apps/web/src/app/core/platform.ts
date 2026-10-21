import { Capacitor } from '@capacitor/core';

/** Where the app runs. An object so specs can swap `isNative` (the APK) without a WebView. */
export const platform = {
  isNative: (): boolean => Capacitor.isNativePlatform(),
};
