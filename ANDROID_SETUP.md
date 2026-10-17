# Android demo — Galaxy S23

The current Android build is **Sunday Sound Demo 0.4.0**, package `com.oscarkflin.sundaysound`. It bundles a simplified assistant interface inside the app and opens without a website host or Internet. All mixer controls still use sample data. Qu discovery and direct hardware control are planned, not included.

## Install the APK on your phone

1. Copy `sound-ui/outputs/Sunday-Sound-Demo.apk` from the build computer to the S23, for example using a USB cable and the phone's file-transfer option.
2. Open the APK on the phone using My Files. If Android asks, allow that installer to install this APK. Samsung security settings may require an additional decision on your phone; installation approval must be done by you.
3. Open **Sunday Sound Demo** from the launcher. No account, laptop host, or church network is needed for this UI test.

This is a debug-signed test APK, not a Google Play release. Keep the same signing key for subsequent updates. Android Studio uses the development computer's local debug keystore; an APK from a different machine/CI may have a different key. Export your layout before uninstalling to resolve a signature mismatch, because uninstalling clears local settings.

## What to try on the S23 — simplified assistant

- Start in portrait. Choose **Speaking** or **Worship**; the assistant switches the example input mute states without changing fader levels.
- Tap **More voice** or **Less music** for a 1 dB adjustment to the active example channels. Undo restores the preceding adjustment.
- Open **Help me balance**, then try “piano too loud” or “vocals too quiet.” The app previews one small channel adjustment before applying it. These are local request rules, not an LLM or audio analysis.
- Tap **Mute all**: all 24 mono input channels, 3 stereo input channels, and 4 FX returns are muted in the model, including unused/unmapped inputs. Output masters are not moved. No other adjustment or mode switch is allowed until Restore.
- Tap **Restore sound**, then restore or keep muted. Restore uses the exact pre-mute snapshot: already-muted channels stay muted, and repeated mute requests cannot overwrite the snapshot. This is a channel operation, not just an LR speaker mute.
- Open the options icon for English/Traditional Chinese and **Share diagnostic report**. Android opens its share sheet. The report includes all modeled input states and recent actions; native Android crash traces are not automatically included.
- Turn on airplane mode and reopen the app to confirm the bundled UI still opens. This version has no mixer connection or IP setup screen.

Channel maps, monitor sliders, and setup tables are no longer on the phone's main surface. The earlier full mixer prototype remains available in the browser project. Phone requests about monitor mixes, EQ, multiple conflicting sources, or currently muted sources do not trigger a level change. Speech detection needs a suitable mixer audio feed and is not enabled in this build.

The screen stays awake while this app's activity is visible. Rotation is allowed. Android Back closes a dialog where supported; otherwise it scrolls the current surface to the top. Home leaves the app normally.

The earlier saved layout remains in the app's WebView storage when updating in place, but the simplified phone demo uses a fixed example patch and does not edit that layout. Recent UI events remain local; OS backup is disabled. Mixer state and the Restore snapshot are temporary demo state and reset when the UI reloads. A future live app must read current console state on startup rather than initialize the console from these demo values.

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

Implementation checks: Android debug compilation, standalone web bundle, TypeScript, mute/restore/suggestion model checks, and browser-based phone-size interaction checks. Version 0.4.0 was installed and launched over USB on the connected Galaxy S23. Native sharing, suspend/resume, and hands-on comfort still need user review.

The dependency audit also reports advisories in the existing web/server/toolchain dependency tree. This change does not upgrade that whole stack. The Android bundle excludes the server runtime; a production release still needs dependency review and release signing.

Next hardware milestone: a native Android Qu transport behind a shared adapter interface, beginning with manual IP and read-only state synchronization. The [church hardware guide](QU24_SETUP.md) still applies to console networking and commissioning, but its laptop bridge is the web architecture; the intended Android architecture can connect directly through a native module.
