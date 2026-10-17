import { rawDb } from './qu-protocol.ts';
import type { Mix } from './assistant-model.ts';
export type MeterFrame = { inputs: Record<string, number>; peak: number };
export type AutoStatus = {
  mode: 'off' | 'observe' | 'on';
  message: string;
  frames: number;
  ready: boolean;
  channels: number;
  readings?: Record<string, number>;
  peak?: number;
};
type Baseline = { raw: number; level: number };
// Calibrated level hold, not equal-loudness mixing or audio/feedback recognition.
export class AutoBalance {
  status: AutoStatus = {
    mode: 'off',
    message: 'Auto balance is off.',
    frames: 0,
    ready: false,
    channels: 0,
  };
  private samples: { at: number; frame: MeterFrame }[] = [];
  private started = 0;
  private lastAt = 0;
  private lastStep = 0;
  baseline: Record<string, Baseline> = {};
  groups: string[][] = [];
  observe(now: number) {
    this.samples = [];
    this.baseline = {};
    this.groups = [];
    this.started = now;
    this.lastAt = 0;
    this.status = {
      mode: 'observe',
      message:
        'Checking meters. Play/speak at the approved mix for at least 10 seconds.',
      frames: 0,
      ready: false,
      channels: 0,
    };
  }
  stop(reason: string) {
    this.status = {
      ...this.status,
      mode: 'off',
      ready: false,
      message: reason,
    };
  }
  receive(frame: MeterFrame, now: number) {
    if (this.status.mode === 'off') return;
    this.lastAt = now;
    if (!this.samples.length || now - this.samples.at(-1)!.at >= 100)
      this.samples.push({ at: now, frame });
    this.samples = this.samples.filter((s) => s.at >= now - 10000).slice(-200);
    this.status = {
      ...this.status,
      frames: this.status.frames + 1,
      readings: frame.inputs,
      peak: frame.peak,
      ready:
        now - this.started >= 10000 &&
        now - this.samples[0].at >= 9000 &&
        this.samples.length >= 10,
    };
    if (frame.peak >= -3) {
      this.stop(
        'Stopped: a preamp or main LR meter is near clipping. Check the desk.',
      );
    }
  }
  stale(now: number) {
    return !this.lastAt || now - this.lastAt > 3000;
  }
  enable(
    mix: Mix,
    raw: Record<string, { raw?: number; muted?: boolean }>,
    now: number,
  ) {
    if (this.status.mode !== 'observe' || !this.status.ready || this.stale(now))
      throw new Error(
        'Check fresh mixer meters for at least 10 seconds first.',
      );
    if (mix.beforeMute || mix.mode === 'desk')
      throw new Error(
        'Choose Speaking, Worship or Together before calibration.',
      );
    this.baseline = {};
    for (const c of mix.channels) {
      const r = raw[c.id]?.raw;
      const db = r === undefined ? null : rawDb(r);
      const levels = this.samples
        .map((s) => s.frame.inputs[c.id])
        .filter((v) => Number.isFinite(v) && v >= -45);
      const active =
        mix.mode === 'together'
          ? ['speech', 'voice', 'music'].includes(c.group)
          : mix.mode === 'speaking'
            ? c.group === 'speech'
            : ['voice', 'music'].includes(c.group);
      if (
        !c.sourceId ||
        !active ||
        raw[c.id]?.muted !== false ||
        db === null ||
        db < -40 ||
        db > -3 ||
        levels.length < 10 ||
        levels.length < this.samples.length * 0.7
      )
        continue;
      this.baseline[c.id] = {
        raw: r!,
        level: levels.reduce((a, b) => a + b, 0) / levels.length,
      };
    }
    // Keep every multi-channel patch source together; never move half a stereo source.
    this.groups = [
      ...new Set(mix.channels.map((c) => c.sourceId).filter(Boolean)),
    ]
      .map((source) =>
        mix.channels.filter((c) => c.sourceId === source).map((c) => c.id),
      )
      .filter((ids) => ids.length > 0 && ids.every((id) => this.baseline[id]));
    const eligible = new Set(this.groups.flat());
    this.baseline = Object.fromEntries(
      Object.entries(this.baseline).filter(([id]) => eligible.has(id)),
    );
    if (!eligible.size)
      throw new Error(
        'No stable active patch channels in range. Play/speak steadily and check again.',
      );
    this.lastStep = now;
    this.status = {
      ...this.status,
      mode: 'on',
      channels: eligible.size,
      message: `Maintaining your approved mix on ${eligible.size} channels; ±3 dB limit.`,
    };
  }
  plan(
    raw: Record<string, { raw?: number; muted?: boolean }>,
    now: number,
  ): { id: string; before: number; after: number }[] {
    if (this.status.mode !== 'on') return [];
    if (this.stale(now)) {
      this.stop('Stopped: meter data is stale. Check meters again.');
      return [];
    }
    if (now - this.lastStep < 5000) return [];
    this.lastStep = now;
    const recent = this.samples.filter((s) => s.at >= now - 3000);
    if (recent.length < 3 || now - recent[0].at < 2000) return [];
    for (const ids of this.groups) {
      const errors = ids.map((id) => {
        const b = this.baseline[id],
          current = raw[id];
        if (current?.muted !== false || current.raw === undefined) return null;
        const db = rawDb(current.raw);
        if (db === null) return null;
        const levels = recent.map((s) => s.frame.inputs[id]);
        // Do not chase pauses, silence, transients, or a source dropping out.
        if (
          levels.some((v) => !Number.isFinite(v) || v < -50 || v < b.level - 12)
        )
          return null;
        return (
          levels.reduce((a, v) => a + v, 0) / levels.length +
          db -
          (b.level + rawDb(b.raw)!)
        );
      });
      if (errors.some((e) => e === null)) continue;
      const error = errors.reduce<number>((a, e) => a + e!, 0) / errors.length;
      if (
        Math.abs(error) < 3 ||
        errors.some((e) => Math.sign(e!) !== Math.sign(error))
      )
        continue;
      const step = error > 0 ? -1 : 1;
      const changes = ids.map((id) => ({
        id,
        before: raw[id].raw!,
        after: raw[id].raw! + step,
      }));
      if (
        changes.some(
          (c) =>
            c.after < 12 ||
            c.after > 98 ||
            Math.abs(rawDb(c.after)! - rawDb(this.baseline[c.id].raw)!) > 3,
        )
      )
        continue;
      return changes; // At most one source per 5 seconds, one MIDI fader step per channel.
    }
    return [];
  }
}
