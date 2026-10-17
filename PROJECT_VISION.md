# Church Sound Operator

## October 2026 implementation direction

Phone UX revision: the Android app now starts with Speaking/Worship, More voice/Less music, a request-based assistant, Undo, and a persistent Mute all/Restore control. Minimize customization; move engineering details out of the primary volunteer experience. Mute all means channel mutes across all 24 mono inputs, 3 stereo inputs, and 4 FX returns, not output-master attenuation. Restore preserves the pre-mute state of every input. The current assistant uses bounded local request rules; listening-based speech activation and balance require a real audio feed and hardware validation. The full browser mixer UI is retained for reference.

The next delivery target is an Android app tested on a Samsung Galaxy S23. Reuse the existing React interface in a Capacitor shell, with bundled assets so the UI opens offline. Support portrait setup and landscape mixing. The first APK is a sample-data demo with local channel mapping and native layout/report sharing. Future direct Qu-24 control will use a native transport; it does not require the laptop bridge used by the web architecture. iPad/web support remains a later/shared-UI option. See [Android setup](ANDROID_SETUP.md).

## Product vision

Church Sound Operator is an iPad-first assistant for church sound volunteers using an Allen & Heath Qu-24. It does not replace the mixer or attempt to make every volunteer an audio engineer. Instead, it turns technical mixer operations into a simple, safe, church-service workflow.

The Qu-24 remains the audio engine. The app is the operator intelligence and workflow layer.

## Current church reference setup

The first real-world target is the church's existing Allen & Heath Qu-24. An iPad currently uses the Allen & Heath Qu-Pad app over a dedicated local network:

`iPad → Wi-Fi router → Ethernet → Qu-24`

There are no routine scenes or presets in use during normal services today. The app therefore begins by describing and safely operating the existing manual workflow; it does not assume an established scene system is already available.

The regular inputs are pastor/speaker microphone, one to four worship vocals, keyboard, acoustic guitar, electric drums, and PC/playback/countdown. Bass, a second keyboard, electric guitar, a guest speaker, and additional inputs are occasional.

### Reference output aliases

These are the current reported assignments for the first Church Profile. They must remain editable, not hard-coded:

| Qu-24 output | Friendly destination |
| --- | --- |
| LR | Main PA / Main Speakers |
| Mix 1 | Vocal stage monitor |
| Mix 2 | Piano / keyboard monitor |
| Mix 3 | Guitar monitor |
| Mix 4 | Drum monitor |
| Mix 5-6 | IEM |
| Mix 7-8 | Subwoofer |
| Mix 9-10 | Livestream |

Before any live-control work, confirm the physical speaker and amplifier wiring behind each of these outputs. The reported shared-monitor arrangement and the exact relationship between the drum floor monitor and drummer IEM must be verified at the church.

| Traditional mixer language | Church Sound Operator language |
| --- | --- |
| CH1 / CH2 / CH3 | Pastor / Vocal / Guitar |
| Mix 1 | Vocal Monitor |
| Mix 7-8 | Subwoofer |
| Mix 9-10 | Livestream |
| PEQ / HPF / compressor | Voice clarity / warmth |
| Scenes | Worship / Sermon / Offering |

## Product principles

- Make a good, consistent Sunday mix achievable for volunteers with limited sound-engineering experience.
- Use a dark, low-clutter interface with large controls that work during a live service.
- Default to friendly source and destination names—not channel or mix numbers.
- Make connection state obvious at all times.
- Support English and Traditional Chinese from the start.
- Keep a Simple Volunteer Mode and an optional Engineer Mode.
- Use conservative presets as safe starting points, never as a claim of a perfect mix.
- Automate safe states first: mutes, routing, service transitions, and scenes.
- Do not make aggressive automatic gain, EQ, or fader changes during a service.
- Every automatic change must be reversible. Include Undo, bounded adjustments, and safe behavior when disconnected.
- Keep Qu-Pad available as an initial fallback for experienced operators.
- Treat the livestream as a separate audience. A good room mix does not automatically produce a good Mix 9-10 stream mix.
- Do not claim to detect muddiness, harshness, warmth, or balance from the iPad until the product has an approved, reliable audio-input path.

