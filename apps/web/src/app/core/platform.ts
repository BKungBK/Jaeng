import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/** Where the app runs. An object so specs can swap its members (the APK, a page reload, native storage)
 *  with `vi.spyOn`, without a WebView and without module mocks. */
export const platform = {
  isNative: (): boolean => Capacitor.isNativePlatform(),
  reload: (): void => location.reload(),
  /** Preferences survive the app being closed (SharedPreferences in the APK, localStorage on the web). */
  getPreference: async (key: string): Promise<string | null> => (await Preferences.get({ key })).value,
  setPreference: (key: string, value: string): Promise<void> => Preferences.set({ key, value }),
};
