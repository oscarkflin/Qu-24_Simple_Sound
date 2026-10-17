# Qu-24 church setup and first hardware test

## Status: UI preview only

An Android demo is also available: [Galaxy S23 setup](ANDROID_SETUP.md). Its UI is bundled in the APK and needs no laptop website host. The intended future Android control path is a native direct connection; the laptop bridge below describes the web option. Both currently use sample mixer data only.

This repository does **not yet connect to or discover a mixer**. Entering an IP address validates its format only. Faders, mutes, and other controls affect sample data, not the Qu-24. There is no bridge install command or live-mode switch yet.

Sections 1–3 can be used now to prepare the church setup and review the UI. Section 4 is the acceptance checklist for a future bridge release, not instructions for a currently available feature.

## 1. Prepare the network

Use a trusted church control network, with permission from the sound/network operator:

```text
Qu-24 NETWORK port -- Ethernet -- router / network switch
                                          |
                                    host laptop
                                          |
                                Wi-Fi access point -- iPad
```

- Use the Qu-24 port labeled **Network**, not its dSNAKE port. Leave existing audio and amplifier wiring unchanged.
- Prefer wired Ethernet for the host laptop. The iPad joins the same trusted LAN over Wi-Fi.
- Record the console's existing IP address, subnet mask, network configuration, and firmware version before changing anything. Check the Qu Classic reference guide linked below for its Network settings.
- Have the network operator arrange compatible laptop/mixer addresses with no duplicates. A DHCP reservation is useful where the existing network uses DHCP; do not blindly replace the church's existing static settings.
- Example only: laptop `192.168.1.20`, mixer `192.168.1.24`, subnet mask `255.255.255.0`. These are not defaults and must not be copied into a different subnet.
- Guest Wi-Fi/client isolation may prevent device-to-device access. Do not expose the console or development website through internet port forwarding. Do not disable the entire firewall; approve only necessary local access with the network operator.

## 2. Run today's UI on the host

Install Git and Node.js 22.13 or newer on Windows or macOS. With internet access available for installation:

```sh
git clone https://github.com/oscarkflin/Qu-24_Simple_Sound.git
cd Qu-24_Simple_Sound/sound-ui
npm ci
npm run dev:logged
```

For an existing checkout, run `git pull` from its root first, preserving any local work.

Open the Local URL printed in the terminal (normally `http://localhost:3000`). On the iPad, use the **host laptop's IP**, for example `http://192.168.1.20:3000`. Do not put the mixer IP in Safari's address bar to open this app. Use the actual port printed if it differs.

Keep the host running and awake. This is a development preview without authentication, not a service-ready installation. A Mac is not required for this web UI.

## 3. Map and record the church patch

In **Quick setup**, enter display names, Qu channel numbers, and Quick mix groups, then save. Export the layout to transfer it to another browser/device. Saving this map does not patch or rename anything on the console.

The current six source rows are representative examples, not a complete 24-channel editor. Confirm actual channels rather than trusting the sample assignments. Record separately:

| Item | Record at church |
| --- | --- |
| Console | Qu-24 firmware version, IP, subnet, configured MIDI channel |
| Inputs | Each microphone/instrument, physical socket, console channel, stereo links |
| Vocal floor monitors | Actual Mix output and amplifier path |
| Piano floor monitor | Actual Mix output and amplifier path |
| Guitar/bass/drum floor monitoring | Whether shared or separate; actual Mix outputs |
| Drummer IEM | Actual Mix output, mono/stereo configuration, safe level policy |
| Livestream | Actual bus/output and downstream interface |
| Sends | Pre/post-fader configuration and shared processing implications |

Do not infer a monitor bus from the source channel number. Confirm the passive floor-speaker amplifier connections with the sound technician; the app does not manage amplifier power or speaker wiring.

## 4. Future bridge: required commissioning sequence

**Not implemented yet.** The intended path is browser → local laptop bridge → mixer. Browsers will not open the mixer TCP connection directly.

For the classic Qu-24, A&H documents TCP MIDI on port **51325**, one TCP MIDI client at a time, and Active Sensing behavior. The bridge must implement the documented session/keepalive behavior and state requests; this is not an HTTP endpoint. Coordinate with other TCP MIDI software before testing. Do not assume every official control app uses the same connection mechanism. [Qu Classic MIDI protocol](https://www.allen-heath.com/content/uploads/2023/06/Qu_MIDI_Protocol_V1.9.pdf)

Before any live-control release is used at church:

1. Schedule a non-service test with a qualified sound operator at the physical console. Back up the current show/settings using the console's supported procedure. Do not update firmware or recall scenes just to test networking.
2. Start the future bridge in read-only mode. Enter the known mixer IP manually first; optional discovery must be limited to the authorized control network. Discovery must not send gain, EQ, mute, routing, or scene changes.
3. Distinguish bridge unavailable, mixer unreachable, unsupported/protocol error, and verified connected. A ping reply or open port alone does not prove a supported Qu-24 connection.
4. Verify received console state against the physical desk. If model identity cannot be established through documented responses, require operator confirmation rather than inventing automatic identification. Confirm firmware/protocol compatibility and channel indexing.
5. Never copy demo levels or a saved UI snapshot into the console on connection. Initial synchronization must read the desk's current state.
6. With outputs safely isolated or controlled by the operator, explicitly enable one mapped test channel. Make one small fader change, confirm the physical channel and destination, then restore it. Keep gain, phantom power, EQ, routing, scene recall, and IEM adjustments out of this first test.
7. Test physical-desk changes updating the UI, disconnect/reconnect, laptop sleep, stale state, and two browser clients. A lost connection must disable live writes; reconnect must resynchronize, not replay queued adjustments.
8. Verify the physical console remains the fallback. Stopping the bridge should stop app control, not issue a blanket mute or reset. Obtain operator approval before expanding testing or using during a service.

A future release must supply real bridge installation/start instructions, access protection, explicit live-control authorization, and tested platform requirements before this checklist can be completed.

## 5. Troubleshooting and reports

| Symptom | What to check |
| --- | --- |
| Website does not open on host | Terminal errors, installed Node version, printed URL/port |
| Host works but iPad does not | Laptop IP, same LAN, host awake, firewall, Wi-Fi isolation |
| IP validates but no mixer appears | Expected today: hardware detection is not implemented |
| Future bridge cannot connect | Network settings, correct Network port, other TCP MIDI client, supported protocol |
| Future UI disagrees with desk | Stop app writes; check channel/bus mapping and state synchronization |

After a UI test, open **Quick setup → Bring the details back** and download a report. Add what you expected, what happened, approximate time, browser/device, and reproduction steps. Display names are omitted by default. Current browser reports cannot report real mixer errors.

The host also creates `sound-ui/logs/host-*.log` when started with `dev:logged`. Each run is capped at 4 MiB; old files are not automatically deleted. Share the report and relevant host log for analysis, not the entire project folder. Review notes, names, paths, and network details before sharing. No automatic upload occurs; logs are excluded from Git.

## Official references

Checked September 6, 2026. Use **Qu Classic / Qu-24** documentation, not Qu-5/6/7 or CQ protocol documents.

- [Qu-24 official resources: Reference Guide, Getting Started, firmware and MIDI protocol](https://www.allen-heath.com/hardware/qu/qu-classic/qu-24/resources/)
- [Qu-16/24/32/Pac/SB MIDI Protocol V1.9](https://www.allen-heath.com/content/uploads/2023/06/Qu_MIDI_Protocol_V1.9.pdf)

This is a project commissioning guide, not a substitute for the console manual or a trained sound operator.
