# Local Web App Plan

Status: web UI prototype implemented in `sound-ui/` and published to GitHub. Android/Galaxy S23 is now the immediate delivery target; see [Android setup](ANDROID_SETUP.md). This document retains the laptop-hosted web architecture for later use. Hardware integration and production hosting remain future work.

## Recommendation

Use one separate Mac or Windows laptop at church to host both the website and the Qu-24 bridge. Volunteers open the website on an iPad connected to the church sound network. The host laptop can also operate the same interface as a fallback. Preserve the iPad-oriented design in PROJECT_VISION.md, English/Traditional Chinese, service workflow, and musician-feedback suggestions.

This permits development on Windows and operation on either platform without requiring Xcode. The first deployment should be a conventional local website; installable PWA behavior can follow once local HTTPS is practical. A dedicated mini PC is optional later.

## Physical arrangement

```text
iPad Safari ── Wi-Fi ── sound router / LAN
                              ├── Ethernet ── host laptop
                              │                ├── website + browser API
                              │                ├── control rules + state
                              │                ├── Qu-24 bridge
                              │                └── local profiles + history
                              └── Ethernet ── Qu-24 ── existing audio outputs
```

Prefer wired Ethernet for the laptop and mixer; a laptop USB Ethernet adapter is sufficient in principle. The ordinary router does not host our software. Internet is not needed during service. No audio passes through the website or laptop in the initial release.

The host must be powered, awake, and connected throughout control use. Do not assume closing a Mac laptop lid keeps its service running. Initially keep the lid open, disable system sleep during operation, and avoid service-time updates. Browser sleep on the iPad must not affect the bridge heartbeat.

## Application responsibilities

| Component | Responsibility |
| --- | --- |
| iPad/browser interface | Sunday setup, service steps, friendly faders, monitor and stream controls, feedback questions |
| Local server | Serve bundled website assets and authenticated API/WebSocket connections from one origin |
| State and command coordinator | Track observed mixer values, pending commands, control ownership, change history, and validation |
| Qu adapter | Encode/decode supported MIDI messages; manage TCP connection and active sensing |
| Local storage | Church profiles, equipment, service plans, settings, and history |

Proposed implementation choices for later: React and TypeScript for the browser, Node.js and TypeScript for the local service, and SQLite for persistent records. Choose supported stable runtime versions when implementation begins. Package as one local application with one launch command first; provide a simple launcher after hardware validation. Docker and public hosting are unnecessary dependencies for the first deployment.

A generic adapter boundary should exist from the start, but build only the Qu adapter initially. State entries need freshness and provenance: observed on mixer, sent but unconfirmed, manually confirmed, stale, or unavailable. Persisted settings are not proof of the board's current settings.

## Local website and access

- Reserve stable LAN addresses for mixer and laptop, preferably through router DHCP reservations. Show the working local URL and QR code on the laptop. Manual IP entry comes before automatic discovery.
- Keep browser assets, translations, icons, and fonts bundled locally. A locally hosted website can function without Internet while the laptop is reachable.
- Ordinary HTTP on an isolated trusted LAN is an initial prototype option; it does not encrypt traffic. Use pairing/login and server-side command permissions, restrict firewall access to the sound LAN, and do not expose the mixer or app through router port forwarding.
- For regular deployment, plan trusted HTTPS on the laptop and WSS for live browser traffic. Resolve certificate trust and hostname behavior on the real iPads before relying on installation/caching. An HTTPS public page talking to an HTTP local bridge is not the baseline architecture.
- Service workers require a secure context. The localhost exception on a development computer does not make an iPad's connection to another machine's LAN address secure. Cached pages must never present disconnected mixer control as usable.
- First release: one active controlling browser; additional browsers can view state. Explicit takeover can transfer control. Broader musician permissions can follow later.

## Reliable control behavior

1. Connect without altering mixer settings. Establish which values can actually be obtained using the supported protocol.
2. Permit writes only for supported, sufficiently known parameters. Show unavailable data honestly; do not fabricate meters or sound-quality status.
3. Validate source, destination, operation, value, and permissions on the server. A browser never sends unrestricted raw mixer commands.
4. Serialize MIDI messages and preserve message boundaries logically even when TCP splits or combines reads. Coalesce slider traffic and cap command rates.
5. Distinguish a successful socket write from mixer confirmation. Use supported readback/notifications where available; otherwise label the result unconfirmed.
6. On disconnect, disable live browser controls, discard unsent actions, and reconnect with backoff. Never replay old fader movements or recall a scene merely because the connection returned.
7. Reconcile state on reconnect and browser wake. Honor physical-console changes; do not continuously force saved app values back onto the mixer.
8. Keep before/after values for reversible commands. Undo only when state is sufficiently known and no intervening adjustment would be overwritten. Multi-channel transitions can partially fail; show the partial outcome rather than claiming an atomic operation.

The manufacturer's V1.9+ protocol documents one TCP MIDI connection and active sensing. Verify actual connection behavior, Qu-Pad interaction, and any state-read limitations on the church mixer. Provide a bridge disconnect/release action for a tested Qu-Pad handoff. The physical desk remains available if the host fails; neither an iPad emergency button nor software recovery can work through a dead bridge.

## Product scope and feedback suggestions

Start with profiles, lineup, channel mapping, basic level/mute/send controls, and separate room/monitor/livestream destinations. Gain staging belongs primarily to soundcheck. No initial audio feed, autonomous EQ, LLM requirement, or separate volunteer Training Mode is planned. A developer-only mock mixer is useful for testing and reviewing screens before church visits.