## iPad app intuition

The app should feel like an intentionally simple iPad control room: calm, obvious, and dependable under pressure. It should feel closer to Apple Home or a modern vehicle dashboard than a traditional audio console.

### Interaction model

- Designed in landscape for a booth-mounted iPad.
- Dark by default to avoid lighting up the sound booth.
- Large touch targets, readable from arm's length, with no essential control hidden behind small icons.
- One primary action per screen: start setup, continue soundcheck, advance service section, or solve a problem.
- Status is more important than technical parameters. Show `Pastor — Ready`, not `CH 1: -18 dB`.
- Use color with text and icons: green for ready, amber for attention, red for urgent problem, and gray for inactive.
- Make risky actions deliberate: confirm emergency mute, show a brief Undo banner after changes, and label live changes clearly.
- Preserve context. The current service section, mixer connection, and livestream status should be visible throughout the live-service experience.

### Navigation

Use a simple bottom navigation bar in Volunteer Mode:

| Tab | Purpose |
| --- | --- |
| **Service** | Start/setup the service and advance through the timeline. |
| **Quick Mix** | Adjust the small set of source groups that matter right now. |
| **Monitors** | Select a musician's monitor and adjust their mix. |
| **Livestream** | Adjust the independent stream mix and stream master. |
| **More** | Church setup, equipment library, history, language, and Engineer Mode. |

Keep **Something Sounds Wrong** as a persistent, clearly labeled action on the Service screen rather than burying it in navigation.

### Primary screens

#### Home / ready screen

The opening screen should answer three questions immediately: Is the mixer connected? What service is being run? What should I do next?

```text
SUNDAY SOUND                                      ⚙

QU-24  ● Connected                    Livestream ● Ready

                 Sunday Service

                    [ START ]

Last service: Aug 16       Setup Church  ›
```

#### Sunday setup

Ask questions a church volunteer can answer naturally, not mixer-configuration questions.

```text
WHO IS HERE TODAY?

Speaker
☑ Pastor                  ☐ Guest Speaker

Worship vocals            [ − ]   3   [ + ]

☑ Keyboard     ☑ Acoustic Guitar     ☑ Drums
☐ Bass         ☐ Keyboard 2          ☐ Electric Guitar

                         [ CONTINUE ]
```

The next step confirms the remembered channel assignments in a compact list, with a simple option to change an input when needed.

#### Guided soundcheck

Make soundcheck a short, linear checklist. Present one source at a time, show the friendly source name, and give the volunteer the next instruction.

```text
SOUNDCHECK                                 3 of 8

🎤 Lead Vocal
Ask the singer to sing at normal worship volume.

Level  ██████████░░░░
             In a safe range

                    [ READY ]
```

#### Live service screen

During a service, the screen should be reassuring rather than busy. It shows the current state, what is active, and the next safe transition.

```text
● LIVE                                  QU-24 ●

                    SERMON

Pastor                 ● ON
Worship Vocals         ○ MUTED
Band                   ○ MUTED
Livestream             ● ON

Next: Response Song

              [ GO TO RESPONSE ]

⚠ Something Sounds Wrong
```

#### Quick Mix

Use a small collection of large group controls. Do not expose every channel by default.

```text
WORSHIP

Lead Vocal       ────────●────
Vocals           ──────●──────
Keyboard         ────●────────
Guitar           ───●─────────
Drums            ─────●───────
Main             ───────●─────
```

#### Troubleshooting

The problem flow should use plain language and guide safe recovery.

```text
SOMETHING SOUNDS WRONG

🎤 Speaker       🎵 Worship
📺 Livestream    🎧 Monitor

Pastor too quiet
✓ Mic is unmuted
✓ Main speakers are enabled

Try a small safe increase:
       [ − ]   0.0 dB   [ + ]
                         [ Undo ]
```

## Local web implementation direction

