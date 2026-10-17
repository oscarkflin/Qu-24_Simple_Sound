import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core';
import {
  QuParser,
  QU_IDS,
  stateRequest,
  muteBytes,
  faderBytes,
  rawDb,
  adjustedRaw,
  type QuEvent,
} from './qu-protocol.ts';
import { applyAction, type Mix, type Action } from './assistant-model.ts';
import { logEvent, scrub } from './diagnostics.ts';

type Observed = { muted?: boolean; raw?: number };
export type ConnectionState = {
  phase:
    | 'demo'
    | 'connecting'
    | 'syncing'
    | 'readonly'
    | 'live'
    | 'disconnected'
    | 'error';
  message: string;
  identity?: { model: number; major: number; minor: number; midi: number };
  observed: Record<string, Observed>;
  busy: boolean;
  canUndo: boolean;
  revision: number;
};
export interface Transport {
  discover(): Promise<{ hosts: string[]; limited: boolean }>;
  connect(options: { host: string }): Promise<void>;
  disconnect(): Promise<void>;
  send(options: { bytes: number[] }): Promise<void>;
  addListener(
    event: string,
    listener: (data: any) => void,
  ): Promise<PluginListenerHandle>;
  diagnostics(options: { raw: boolean }): Promise<unknown>;
}
const native = registerPlugin<Transport>('QuTransport');
type Change = {
  id: string;
  field: 'muted' | 'raw';
  before: number | boolean;
  after: number | boolean;
};
export class QuSession {
  async discover() {
    if (!this.supported)
      throw new Error('Mixer discovery is available in the Android app.');
    if (!['demo', 'disconnected', 'error'].includes(this.state.phase))
      throw new Error('Disconnect before searching for mixers.');
    logEvent('qu.discovery.started', {});
    try {
      const result = await this.transport.discover();
      logEvent('qu.discovery.completed', {
        count: result.hosts.length,
        limited: result.limited,
      });
      return result;
    } catch (error) {
      logEvent(
        'qu.discovery.error',
        { message: scrub(String(error)) },
        'error',
      );
      throw error;
    }
  }
  state: ConnectionState = {
    phase: 'demo',
    message: 'Demo; no mixer connection',
    observed: {},
    busy: false,
    canUndo: false,
    revision: 0,
  };
  private parser = new QuParser((event) => this.received(event));
  private listeners: PluginListenerHandle[] = [];
  private syncEnd = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private waiting = new Set<{
    id: string;
    field: 'muted' | 'raw';
    value: number | boolean;
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private undoRecord: { changes: Change[]; mode: Mix['mode'] } | null = null;
  private changed: (state: ConnectionState) => void;
  private transport: Transport;
  private supported: boolean;
  constructor(
    changed: (state: ConnectionState) => void,
    transport: Transport = native,
    supported = Capacitor.isNativePlatform(),
  ) {
    this.changed = changed;
    this.transport = transport;
    this.supported = supported;
  }
  private publish() {
    this.state = {
      ...this.state,
      observed: { ...this.state.observed },
      canUndo: !!this.undoRecord,
      revision: this.state.revision + 1,
    };
    this.changed(this.state);
  }
  async start() {
    if (!this.supported) return;
    this.listeners = await Promise.all([
      this.transport.addListener('data', (data) => {
        try {
          this.parser.feed(
            Array.from(atob(data.base64), (c) => c.charCodeAt(0)),
          );
          this.publish();
        } catch (e) {
          logEvent('qu.parser.error', { message: scrub(e) }, 'error');
        }
      }),
      this.transport.addListener('status', (data) => {
        logEvent('qu.transport', {
          state: data.state,
          reason: scrub(data.reason),
        });
        if (data.state === 'disconnected') {
          clearTimeout(this.timer);
          this.rejectWaiting('Mixer disconnected');
          this.undoRecord = null;
          this.state = {
            ...this.state,
            phase: 'disconnected',
            busy: false,
            message: scrub(data.reason),
            observed: {},
            identity: undefined,
          };
          this.publish();
        }
      }),
    ]);
  }
  async stop() {
    clearTimeout(this.timer);
    this.rejectWaiting('Session closed');
    for (const listener of this.listeners) await listener.remove();
    this.listeners = [];
    if (this.supported) await this.transport.disconnect();
  }
  async connect(host: string) {
    if (!this.supported)
      throw new Error(
        'Direct mixer connection is available in the Android app.',
      );
    if (
      !/^(\d{1,3}\.){3}\d{1,3}$/.test(host) ||
      host.split('.').some((p) => Number(p) > 255)
    )
      throw new Error('Enter a valid mixer IPv4 address.');
    this.undoRecord = null;
    this.rejectWaiting('New connection');
    this.parser = new QuParser((event) => this.received(event));
    this.syncEnd = false;
    this.state = {
      phase: 'connecting',
      message: 'Opening mixer connection…',
      observed: {},
      busy: false,
      canUndo: false,
      revision: 0,
    };
    this.publish();
    try {
      await this.transport.connect({ host });
      this.state = {
        ...this.state,
        phase: 'syncing',
        message: 'Reading Qu identity and channel state…',
      };
      this.publish();
      await this.transport.send({ bytes: stateRequest() });
      logEvent('qu.sync.requested');
      if (this.state.phase === 'syncing')
        this.timer = setTimeout(() => {
          if (this.state.phase !== 'syncing') return;
          this.state = {
            ...this.state,
            phase: this.state.identity ? 'readonly' : 'error',
            message: this.state.identity
              ? 'Sync incomplete. Live control stays locked.'
              : 'No supported Qu-24 identity received.',
          };
          logEvent(
            'qu.sync.timeout',
            { mutes: this.muteCount(), faders: this.faderCount() },
            'error',
          );
          this.publish();
        }, 10000);
    } catch (e) {
      this.state = {
        ...this.state,
        phase: 'error',
        message: scrub((e as Error).message),
      };
      logEvent('qu.connect.failed', { message: this.state.message }, 'error');
      this.publish();
    }
  }
  async disconnect() {
    if (this.supported) await this.transport.disconnect();
  }
  async demo() {
    await this.disconnect();
    this.state = {
      phase: 'demo',
      message: 'Demo; no mixer connection',
      observed: {},
      busy: false,
      canUndo: false,
      revision: 0,
    };
    this.undoRecord = null;
    this.publish();
  }
  muteCount() {
    return QU_IDS.filter(
      (id) => typeof this.state.observed[id]?.muted === 'boolean',
    ).length;
  }
  faderCount() {
    return QU_IDS.filter((id) => Number.isInteger(this.state.observed[id]?.raw))
      .length;
  }
  complete() {
    return (
      !!this.state.identity &&
      this.syncEnd &&
      this.muteCount() === 31 &&
      this.faderCount() === 31
    );
  }
  enableLive() {
    if (this.state.phase !== 'readonly' || !this.complete())
      throw new Error('Need a complete confirmed Qu-24 state first.');
    this.state = {
      ...this.state,
      phase: 'live',
      message: 'Live channel control enabled',
    };
    logEvent('qu.live.enabled');
    this.publish();
  }
  private received(event: QuEvent) {
    if (event.type === 'parse-warning') {
      logEvent('qu.parser.warning', { message: event.message }, 'error');
      return;
    }
    if (event.type === 'identity') {
      if (
        event.model !== 2 ||
        event.major < 1 ||
        (event.major === 1 && event.minor < 9)
      ) {
        this.state = {
          ...this.state,
          phase: 'error',
          message: 'Requires a Qu-24 with firmware 1.9 or later.',
        };
        logEvent('qu.identity.unsupported', { ...event }, 'error');
        return;
      }
      this.state = {
        ...this.state,
        identity: {
          model: event.model,
          major: event.major,
          minor: event.minor,
          midi: event.midi,
        },
      };
      logEvent('qu.identity', {
        model: event.model,
        firmware: `${event.major}.${event.minor}`,
        midi: event.midi + 1,
      });
      return;
    }
    if (!this.state.identity || event.midi !== this.state.identity.midi) return;
    if (event.type === 'sync-end') {
      this.syncEnd = true;
      clearTimeout(this.timer);
      if (this.state.phase === 'syncing')
        this.state = {
          ...this.state,
          phase: 'readonly',
          message: this.complete()
            ? 'Qu-24 state received. Read-only.'
            : 'Sync ended with missing input state. Live control stays locked.',
        };
      logEvent('qu.sync.finished', {
        mutes: this.muteCount(),
        faders: this.faderCount(),
        complete: this.complete(),
      });
      return;
    }
    const old = this.state.observed[event.id] || {};
    this.state.observed[event.id] = {
      ...old,
      ...(event.type === 'mute' ? { muted: event.muted } : { raw: event.raw }),
    };
    logEvent(
      `qu.observed.${event.type}`,
      event.type === 'mute'
        ? { id: event.id, muted: event.muted }
        : { id: event.id, raw: event.raw },
    );
    for (const waiter of this.waiting) {
      if (
        waiter.id === event.id &&
        this.state.observed[event.id][waiter.field] === waiter.value
      ) {
        clearTimeout(waiter.timer);
        this.waiting.delete(waiter);
        waiter.resolve();
      }
    }
  }
  observedMix(mix: Mix): Mix {
    return {
      ...mix,
      channels: mix.channels.map((c) => {
        const observed = this.state.observed[c.id];
        return observed
          ? {
              ...c,
              muted: observed.muted ?? c.muted,
              level:
                observed.raw === undefined
                  ? c.level
                  : (rawDb(observed.raw) ?? -60),
            }
          : c;
      }),
    };
  }
  private rejectWaiting(reason: string) {
    for (const waiter of this.waiting) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(reason));
    }
    this.waiting.clear();
  }
  private async command(change: Change) {
    if (this.state.phase !== 'live')
      throw new Error('Live connection is not available.');
    if (this.state.observed[change.id]?.[change.field] === change.after) {
      logEvent('qu.command.already-observed', {
        id: change.id,
        field: change.field,
        value: change.after,
      });
      return;
    }
    if (this.state.observed[change.id]?.[change.field] !== change.before)
      throw new Error('The desk changed while this action was being applied.');
    const n = this.state.identity!.midi;
    const packet =
      change.field === 'muted'
        ? muteBytes(change.id, change.after as boolean, n)
        : faderBytes(change.id, change.after as number, n);
    let wait: typeof this.waiting extends Set<infer T> ? T : never;
    const confirmation = new Promise<void>((resolve, reject) => {
      wait = {
        id: change.id,
        field: change.field,
        value: change.after,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiting.delete(wait);
          reject(
            new Error(
              `No ${change.field} readback for ${change.id}. Review the desk.`,
            ),
          );
        }, 2000),
      };
      this.waiting.add(wait);
    });
    // Attach immediately: a disconnect may reject while Android is still returning its send result.
    void confirmation.catch(() => {});
    try {
      logEvent('qu.command.attempt', {
        id: change.id,
        field: change.field,
        before: change.before,
        target: change.after,
      });
      await this.transport.send({ bytes: packet });
      logEvent('qu.command.sent', { id: change.id, field: change.field });
      await confirmation;
      logEvent('qu.command.confirmed', {
        id: change.id,
        field: change.field,
        value: change.after,
      });
    } catch (e) {
      clearTimeout(wait!.timer);
      this.waiting.delete(wait!);
      throw e;
    }
  }
  async run(action: Action, current: Mix): Promise<Mix> {
    if (this.state.phase !== 'live' || !this.complete() || this.state.busy)
      throw new Error('Live mixer state is unavailable or busy.');
    if (
      current.beforeMute &&
      action.type !== 'restore' &&
      action.type !== 'mute-all'
    )
      throw new Error('Restore sound first.');
    const before = this.observedMix(current),
      changes: Change[] = [];
    let target = applyAction(before, action);
    if (action.type === 'mode')
      target = {
        ...target,
        channels: target.channels.map((c) =>
          c.group === 'fx'
            ? {
                ...c,
                muted: before.channels.find((old) => old.id === c.id)!.muted,
              }
            : c,
        ),
      };
    if (action.type === 'mute-all')
      target = {
        ...before,
        beforeMute: before.beforeMute ?? before.channels.map((c) => ({ ...c })),
        channels: before.channels.map((c) => ({ ...c, muted: true })),
      };
    if (
      action.type === 'restore' &&
      before.beforeMute &&
      before.channels.some((c) => !c.muted)
    )
      throw new Error(
        'Channels changed on the desk after Mute all. Restore from the desk instead.',
      );
    if (action.type === 'adjust') {
      for (const id of action.ids) {
        if (!QU_IDS.includes(id)) throw new Error('Unsupported input');
        const old = this.state.observed[id];
        if (old.muted) continue;
        const raw = adjustedRaw(old.raw!, action.delta);
        if (raw !== old.raw)
          changes.push({ id, field: 'raw', before: old.raw!, after: raw });
      }
    } else {
      // Restore only mute states. Never write saved demo fader positions to the desk.
      for (const channel of target.channels) {
        const observed = this.state.observed[channel.id];
        if (channel.muted !== observed.muted)
          changes.push({
            id: channel.id,
            field: 'muted',
            before: observed.muted!,
            after: channel.muted,
          });
      }
    }
    if (action.type === 'mode')
      changes.sort(
        (a, b) => Number(b.after === true) - Number(a.after === true),
      );
    await this.batch(changes);
    this.undoRecord =
      action.type === 'mode' || action.type === 'adjust'
        ? { changes, mode: current.mode }
        : null;
    this.publish();
    return this.observedMix(target);
  }
  private async batch(changes: Change[]) {
    this.state = { ...this.state, busy: true };
    this.publish();
    let confirmed = 0;
    try {
      for (const change of changes) {
        await this.command(change);
        confirmed++;
      }
    } catch (e) {
      this.undoRecord = null;
      this.syncEnd = false;
      const message = `${confirmed}/${changes.length} changes confirmed. ${(e as Error).message} Reconnect to read the desk again.`;
      logEvent(
        'qu.batch.failed',
        { confirmed, total: changes.length, message: scrub(message) },
        'error',
      );
      if (this.state.phase === 'live')
        this.state = { ...this.state, phase: 'readonly', message };
      throw new Error(message);
    } finally {
      this.state = { ...this.state, busy: false };
      this.publish();
    }
  }
  async undo(current: Mix): Promise<Mix> {
    const record = this.undoRecord;
    if (!record || this.state.phase !== 'live' || this.state.busy)
      throw new Error('No live adjustment to undo.');
    for (const change of record.changes)
      if (this.state.observed[change.id]?.[change.field] !== change.after)
        throw new Error(
          'The desk changed since this adjustment. Undo is blocked.',
        );
    await this.batch(
      [...record.changes]
        .reverse()
        .map((c) => ({ ...c, before: c.after, after: c.before })),
    );
    this.undoRecord = null;
    this.publish();
    return this.observedMix({ ...current, mode: record.mode });
  }
  async diagnostics(raw = false) {
    return this.supported
      ? await this.transport.diagnostics({ raw })
      : { events: [], note: 'Browser preview has no native transport' };
  }
}
