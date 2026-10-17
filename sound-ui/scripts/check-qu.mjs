import assert from 'node:assert/strict';
import {
  address,
  QuParser,
  QU_IDS,
  stateRequest,
  muteBytes,
  faderBytes,
  rawDb,
  adjustedRaw,
  decodeQu24Meters,
  meterRequest,
} from '../lib/qu-protocol.ts';
import { meterFixture } from './qu-meter-fixtures.mjs';
import { AutoBalance } from '../lib/auto-balance.ts';
import { QuSession } from '../lib/qu-session.ts';
import { initialMix, examplePatch } from '../lib/assistant-model.ts';
assert.equal(address('ch1'), 0x20);
assert.equal(address('ch24'), 0x37);
assert.equal(address('st3'), 0x42);
assert.equal(address('fx4'), 0x0b);
assert.throws(() => address('ch25'));
assert.deepEqual(muteBytes('ch1', true, 3), [0x93, 0x20, 127, 0x93, 0x20, 0]);
assert.deepEqual(muteBytes('st3', false, 0), [0x90, 0x42, 63, 0x90, 0x42, 0]);
assert.deepEqual(
  faderBytes('ch24', 98, 15),
  [191, 99, 55, 191, 98, 23, 191, 6, 98, 191, 38, 7],
);
assert.equal(rawDb(98), 0);
assert.equal(rawDb(63), -10);
assert.equal(rawDb(0), null);
assert.throws(() => adjustedRaw(0, 1));
assert.throws(() => adjustedRaw(114, 1));
const identity = (n = 3, model = 2) => [
  240,
  0,
  0,
  26,
  80,
  17,
  1,
  0,
  n,
  17,
  model,
  1,
  99,
  247,
];
const end = (n) => [240, 0, 0, 26, 80, 17, 1, 0, n, 20, 247];
const events = [];
const parser = new QuParser((event) => events.push(event));
for (const byte of [
  ...identity(),
  ...faderBytes('ch1', 63, 3),
  ...muteBytes('ch1', true, 3),
  ...end(3),
])
  parser.feed([byte, 254]);
assert.equal(events.filter((e) => e.type === 'identity').length, 1);
assert.equal(events.find((e) => e.type === 'fader').raw, 63);
assert.equal(events.filter((e) => e.type === 'mute').length, 1);
assert.equal(events.at(-1).type, 'sync-end');
const running = [];
new QuParser((e) => running.push(e)).feed([
  0xb3, 99, 32, 98, 23, 6, 98, 38, 7, 0x93, 32, 127, 33, 63, 32, 0,
]);
assert.equal(running.filter((e) => e.type === 'fader').length, 1);
assert.equal(running.filter((e) => e.type === 'mute').length, 2);