The current direction is an iPad-friendly web interface hosted on a separate Mac or Windows laptop at church. The same laptop hosts the local mixer bridge. Native SwiftUI is a possible future client, no longer a prerequisite for the first release.

The iPad browser connects to the laptop over local Wi-Fi. The laptop communicates with the Qu-24 through MIDI-over-TCP. Serve the website and browser connection from the same local origin, with all assets available locally. The laptop must remain powered and awake throughout the service; closing the browser does not stop the mixer from processing audio. PWA installation and offline caching are later conveniences with HTTPS requirements, not prerequisites for the initial local website.

See [LOCAL_WEB_PLAN.md](LOCAL_WEB_PLAN.md) for architecture, delivery stages, validation gates, and unresolved church details. A local sample-data landscape prototype is available in [sound-ui](sound-ui/README.md); mixer integration remains unimplemented.

## Intended workflow

### One-time church setup

1. Find and connect the Qu-24.
2. Save a church profile, such as `Main Sanctuary`.
3. Give outputs friendly names:
   - LR: Main Speakers
   - Mix 1: Vocal Monitor
   - Mix 2: Piano Monitor
   - Mix 3: Guitar Monitor
   - Mix 4: Drum Monitor
   - Mix 5-6: IEM
   - Mix 7-8: Subwoofer
   - Mix 9-10: Livestream
4. Create the equipment library: pastor microphones, worship vocals, keyboard, acoustic guitar, drums, playback PC, bass, and guest speaker.

The app should read/import the Qu configuration wherever practical instead of asking a volunteer to recreate it.

### Sunday setup

The volunteer opens the app, selects who is present, and confirms the channel assignments.

- Pastor or guest speaker
- Number of worship vocalists
- Keyboard, acoustic guitar, drums, and optional musicians
- Last Sunday’s configuration is offered as the default

The target is a normal Sunday setup in under one minute.

### Soundcheck and service

The app provides a guided soundcheck for each active source, then leads the volunteer through the service timeline:

`Countdown → Worship → Offering → Worship → Sermon → Response → Outro`

Transitions should initially manage mute/unmute, routing, and safe states, while preserving live fader positions wherever possible.

## Key experiences

### Source profiles

Each source type has a conservative starting profile. For example, speech can enable a high-pass filter, use light compression, route to LR and livestream, and stay out of the subwoofer. Gain remains a guided manual adjustment until reliable analysis is available.

Profiles are available for speech, worship vocal, keyboard, acoustic guitar, bass, electric drums, and playback. They are safe starting points—not proof that the source now sounds correct.

### Quick Mix

Offer only useful controls in Volunteer Mode:

- Lead vocal
- Vocals
- Keyboard
- Guitar
- Drums
- Main level

### Monitor, subwoofer, and livestream control

Present friendly destinations rather than Qu mix-bus numbers. Treat livestream as its own audience with an independent simplified mix, not simply a copy of the room mix.

#### Current monitor layout (to confirm)

The first church profile should begin with these friendly monitor destinations:

| Destination | Users | Physical system | Control approach |
| --- | --- | --- | --- |
| Vocal Monitor | Worship vocalists | Shared floor monitor | One shared mix; adjust source levels for the vocal team. |
| Piano Monitor | Keyboard player | Floor monitor | Independent musician mix. |
| Band Monitor | Guitar, bass, and drums | Shared floor monitor | One shared mix; adjust only when it benefits the group. |
| Drum IEM | Drummer | In-ear monitor | Independent drummer mix. |

Except for the drum IEM, the current monitors are passive floor monitors powered by amplifiers. The app controls only the Qu-24 mix feeds; it must never assume it can determine or change amplifier power, speaker condition, or the physical monitor volume.

Before live-control implementation, each destination must be mapped to its actual Qu-24 Mix output(s).

### Troubleshooting

A prominent **Something Sounds Wrong** flow should guide a volunteer through safe checks and limited corrections for problems such as:

- Pastor too quiet, loud, unclear, or feeding back
- Vocals missing or instruments too loud
- Too much bass
- Livestream too quiet or unbalanced
- A musician unable to hear their monitor

