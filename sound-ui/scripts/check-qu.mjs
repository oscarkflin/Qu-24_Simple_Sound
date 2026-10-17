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
} from '../lib/qu-protocol.ts';
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