class MockTransport {
  listeners = {};
  sent = [];
  model = 2;
  missing = false;
  echo = true;
  linked = false;
  board = Object.fromEntries(
    QU_IDS.map((id) => [
      id,
      {
        muted: ![
          'ch2',
          'ch3',
          'ch4',
          'ch9',
          'ch10',
          'ch11',
          'ch13',
          'ch14',
          'ch24',
          'fx1',
          'fx2',
        ].includes(id),
        raw: 63,
      },
    ]),
  );
  async addListener(name, fn) {
    this.listeners[name] = fn;
    return {
      remove: async () => {
        delete this.listeners[name];
      },
    };
  }
  data(bytes) {
    this.listeners.data?.({ base64: Buffer.from(bytes).toString('base64') });
  }
  async connect() {
    this.listeners.status?.({ state: 'socket-open', reason: 'mock' });
  }
  async disconnect() {
    this.listeners.status?.({
      state: 'disconnected',
      reason: 'mock disconnect',
    });
  }
  async diagnostics() {
    return { events: [] };
  }
  async send({ bytes }) {
    this.sent.push(bytes);
    if (bytes[0] === 240 && bytes[9] === 18) return;
    if (bytes[0] === 240) {
      this.data(identity(3, this.model));
      for (const id of QU_IDS) {
        this.data(muteBytes(id, this.board[id].muted, 3));
        if (!(this.missing && id === 'fx4'))
          this.data(faderBytes(id, this.board[id].raw, 3));
      }
      this.data(end(3));
      return;
    }
    const id = QU_IDS.find(
      (id) => address(id) === bytes[bytes.length === 6 ? 1 : 2],
    );
    if (bytes.length === 6) this.board[id].muted = bytes[2] >= 64;
    else this.board[id].raw = bytes[8];
    if (this.linked && bytes.length === 12 && ['ch9', 'ch10'].includes(id)) {
      const other = id === 'ch9' ? 'ch10' : 'ch9';
      this.board[other].raw = bytes[8];
      if (this.echo) this.data(faderBytes(other, bytes[8], 3));
    }
    if (this.echo) this.data(bytes);
  }
}
async function setup(mock = new MockTransport()) {
  const session = new QuSession(() => {}, mock, true);
  await session.start();
  await session.connect('192.168.1.24');
  return { session, mock };
}
let { session, mock } = await setup();
assert.equal(session.state.phase, 'readonly');
assert.equal(session.complete(), true);
assert.equal(
  mock.sent.length,
  1,
  'Connection must only read state, not apply demo levels',
);
session.enableLive();
let mix = session.observedMix(initialMix(examplePatch));
const before = structuredClone(mock.board);
mix = await session.run({ type: 'mode', mode: 'together' }, mix);
assert.equal(mock.board.ch1.muted, false);
mix = await session.undo(mix);
assert.equal(mock.board.ch1.muted, before.ch1.muted);
mix = await session.run(
  { type: 'adjust', ids: ['ch9', 'ch10'], delta: -1 },
  mix,
);
assert.ok(mock.board.ch9.raw < 63);
assert.equal(mock.board.ch11.raw, 63);
mix = await session.undo(mix);
assert.equal(mock.board.ch9.raw, 63);
const snapshot = structuredClone(mock.board);
mix = await session.run({ type: 'mute-all' }, mix);
assert.ok(Object.values(mock.board).every((c) => c.muted));
assert.equal(
  mock.board.ch24.muted,
  true,
  'Unassigned live input must also mute',
);
mock.board.ch9.raw = 54;
mock.data(faderBytes('ch9', 54, 3));
mix = await session.run({ type: 'restore' }, mix);
for (const id of QU_IDS) assert.equal(mock.board[id].muted, snapshot[id].muted);
assert.equal(mock.board.ch9.raw, 54, 'Restore must not write old faders');
mix = await session.run({ type: 'adjust', ids: ['ch9'], delta: 1 }, mix);
mock.data(faderBytes('ch9', 47, 3));
await assert.rejects(() => session.undo(mix), /desk changed/);
await session.stop();
({ session, mock } = await setup());
session.enableLive();
mock.echo = false;
await assert.rejects(
  () =>
    session.run(
      { type: 'adjust', ids: ['ch9'], delta: 1 },
      session.observedMix(initialMix()),
    ),
  /No raw readback/,
);
assert.equal(session.state.phase, 'readonly');
assert.throws(
  () => session.enableLive(),
  'A missing readback requires a fresh sync',
);
await session.stop();
const linked = new MockTransport();
linked.linked = true;
({ session, mock } = await setup(linked));
session.enableLive();
mix = await session.run(
  { type: 'adjust', ids: ['ch9', 'ch10'], delta: 1 },
  session.observedMix(initialMix()),
);
assert.equal(mock.board.ch9.raw, mock.board.ch10.raw);
assert.equal(
  mock.sent.filter((bytes) => bytes[0] !== 240).length,
  1,
  'Already-observed linked partner must not wait for a redundant echo',
);
mix = await session.undo(mix);
assert.equal(mock.board.ch9.raw, 63);
assert.equal(mock.board.ch10.raw, 63);
mock.board.fx3.muted = false;
mock.data(muteBytes('fx3', false, 3));
mix = await session.run({ type: 'mode', mode: 'speaking' }, mix);
assert.equal(
  mock.board.fx3.muted,
  false,
  'Service modes preserve live FX-return mutes',
);
await session.stop();
const incomplete = new MockTransport();
incomplete.missing = true;
({ session } = await setup(incomplete));
assert.equal(session.complete(), false);
assert.throws(() => session.enableLive());
await session.stop();
const wrong = new MockTransport();
wrong.model = 1;
({ session } = await setup(wrong));
assert.equal(session.state.phase, 'error');
assert.throws(() => session.enableLive());
await session.stop();
// Meter vectors, framing and calibrated automatic control (fake time, no hardware).
assert.deepEqual(
  meterRequest(true, 3),
  [240, 0, 0, 26, 80, 17, 1, 0, 3, 18, 1, 247],
);
const meterBytes = meterFixture({
  levels: { ch1: -3.5, ch24: -17.25, st3: -22.5 },
  peak: -6,
});
const decoded = decodeQu24Meters(meterBytes.slice(10, -1));
assert.equal(decoded.inputs.ch1, -3.5);
assert.equal(decoded.inputs.ch24, -17.25);
assert.equal(decoded.inputs.st3, -22.5);
assert.equal(decoded.peak, -6);
assert.equal(decodeQu24Meters([0, 0]), null);
const meterEvents = [];
const meterParser = new QuParser((e) => meterEvents.push(e));
for (const b of meterBytes) meterParser.feed([b, 254]);
assert.equal(meterEvents[0].type, 'meters');
assert.equal(meterEvents[0].inputs.ch1, -3.5);
const actualNow = Date.now;
let time = 100000;
Date.now = () => time;
try {
  ({ session, mock } = await setup());
  session.enableLive();
  mix = await session.run(
    { type: 'mode', mode: 'speaking' },
    session.observedMix(initialMix()),
  );
  assert.throws(() => session.enableAuto(mix), /meters/);
  const sample = (level = -24, peak = -24) =>
    mock.data(meterFixture({ levels: { ch1: level }, peak }));
  const check = async () => {
    await session.observeMeters();
    for (let i = 0; i <= 20; i++) {
      sample();
      time += 500;
    }
    assert.equal(session.state.automation.ready, true);
  };
  await check();
  assert.equal(session.state.automation.mode, 'observe');
  const beforeAuto = mock.sent.filter((b) => b[0] !== 240).length;
  session.enableAuto(mix);
  assert.equal(
    mock.sent.filter((b) => b[0] !== 240).length,
    beforeAuto,
    'Enabling must not move faders',
  );
  for (let i = 0; i < 12; i++) {
    sample(-16);
    time += 500;
  }
  await session.autoTick(time);
  assert.equal(mock.board.ch1.raw, 62);
  assert.equal(session.state.automation.mode, 'on');
  assert.equal(mock.board.ch2.raw, 63, 'Other roles must not move');
  session.stopAuto();
  assert.equal(session.state.automation.mode, 'off');
  mix = await session.undo(mix);
  assert.equal(
    mock.board.ch1.raw,
    63,
    'Undo returns entire auto session to approved faders',
  );
  await check();
  session.enableAuto(mix);
  for (let cycle = 0; cycle < 25; cycle++) {
    for (let i = 0; i < 10; i++) {
      sample(-16);
      time += 500;
    }
    await session.autoTick(time);
  }
  assert.ok(
    Math.abs(rawDb(mock.board.ch1.raw) - rawDb(63)) <= 3,
    'Cumulative correction bounded to 3 dB',
  );
  const limited = mock.board.ch1.raw;
  for (let i = 0; i < 12; i++) {
    sample(-100);
    time += 500;
  }
  await session.autoTick(time);
  assert.equal(mock.board.ch1.raw, limited, 'Silence must not be boosted');
  sample(-24, -2);
  assert.equal(
    session.state.automation.mode,
    'off',
    'Near clipping stops automation',
  );
  await check();
  session.enableAuto(mix);
  time += 3500;
  await session.autoTick(time);
  assert.equal(
    session.state.automation.mode,
    'off',
    'Stale meters stop automation',
  );
  await check();
  session.enableAuto(mix);
  mock.data(faderBytes('ch1', 63, 3));
  assert.equal(
    session.state.automation.mode,
    'off',
    'Physical desk adjustments stop automation',
  );
  await check();
  session.enableAuto(mix);
  await session.run({ type: 'mute-all' }, mix);
  assert.equal(
    session.state.automation.mode,
    'off',
    'Mute all stops automation',
  );
  assert.ok(Object.values(mock.board).every((c) => c.muted));
  await session.stop();
  ({ session, mock } = await setup());
  session.enableLive();
  mix = await session.run(
    { type: 'mode', mode: 'worship' },
    session.observedMix(initialMix()),
  );
  // Calibrate at high meter cadence, then exercise an externally linked stereo source.
  mock.linked = true;
  await session.observeMeters();
  for (let i = 0; i <= 1000; i++) {
    mock.data(meterFixture());
    time += 10;
  }
  assert.equal(
    session.state.automation.ready,
    true,
    'High frame rate must not prevent calibration',
  );
  session.enableAuto(mix);
  for (let i = 0; i < 12; i++) {
    mock.data(meterFixture({ levels: { ch9: -16, ch10: -16 } }));
    time += 500;
  }
  const pairWrites = mock.sent.length;
  await session.autoTick(time);
  assert.equal(mock.board.ch9.raw, 62);
  assert.equal(mock.board.ch10.raw, 62);
  assert.equal(
    mock.sent.slice(pairWrites).filter((b) => b[0] !== 240).length,
    1,
    'Linked partner readback must avoid redundant writes',
  );
  assert.equal(session.state.automation.mode, 'on');
  mock.data([240, 0, 0, 26, 80, 17, 1, 0, 3, 19, 0, 0, 247]);
  assert.equal(
    session.state.automation.mode,
    'off',
    'Invalid meter layout must stop automation',
  );
  await session.observeMeters();
  for (let i = 0; i <= 20; i++) {
    mock.data(meterFixture());
    time += 500;
  }
  session.enableAuto(mix);
  mock.listeners.data({
    base64: Buffer.from(meterFixture()).toString('base64'),
    receivedAt: time - 4000,
  });
  assert.equal(
    session.state.automation.mode,
    'off',
    'Delayed native delivery must stop automation',
  );
  await session.observeMeters();
  for (let i = 0; i <= 20; i++) {
    mock.data(meterFixture());
    time += 500;
  }
  session.enableAuto(mix);
  for (let i = 0; i < 12; i++) {
    mock.data(meterFixture({ levels: { ch9: -16, ch10: -16 } }));
    time += 500;
  }
  mock.linked = false;
  const normalSend = mock.send.bind(mock);
  let delayed = false;
  mock.send = async (payload) => {
    if (payload.bytes[0] !== 240 && !delayed) {
      delayed = true;
      time += 4000;
    }
    await normalSend(payload);
  };
  const beforePair = mock.board.ch10.raw;
  await session.autoTick(time);
  assert.equal(
    session.state.automation.mode,
    'off',
    'Staleness during a multi-channel adjustment stops remaining commands',
  );
  assert.equal(
    mock.board.ch10.raw,
    beforePair,
    'Do not send remaining stereo command after data is stale',
  );
  mix = await session.undo(mix);
  assert.equal(
    mock.board.ch9.raw,
    beforePair,
    'Undo only confirmed partial correction',
  );
  mock.send = normalSend;
  await session.observeMeters();
  for (let i = 0; i <= 20; i++) {
    mock.data(meterFixture());
    time += 500;
  }
  session.enableAuto(mix);
  for (let i = 0; i < 12; i++) {
    mock.data(meterFixture({ levels: { ch9: -16, ch10: -16 } }));
    time += 500;
  }
  mock.echo = false;
  await session.autoTick(time);
  assert.equal(
    session.state.phase,
    'readonly',
    'Missing automatic readback locks further writes',
  );
  assert.equal(session.state.automation.mode, 'off');
  await session.stop();
  // Silent half of a stereo patch must exclude the entire source.
  const pure = new AutoBalance();
  const raw = Object.fromEntries(
    QU_IDS.map((id) => [id, { raw: 63, muted: false }]),
  );
  pure.observe(time);
  for (let i = 0; i <= 20; i++) {
    pure.receive({ inputs: { ch9: -24, ch10: -100 }, peak: -24 }, time);
    time += 500;
  }
  assert.throws(() => pure.enable(initialMix(), raw, time), /No stable/);
} finally {
  Date.now = actualNow;
  await session.stop();
}
console.log(
  'Passed: Qu-24 meter layout/7-bit decoding; observation-only; explicit enable; bounded auto correction; silence; clipping; stale data; manual takeover; all-channel mute; cumulative Undo.',
);
const searchTransport = new MockTransport();
searchTransport.discover = async () => ({
  hosts: ['192.168.1.24'],
  limited: false,
});
const discovery = new QuSession(() => {}, searchTransport, true);
assert.deepEqual(await discovery.discover(), {
  hosts: ['192.168.1.24'],
  limited: false,
});
assert.equal(
  searchTransport.sent.length,
  0,
  'Discovery must not send MIDI commands',
);
assert.equal(
  discovery.state.phase,
  'demo',
  'Discovery must not enable live control',
);
discovery.state.phase = 'live';
await assert.rejects(() => discovery.discover(), /Disconnect/);
const webDiscovery = new QuSession(() => {}, searchTransport, false);
await assert.rejects(() => webDiscovery.discover(), /Android/);
console.log(
  'Passed: official byte vectors; fragmented/running-status MIDI; identity and sync gating; no writes on connect; live adjustment/readback/undo; all 31 input mutes; exact restore without fader writes; stale Undo; missing readback; incomplete sync; wrong mixer rejection.',
);