Musician-feedback flow:

1. Who is reporting the problem, and which destination are they hearing?
2. Which source is affected: their voice/instrument, another source, or the entire mix?
3. What is wrong: too quiet, too loud, muddy, thin, harsh, or masked?
4. Check known routing/mute/level state and ask about placement or source controls where relevant.
5. Offer one small proposed change, explain which listeners it affects, and let the operator apply it.
6. Ask whether it improved; keep, undo, or try the next guided step.

Do not assume channel EQ affects only a requested monitor. Input processing may be shared by room, stream, and monitor sends depending on tap points; bus EQ affects everything in that bus. Establish routing and processing scope before suggesting a targeted EQ action. For shared vocal and band wedges, a request affects multiple musicians. Resolve destination-local level/balance problems first; treat subjective tone suggestions as hypotheses until the operator listens and confirms. IEM adjustments require separate conservative limits set with the responsible engineer.

Service transitions should initially be explicit, reviewed sets of mute/routing changes. App service steps are not automatically Qu scene recalls. Validate their impact across room, stream, and monitors; a channel mute can affect multiple destinations. Introduce mixer scenes only after recall scope and existing settings are understood.

## Delivery stages and exit criteria

| Stage | Work | Evidence required before advancing |
| --- | --- | --- |
| A: Requirements and screen review | Confirm terminology, sources, outputs; use a development mock for the website | Volunteer can identify destination, change, and next service action; unknown mixer data is clearly labeled |
| B: Laptop hosting | Serve website and browser channel locally; persistence, access, launch/status page | Real iPad opens app on church LAN; works with Internet disconnected; host restart and iPad wake recover correctly |
| C: Qu connection feasibility | Protocol review, adapter, active sensing, inbound parser, capability checklist | Stable physical mixer connection; verified obtainable state; console changes visible where supported; Qu-Pad handoff tested |
| D: Bounded control | One input fader, mute, and one mix send; command limits, history, undo | Readback where supported; no stale replay; cable pull, host restart, and physical-console edits handled correctly |
| E: Sunday workflow | Church profile, lineup, soundcheck, quick mix, monitors, livestream, reviewed transitions | Rehearsal succeeds with actual routing; a transition affects only intended sources/destinations |
| F: Feedback assistant | Structured musician reports, suggestion rules, scope explanations, follow-up | Operator can apply/revert a small suggestion and identify everyone it affects |
| G: Service pilot | Package launcher, operational notes, backup/export, HTTPS as needed | Supervised rehearsal and then supervised service; physical fallback and host recovery proven |

Start C in observation mode outside a live service. Hardware tests need a backed-up known-good mixer configuration and a deliberately controlled audio setup. Automated tests should focus on protocol bytes/parser fragmentation, value bounds, reconnection, stale command rejection, physical-edit conflicts, and multi-step partial failures. Test the actual iPad Safari experience; desktop browser tests alone are insufficient.

State acquisition is an early feasibility gate. If the supported interface cannot provide reliable initial values, reduce the supported controls or establish a clearly documented manual verification workflow before adding presets, broad undo, or automated transitions. Meter availability must not block a useful initial controller; guided soundcheck can refer to the console's meters.

## Details still to verify

| Detail | Why / when needed |
| --- | --- |
| Host laptop model, OS, Ethernet availability, dedicated or shared use | Before choosing launch/install packaging; prefer a separate host from playback/stream production initially |
| iPad model and OS | Before finalizing layout and HTTPS/Home Screen behavior |
| Router, sound Wi-Fi isolation, reserved addresses | Before on-site hosting test |
| Qu firmware and MIDI channel | Before protocol validation; record version rather than updating during testing |
| Actual input patching, mono/stereo sources, local vs stagebox inputs | Before mapping controls to physical sources |
| Shared band wedge versus separately listed Mix 3/4; drummer IEM assignment | Conflicting requirements remain unresolved; do not hard-code either description |
| Send tap points, pre/post-fader behavior, stereo buses, sub routing | Before destination-specific changes and tone suggestions |
| Stream routing and actual encoder feed | A mixer send marked enabled does not prove the stream is live or sounds good |
| Tested backup/restore and Qu-Pad handoff | Before write tests and service pilot |
| Initial state, notifications, meters and processing capabilities | Establish on real hardware before promising automatic state sync |

We can plan screens and build a later mock-based prototype without all church details. Actual mixer writes and service use depend on the relevant checks above.

## References checked for this plan

- [Allen & Heath Qu MIDI Protocol V1.9+](https://www.allen-heath.com/content/uploads/2023/06/Qu_MIDI_Protocol_V1.9.pdf): control messages, connection constraints, active sensing; verify behavior on installed firmware.
- [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API): browser-to-server persistent messaging, distinct from the mixer's MIDI-over-TCP protocol.
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API): secure-context requirements for optional offline web features.
# UI-first implementation update

The preview now starts in Quick setup, not Service. Map six representative sources to names, Qu channels, and Quick mix groups. Save locally or transfer via layout JSON. Admin is currently an editing mode only.

Diagnostics can be downloaded for later analysis; host logs stay local and are Git-ignored. The connection panel is demo-only: IPv4 syntax validation is available, but actual device discovery and availability checks are not implemented. A future laptop bridge must distinguish bridge unavailable, device unreachable, protocol verification failed, and verified connected; an open IP/port alone must never imply a supported Qu connection. No control writes should occur during discovery, and live operation must require explicit selection and confirmation.
