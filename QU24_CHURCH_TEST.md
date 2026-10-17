# Qu-24 Android pilot: first church test and issue reports

Build: **0.7.0-pilot**, Android app package `com.oscarkflin.sundaysound` (launcher name remains Sunday Sound Demo).

The app now includes a direct Android TCP MIDI connection, a Qu Classic protocol parser, state synchronization, bounded input-fader changes, channel mute/mode changes, and readback-checked Mute all/Restore/Undo. It starts in Demo mode. Automatic audio balancing and voice detection are not implemented.

**Verification boundary:** protocol tests and a USB-only simulated mixer test on the Galaxy S23 passed. The actual church Qu-24 and church Wi-Fi have not been tested. Treat tomorrow as the first supervised hardware test, before the service, with the physical desk available throughout.

## Connect without changing the desk

1. Connect the S23 to the church sound Wi-Fi. The Qu-24 must be connected by its Network port to that same LAN. No laptop or Internet connection is needed by the Android app.
2. Confirm its firmware version. This implementation targets the classic Qu-24 with firmware 1.9 or later; do not update firmware just to try this app. You can search for the mixer from the phone; keep the desk's network-settings IP available as a fallback.
3. In the app, use Settings → Set up instruments & channels to save your actual patch while still in Demo. Confirm every channel against the desk. This does not change console patching or stereo-link settings.
4. Under Settings → Qu-24 connection, tap **Find mixer on Wi-Fi**, then tap a result to verify/read it. Alternatively enter the mixer IP and tap **Connect & read desk**. TCP MIDI uses fixed port 51325. Close other mixer apps for the first test and coordinate with other TCP MIDI clients: the manufacturer's protocol allows one such connection. Do not assume every official control app uses this same mechanism.
5. Look for the Qu-24 identity, firmware, negotiated MIDI channel, **31/31 mute states**, and **31/31 faders received**. Reading the desk does not send sample faders or mode changes. No service mode is selected on connection.
6. If state is incomplete, the wrong model answers, or the connection fails, live control stays locked. Export a report rather than trying to override the lock. Disconnect afterward to release the connection.

## First controlled write test

With the responsible sound operator at the console and outputs controlled appropriately for the test:

1. Check the saved patch once more, then tap **Enable live channel control**. Enabling alone does not move a fader or mute a channel.
2. Try one small level adjustment on a known active source. Watch the actual desk. The app expects matching readback; it does not treat a successful socket write as confirmation.
3. Try Undo. It is blocked if the observed desk values changed after that action. Live Undo currently retains one successful adjustment; demo Undo retains its previous history behavior.
4. Test Speaking, Worship, and Together only after verifying the assignments. These change mutes for configured source roles, not console scenes. In live mode, unassigned inputs and existing FX-return mutes are preserved. Muting operations are sent before unmuting operations.
5. Test **Mute all** only when the operator is ready for every input to go silent. It targets all 24 mono inputs, all 3 stereo inputs, and all 4 FX returns, including unassigned inputs. Output masters are left untouched.
6. Restore re-applies the previous input mute states, not old fader values. Already-muted channels stay muted. If someone reopens an input at the desk after Mute all, the app blocks Restore; reconcile it at the desk instead of overwriting that change.

Fader messages use the manufacturer's discrete, non-linear MIDI scale. The assistant's nominal 1 dB change is quantized using the published reference points. This pilot only adjusts faders whose observed positions are within −45 to 0 dB. Faders at minus infinity, below that supported band, or above 0 dB need a desk adjustment first. No preamp gain, phantom power, EQ, routing, scene, output-master, or shutdown commands are sent.

If a batch partially completes or a confirmation is missing, the app reports the confirmed count, pauses writes, and requires a new connection/state read. Some commands may already have changed the desk. Inspect the console before continuing. There is no automatic reconnect or replay of pending actions.

Leaving the app, locking the phone, opening Android's share sheet, or losing the connection pauses mixer control. Reconnect and read the current desk before enabling control again. An interrupted Restore snapshot is not carried into a new session; use the desk to reconcile it. Returning to Demo sends no corrective mixer changes.

