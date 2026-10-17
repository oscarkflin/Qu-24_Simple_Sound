# Android demo — Galaxy S23

The current Android build is **0.6.0-pilot**, package `com.oscarkflin.sundaysound` (launcher name Sunday Sound Demo). The interface opens offline in Demo. Direct Qu-24 TCP connection and bounded live input control are available under Settings after identity/state verification. They have passed simulated-mixer tests on the S23; the actual church desk remains unverified. Follow [the church pilot guide](QU24_CHURCH_TEST.md) for connection, limits, and issue reporting. Automatic discovery and audio balancing are not implemented.

## Enter your actual patch

Tap the settings icon → **Set up instruments & channels**. Each source has:

- **Name:** your instrument or person's name, such as Nord Stage or Worship leader.
- **Instrument / microphone:** pastor/speaker, vocal, piano, acoustic/electric guitar, bass, drums, playback/computer, or other. This lets the assistant recognize instrument requests even after you rename a source.
- **Qu channels:** enter the actual input number, comma-separated numbers for paired/grouped channels, or ST1–ST3. For example, `5, 6` for a stereo keyboard. This groups control in the app; it does not configure stereo linking on the console.
- **Role:** Speaking, Vocal, or Instrument. The instrument choice supplies a sensible role, which you can change.

Add or remove sources to match the equipment actually used. Duplicate channels, invalid numbers, and missing names are rejected. Tap **Save my patch** to save it on this phone; **Cancel** discards draft changes. Saving applies the current mode in the demo, mutes removed/unassigned inputs, and clears old Undo history so it cannot restore an obsolete patch. Existing fader levels stay with the physical channel.

Speaking opens assigned Speaking sources. Worship opens Vocal and Instrument sources. **Together** opens all three roles for prayer over music or the pastor joining worship. More voice includes both speaking and vocal roles in Together. Mute all still covers every input even if it is not assigned. Patch editing is disabled while all inputs are muted so Restore keeps an exact snapshot.

The patch is saved locally and loads on reopening the app. Browser and Android app patches are separate. Reports omit source names by default. There is no patch transfer/import screen in this simplified phone version yet.

## Install the APK on your phone

1. Copy `sound-ui/outputs/Sunday-Sound-Demo.apk` from the build computer to the S23, for example using a USB cable and the phone's file-transfer option.
2. Open the APK on the phone using My Files. If Android asks, allow that installer to install this APK. Samsung security settings may require an additional decision on your phone; installation approval must be done by you.
3. Open **Sunday Sound Demo** from the launcher. No account, laptop host, or church network is needed for this UI test.

This is a debug-signed test APK, not a Google Play release. Keep the same signing key for subsequent updates. Android Studio uses the development computer's local debug keystore; an APK from a different machine/CI may have a different key. Export your layout before uninstalling to resolve a signature mismatch, because uninstalling clears local settings.

## What to try on the S23 — simplified assistant

- Start in portrait. Choose **Speaking**, **Worship**, or **Together**; the assistant switches the assigned input mute states without changing fader levels.
- Tap **More voice** or **Less music** for a 1 dB adjustment to the active example channels. Undo restores the preceding adjustment.
- Open **Help me balance**, then try “piano too loud” or “vocals too quiet.” The app previews one small channel adjustment before applying it. These are local request rules, not an LLM or audio analysis.
- Tap **Mute all**: all 24 mono input channels, 3 stereo input channels, and 4 FX returns are muted in the model, including unused/unmapped inputs. Output masters are not moved. No other adjustment or mode switch is allowed until Restore.
- Tap **Restore sound**, then restore or keep muted. Restore uses the exact pre-mute snapshot: already-muted channels stay muted, and repeated mute requests cannot overwrite the snapshot. This is a channel operation, not just an LR speaker mute.
- Open the options icon for English/Traditional Chinese and **Share diagnostic report**. Add a note and optionally include protocol bytes. Reports include native connection/error history and best-effort Java crash logs as well as app actions.
- Turn on airplane mode and reopen the app to confirm the bundled Demo UI still opens. For real mixer control, use the church sound Wi-Fi and Settings → Qu-24 connection.

Channel assignments are behind Settings; monitor sliders and engineering tables are not on the main phone surface. The earlier full mixer prototype remains available in the browser project. Phone requests about monitor mixes, EQ, multiple conflicting sources, or currently muted sources do not trigger a level change. Speech detection needs a suitable mixer audio feed and is not enabled in this build.

The screen stays awake while this app's activity is visible. Rotation is allowed. Android Back closes a dialog where supported; otherwise it scrolls the current surface to the top. Home leaves the app normally.

The earlier full-mixer layout remains in WebView storage when updating in place; the assistant uses its own saved patch. Logs stay local; OS backup is disabled. Mixer levels, mode, and Restore snapshots are session state; patch assignments persist. The app starts in Demo. A real connection reads current console values and never initializes the console from demo values.

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

Implementation checks: Android debug compilation, standalone web bundle, TypeScript, protocol/model tests, browser interaction checks, and USB simulated-mixer control on the S23. Native report file generation, raw trace inclusion, name omission, and note redaction were checked on the phone. Actual church mixer/Wi-Fi behavior and hands-on operational comfort remain to be verified; see the pilot guide.

The dependency audit also reports advisories in the existing web/server/toolchain dependency tree. This change does not upgrade that whole stack. The Android bundle excludes the server runtime; a production release still needs dependency review and release signing.

The native Qu transport now begins with manual IP and read-only state synchronization. Enable live writes only after that succeeds. See [current connection and diagnostic instructions](QU24_CHURCH_TEST.md); the laptop bridge in the older web guide is a separate architecture.
