# Qu-24 Simple Sound

Sunday Sound is a local, landscape-first web interface prototype for a church Allen & Heath Qu-24. Review it on a laptop or an iPad on the same trusted network.

**UI only: no mixer connection, discovery, audio processing, or hardware commands are implemented.**

## Start

Install Node.js 22.13 or newer, then:

```sh
cd sound-ui
npm ci
npm run dev:logged
```

Open the URL printed in the terminal. On an iPad, replace localhost with the laptop's LAN IP. Keep the laptop awake. Use only a trusted LAN; this development preview has no authentication.

## Current workflow

1. Start in Quick setup: assign display names, Qu channel numbers, and Quick mix groups.
2. Save the layout on this browser, or export/import it to transfer to another device.
3. Review sample controls in Quick mix, Monitors, Livestream, and Service.
4. Download a diagnostic report after testing and share it for analysis. Nothing uploads automatically.

Admin currently enables editing; it is not a security boundary. The connection panel validates IPv4 syntax only, and explicitly reports device availability as unknown. Detection and verified connection states require a future local bridge and testing at church.

Browser reports include recent actions/errors, version, viewport, and sample settings. Names are omitted by default. Host logs are stored under `sound-ui/logs/`, capped at 4 MiB per run, and excluded from Git. Review reports and logs for sensitive information before sharing. Host logs can include local paths and network addresses.

See [project vision](PROJECT_VISION.md), [local web plan](LOCAL_WEB_PLAN.md), and [UI details](sound-ui/README.md).
