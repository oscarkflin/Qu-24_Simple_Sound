# Android demo — Galaxy S23

The first Android build is **Sunday Sound Demo 0.3.0**, package `com.oscarkflin.sundaysound`. It bundles the interface inside the app and opens without a website host or Internet. All mixer controls still use sample data. Qu discovery and direct hardware control are planned, not included.

## Install the APK on your phone

1. Copy `sound-ui/outputs/Sunday-Sound-Demo.apk` from the build computer to the S23, for example using a USB cable and the phone's file-transfer option.
2. Open the APK on the phone using My Files. If Android asks, allow that installer to install this APK. Samsung security settings may require an additional decision on your phone; installation approval must be done by you.
3. Open **Sunday Sound Demo** from the launcher. No account, laptop host, or church network is needed for this UI test.

This is a debug-signed test APK, not a Google Play release. Keep the same signing key for subsequent updates. Android Studio uses the development computer's local debug keystore; an APK from a different machine/CI may have a different key. Export your layout before uninstalling to resolve a signature mismatch, because uninstalling clears local settings.

## What to try on the S23

- Start in portrait. In Quick setup, enter a display name and channel number, save, close/reopen, and check the saved layout.
- Try a repeated or out-of-range channel and confirm it is rejected.
- Open Quick mix and use the two-column faders. Rotate to landscape for a wider mixing surface; scroll to see additional strips.
- Try monitors, livestream, undo, mute confirmation, and English/Traditional Chinese.
- Export a layout. Android opens its share sheet: choose an installed app that can save or transfer the JSON. Import uses Android's file picker; select the saved layout JSON, then Save layout to apply it.
- Download a diagnostic report from **Bring the details back**. This also opens the native share sheet. Include the report when describing an issue here. Recent UI errors/actions are recorded; native Android crash traces are not automatically included.
- Turn on airplane mode and reopen the app to confirm the bundled UI still opens. IP validation remains a format check only.

The screen stays awake while this app's activity is visible. Rotation is allowed. Android Back closes a dialog where supported; otherwise it scrolls the current surface to the top. Home leaves the app normally.

Saved layouts and recent UI events are local to the app's WebView storage. Browser and app profiles are separate. Export is the transfer/backup mechanism; OS backup is disabled for this demo. Mixer fader state remains temporary sample state and resets when the UI reloads.

## Build on Windows or macOS

Install Node.js 22.13+, Android Studio with Android SDK platform 36, and a Java 21 JDK. Configure `JAVA_HOME` to that JDK for terminal builds. Let Android Studio install the required build tools and approve SDK licenses. Open `sound-ui/android` in Android Studio and let it configure the local SDK path, or create ignored `sound-ui/android/local.properties` containing your own `sdk.dir` path.

From `sound-ui`:

```sh
npm ci
npx tsc --noEmit
npm run android:apk
```

The script builds the standalone React bundle, syncs Capacitor plugins/assets, builds the debug APK, and copies it to `sound-ui/outputs/Sunday-Sound-Demo.apk`.

Other commands:

```sh
npm run dev:mobile       # phone-layout browser preview, normally port 5173
npm run build:mobile     # offline bundle only
npm run android:sync     # bundle + native asset/plugin sync
npm run android:open     # open the existing native project in Android Studio
```

Build output, SDK downloads, machine SDK paths, logs, and signing keys are excluded from Git. The APK includes bundled client assets; it does not run Vinext, Node, or Cloudflare on the phone.

## Optional USB testing

Enable Developer options and USB debugging yourself on the S23, connect by USB, and accept the phone's debugging prompt. Using Android SDK platform-tools:

```sh
adb devices
adb install -r sound-ui/outputs/Sunday-Sound-Demo.apk
adb shell am start -n com.oscarkflin.sundaysound/.MainActivity
```

Run these paths from the repository root. Android Studio's Run button is an alternative. Do not uninstall an existing build without exporting its layout first.

For native crashes, Android Studio Logcat can filter the app package. Review logs before sharing; the in-app report is usually the better first attachment for UI issues.

## Verification and remaining work

Implementation checks: Android debug compilation, standalone web bundle, TypeScript, existing mapping/redaction checks, and browser-based phone-size interaction checks. Actual S23 installation, system bars/keyboard behavior, file picker, native sharing, and suspend/resume need a physical-device test. No phone was attached during implementation.

The dependency audit also reports advisories in the existing web/server/toolchain dependency tree. This change does not upgrade that whole stack. The Android bundle excludes the server runtime; a production release still needs dependency review and release signing.

Next hardware milestone: a native Android Qu transport behind a shared adapter interface, beginning with manual IP and read-only state synchronization. The [church hardware guide](QU24_SETUP.md) still applies to console networking and commissioning, but its laptop bridge is the web architecture; the intended Android architecture can connect directly through a native module.