## Bring an issue back for analysis

1. Open **Settings** after the problem. Enter what you tried, what happened, and approximately when in **What went wrong?**
2. For connection/protocol issues, tick **Include protocol byte trace**.
3. Tap **Share diagnostic report**, then save or transfer the JSON using Android's share sheet. Bring that JSON back to this chat. Sharing disconnects a current mixer connection; plan this after the test, not while depending on app control.
4. A photo of the relevant desk screen and the firmware version are useful additions. Do not uninstall or clear app data before exporting.

The report contains build/device information, connection phase, identity and synchronization coverage, raw observed fader codes/mutes, patch channel/type assignments, recent UI errors/actions, attempted targets, confirmations, timeouts, and native transport/error history. Custom source names are omitted. Notes are scrubbed for common addresses/secrets. Optional raw protocol bytes may still encode console labels or other data; review before sharing. No audio is recorded and no automatic upload occurs.

Retention: up to 2,000 recent app events in local storage, plus two native JSON-line trace files of approximately 1 MiB each in private app storage. Native logs survive app restarts and ordinary in-place updates. Old native logs rotate out. Java uncaught crashes are recorded on a best-effort basis; OS kills, native C/C++ faults, and ANRs are not guaranteed to appear. If the app cannot start, keep it installed and bring the phone back over USB so the private logs can be extracted from this debug build.

## Protocol and test evidence

Implementation follows the [official Qu Classic MIDI Protocol V1.9+ ISS.2](https://www.allen-heath.com/content/uploads/2023/06/Qu_MIDI_Protocol_V1.9.pdf), particularly input addressing, audio-core mutes/faders, system-state request/identity/end-sync, and active sensing. It uses the negotiated audio-core MIDI channel, not the separate DAW-strip channel. It does not identify itself as Qu-Pad.

```sh
cd sound-ui
node --experimental-strip-types scripts/check-qu.mjs
node --experimental-strip-types scripts/check-assistant.mjs
npx tsc --noEmit
npm run android:apk
```

Tests cover exact byte vectors, fragmented/running-status MIDI, interleaved active sensing, complete-state gating, no writes on connect, confirmed changes, all-input mute coverage, restore without fader writes, stale Undo, missing readback, incomplete state, and wrong-model rejection. The on-phone USB simulator additionally exercised the Android socket, heartbeat, native packet whitelist, end-to-end control/confirmation, disconnect handling, and native JSON report export. A simulator cannot verify the real mixer's firmware-specific behavior, actual audio routing, or Wi-Fi reliability.
## Find mixer on Wi-Fi (Android 0.7.0)

In Settings → Qu-24 connection, tap **Find mixer on Wi-Fi**. Connect the phone to the church router's Wi-Fi and connect that router to the Qu-24 network port. Internet access is not needed. Close Qu-Pad and other MIDI-control apps before searching.

The search briefly checks TCP port 51325 on up to 254 addresses on the phone's actual Wi-Fi network (not cellular or VPN). It sends no MIDI commands. Results are **possible mixers**, not confirmed Qu-24s: tap a result to run the existing identity/state checks. Live control still requires its separate enable button. Finding a device never applies a mode, fader or mute.

This is bounded local port discovery, **not a reproduction of Qu-Pad's proprietary UDP discovery**. A&H confirms that app discovery is non-public: https://forums.allen-heath.com/t/scene-selection-for-anyone-via-midi-commands/32804/7 . Open ports on other devices can appear; the subsequent connection must identify a supported Qu-24 before controls unlock.

Allow about 10 seconds. On networks wider than /24, only the phone's containing /24 is searched; the UI warns about this. Use manual IP for mixers elsewhere on the same routed network. Wi-Fi client isolation, a busy control port, firewall rules, or a different subnet may prevent discovery. Empty results do not prove the mixer is offline. Search cancellation on leaving the app and result/error counts are captured in the shareable diagnostics; standard logs omit IP addresses.
