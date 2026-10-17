// Allen & Heath Qu Classic MIDI Protocol V1.9+ ISS.2, pp.3,5,10,13.
export const QU_PORT = 51325;
export const QU_IDS = [
  ...Array.from({ length: 24 }, (_, i) => `ch${i + 1}`),
  ...Array.from({ length: 3 }, (_, i) => `st${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `fx${i + 1}`),
];
export function address(id: string): number {
  if (/^ch([1-9]|1\d|2[0-4])$/.test(id)) return 0x20 + Number(id.slice(2)) - 1;
  if (/^st[1-3]$/.test(id)) return 0x40 + Number(id.slice(2)) - 1;
  if (/^fx[1-4]$/.test(id)) return 0x08 + Number(id.slice(2)) - 1;
  throw new Error('Unsupported Qu-24 input.');
}
export const idForAddress = (value: number) =>
  QU_IDS.find((id) => address(id) === value);
function checkMidi(n: number) {
  if (!Number.isInteger(n) || n < 0 || n > 15)
    throw new Error('Invalid negotiated MIDI channel.');
}
export const stateRequest = () => [
  0xf0, 0, 0, 0x1a, 0x50, 0x11, 1, 0, 0x7f, 0x10, 0, 0xf7,
];
export function muteBytes(id: string, muted: boolean, n: number) {
  checkMidi(n);
  const ch = address(id);
  return [0x90 + n, ch, muted ? 0x7f : 0x3f, 0x90 + n, ch, 0];
}
export function faderBytes(id: string, raw: number, n: number) {
  checkMidi(n);
  if (!Number.isInteger(raw) || raw < 0 || raw > 127)
    throw new Error('Invalid fader byte.');
  return [
    0xb0 + n,
    0x63,
    address(id),
    0xb0 + n,
    0x62,
    0x17,
    0xb0 + n,
    0x06,
    raw,
    0xb0 + n,
    0x26,
    0x07,
  ];
}
const anchors = [
  [-45, 12],
  [-40, 16],
  [-35, 23],
  [-30, 31],
  [-25, 39],
  [-20, 47],
  [-15, 54],
  [-10, 63],
  [-5, 79],
  [0, 98],
  [5, 114],
  [10, 127],
];
export function rawDb(raw: number): number | null {
  if (raw < 12 || raw > 127) return null;
  for (let i = 1; i < anchors.length; i++) {
    const [db, code] = anchors[i];
    const [prev, old] = anchors[i - 1];
    if (raw <= code) return prev + ((raw - old) * (db - prev)) / (code - old);
  }
  return null;
}
export function adjustedRaw(raw: number, delta: number): number {
  const db = rawDb(raw);
  if (db === null || db < -45 || db > 0)
    throw new Error(
      'Use the desk for faders outside −45 to 0 dB before adjusting here.',
    );
  if (!Number.isFinite(delta) || Math.abs(delta) > 2)
    throw new Error('Adjustment is too large.');
  const target = Math.max(-45, Math.min(0, db + delta));
  let best = raw,
    error = Infinity;
  for (let r = 12; r <= 98; r++) {
    const distance = Math.abs(rawDb(r)! - target);
    if (distance < error) {
      best = r;
      error = distance;
    }
  }
  return best;
}
export type QuEvent =
  | {
      type: 'identity';
      midi: number;
      model: number;
      major: number;
      minor: number;
    }
  | { type: 'sync-end'; midi: number }
  | { type: 'mute'; midi: number; id: string; muted: boolean }
  | { type: 'fader'; midi: number; id: string; raw: number }
  | { type: 'parse-warning'; message: string };
export class QuParser {
  private status = 0;
  private data: number[] = [];
  private sysex: number[] | null = null;
  private nrpn = Array.from({ length: 16 }, () => ({
    channel: -1,
    param: -1,
    value: -1,
  }));
  private emit: (event: QuEvent) => void;
  constructor(emit: (event: QuEvent) => void) {
    this.emit = emit;
  }
  feed(bytes: number[]) {
    for (const byte of bytes) {
      if (byte >= 0xf8) continue; // Real-time bytes may be interleaved inside any message.
      if (byte === 0xf0) {
        this.sysex = [byte];
        this.status = 0;
        this.data = [];
        continue;
      }
      if (this.sysex) {
        if (byte === 0xf7) {
          this.sysex.push(byte);
          this.onSysex(this.sysex);
          this.sysex = null;
        } else if (byte >= 0x80) {
          this.sysex = null;
          this.emit({ type: 'parse-warning', message: 'Interrupted SysEx' });
        } else {
          this.sysex.push(byte);
          if (this.sysex.length > 65536) {
            this.sysex = null;
            this.emit({
              type: 'parse-warning',
              message: 'SysEx exceeds limit',
            });
          }
        }
        continue;
      }
      if (byte >= 0x80) {
        this.status = byte < 0xf0 ? byte : 0;
        this.data = [];
        continue;
      }
      if (!this.status) continue;
      this.data.push(byte);
      const type = this.status & 0xf0;
      if (this.data.length === (type === 0xc0 || type === 0xd0 ? 1 : 2)) {
        this.onMessage(this.status, this.data);
        this.data = [];
      }
    }
  }
  private onSysex(b: number[]) {
    const h = [0xf0, 0, 0, 0x1a, 0x50, 0x11, 1, 0];
    if (!h.every((v, i) => b[i] === v) || b[8] > 15) return;
    if (b[9] === 0x11 && b.length === 14)
      this.emit({
        type: 'identity',
        midi: b[8],
        model: b[10],
        major: b[11],
        minor: b[12],
      });
    if (b[9] === 0x14 && b.length === 11)
      this.emit({ type: 'sync-end', midi: b[8] });
  }
  private onMessage(status: number, data: number[]) {
    const midi = status & 15,
      type = status & 0xf0;
    const [a, b] = data;
    const id = idForAddress(a);
    if (type === 0x90 && b > 0 && id)
      this.emit({ type: 'mute', midi, id, muted: b >= 0x40 });
    if (type !== 0xb0) return;
    const p = this.nrpn[midi];
    if (a === 0x63) {
      p.channel = b;
      p.param = -1;
      p.value = -1;
    } else if (a === 0x62) {
      p.param = b;
      p.value = -1;
    } else if (a === 6) p.value = b;
    else if (a === 0x26 && p.param === 0x17 && p.value >= 0 && b === 7) {
      const input = idForAddress(p.channel);
      if (input) this.emit({ type: 'fader', midi, id: input, raw: p.value });
      p.value = -1;
    }
  }
}
