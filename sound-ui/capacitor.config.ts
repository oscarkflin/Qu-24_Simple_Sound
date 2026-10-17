import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.oscarkflin.sundaysound',
  appName: 'Sunday Sound Demo',
  webDir: 'dist-mobile',
  android: { allowMixedContent: false, backgroundColor: '#14191c' },
};
export default config;