V1 should guide the operator and check obvious mixer state. Later DSP can diagnose audio conditions directly.

Until audio analysis exists, subjective reports such as “muddy,” “harsh,” “not warm,” and “not clear” should trigger a small, explainable suggestion or route the user to Engineer Mode—not an unverified automatic EQ change.

## Interface levels

### Volunteer Mode

Default mode for normal operators. It focuses on Sunday Setup, Speaker, Worship, Monitors, Subwoofer, Livestream, Volume, and Mute.

### Engineer Mode

Optional advanced view with gain, HPF, PEQ, gate, compressor, pan, routing, and mix sends.

## Safety model

Normal services must not depend on cloud services, an LLM, or audio AI. Manual override must remain available.

Future intelligent actions must follow this chain:

`LLM suggestion → DSP validation → safety rules → mixer command`

Never send an LLM’s unvalidated instruction directly to the mixer.

The product architecture should keep the hardware-specific protocol separate from the rest of the app:

`UI / optional LLM intent → workflow engine → preset or DSP engine → safety & control engine → generic mixer interface → Qu-24 adapter`

The initial app must be fully usable on the church's local Wi-Fi without Internet, cloud, LLM, or DSP services.

## Current problems the product should address

- Speech and vocals that volunteers describe as unclear, dull, muddy, thin, harsh, too quiet, or too loud.
- A lead vocal being buried or an inconsistent balance as musicians change week to week.
- Inconsistent low-frequency / subwoofer balance.
- A livestream that sounds dull, thin, or poorly balanced compared with the room.
- A volunteer needing to make a safe adjustment without understanding channel numbers, buses, or EQ parameters.

## Development roadmap

### Phase 0 — Qu-24 technical proof of concept

Prove reliable control over the real mixer:

- Connect through Wi-Fi / MIDI-over-TCP
- Verify discovery/connection behavior and interaction limits with Qu-Pad
- Read available mixer state, channels, and meters where supported
- Change one fader, one mute, and one mix send safely
- Verify what basic processing parameters can be read and changed
- Handle disconnect/reconnect safely

Phase 0 is a hardware validation exercise, not a promise that the protocol exposes every desired function or meter. It must be tested on the physical church Qu-24 without disrupting a service.

### Phase 1 — Usable Sunday controller

- English and Traditional Chinese
- Church profile and equipment library
- Today’s lineup and channel assignment
- Friendly names for channels and outputs
- Simple fader/mute control
- Save and restore configuration

### Phase 2 — Guided Sunday assistant

- Source profiles and guided soundcheck
- Service timeline and worship/sermon/offering/response modes
- Monitor, subwoofer, and livestream interfaces
- Troubleshooting wizard
- Undo and history

### Phase 3 — DSP assistance

Add a practical audio-input path, then introduce level analysis, clipping detection, spectral analysis, and recommendations for gain, EQ, compression, balance, livestream, and subwoofer levels.

### Phase 4 — Smart live assistant

Detect service-time issues and recommend bounded corrections—for example, alerting when the pastor becomes quieter—while keeping the human operator in control.

### Phase 5 — LLM assistant

Accept natural-language requests such as “The pastor sounds muddy” or “Make the livestream a little fuller.” DSP and safety rules validate every recommended action.

### Phase 6 — Multi-mixer platform

Add mixer adapters for SQ, X32, and other consoles, evolving the project from a Qu-24 controller into a broader church sound platform.

## North-star workflow

`Open app → Who is here today? → Verify channels → Guided soundcheck → Ready for service → Follow timeline → Receive safe recommendations → Save today’s configuration`

Build the workflow brain first. Build the audio/AI brain second. Do not begin by recreating Qu-Pad.

## Product boundary

The key success measure is not “can the app control everything the Qu-24 can do?” Qu-Pad already serves experienced engineers who need full console control.

The measure is: **can an inexperienced church volunteer operate a normal Sunday service successfully through this interface without needing to understand the Qu-24?**
