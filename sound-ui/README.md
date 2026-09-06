# Sunday Sound — landscape UI prototype

Interactive, local sample-data prototype for Church Sound Operator. No mixer commands, audio capture, network bridge, or GitHub publication are implemented. The host is the laptop running this project; the interface can be opened on the laptop or an iPad on the same trusted LAN.

## Run on Windows or macOS

See [Qu-24 church hardware setup](../QU24_SETUP.md) for the network layout, setup checklist, safety checks, and the distinction between this UI preview and future live control.

Install Node.js meeting the version in package.json (>=22.13), then from this folder:

```sh
npm ci
npm run dev:logged
```

Open the Local URL printed in the terminal (normally http://localhost:3000). For an iPad on the same LAN, use `http://LAPTOP_LAN_IP:3000` instead. The host must stay running and awake. Firewall rules and Wi-Fi client isolation may affect access; no firewall settings are changed automatically. Bind to localhost by omitting `--host 0.0.0.0` if only reviewing on this computer.

The development runtime is for UI review; laptop deployment packaging and the raw TCP mixer bridge come later. This starter uses React/TypeScript, Vinext/Vite, and local Cloudflare development tooling. It has not been registered or deployed to Sites. The future local raw TCP bridge must run in an ordinary Node service, outside the Worker runtime.

## Review the interface

- **Service:** current section, a representative six-section running order, room slider, and confirmed transitions that preserve source fader values.
- **Quick mix:** six sample source strips, touch/keyboard faders, individual mute controls, and a confirmed microphone-mute action.
- **Monitors:** independent sample levels for vocal, piano, shared band, and drummer IEM destinations. Actual output mapping remains unverified.
- **Livestream:** independent sample sends; no claim that a real broadcast is running.
- **Setup / Today's lineup:** select sample sources and mark manual soundcheck steps complete. Changes to the lineup affect the next service transition.
- **Musician feedback:** identify destination/source/problem, try a bounded 1 dB level adjustment, and keep or undo. Tone complaints explain the checks needed before EQ changes.
- **Undo:** restore the previous control action, including a whole fader gesture. The last 20 adjustments are retained in memory.
- **Language:** English and Traditional Chinese, including the document language used by assistive technology.

Quick setup opens first. Assign names, channel numbers, and Quick mix groups, then save. The channel map persists in this browser; export/import transfers it between devices. Mixer levels reset on refresh. Admin is only an editing mode, not authentication. The connection panel validates IP syntax only; discovery and actual connection checks await a local bridge. No network probe or mixer command is sent.

Download a browser diagnostic report from Quick setup after testing. It includes recent errors/actions and sample state, with display names excluded by default. Reports are never uploaded automatically. `dev:logged` also saves capped per-run host logs in `logs/`; review these for paths or sensitive details before sharing. Logs are excluded from Git.

The 0 dB ceiling and monitor values are illustrative UI limits, not approved live operating levels. No live meters or audio-quality claims are fabricated.

## Validation

```sh
npm run build
npx tsc --noEmit
```

The page was compiled, type-checked, and served successfully via HTTP during implementation. Real iPad Safari/touch behavior and browser visual/interaction QA remain to be reviewed. Optional page-scoped WebMCP navigation is feature-detected; supported-host contract validation has not been performed.

Suggested review: switch to Sermon and undo; drag a fader and undo; adjust the vocal monitor and verify the stream values are separate; try a musician suggestion and undo; switch to 繁中; review landscape at 1024×768 and 1194×834. Confirm dialogs can be closed using keyboard focus controls and Escape.

## GitHub later

Repository: https://github.com/oscarkflin/Qu-24_Simple_Sound. The included .gitignore excludes dependencies, builds, diagnostics, local runtime files, and environment secrets. Existing PTZController files are unrelated, untouched, and excluded.
