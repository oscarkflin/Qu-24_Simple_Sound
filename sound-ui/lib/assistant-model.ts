export type Mode = 'speaking' | 'worship' | 'together' | 'desk';
export type Kind =
  | 'pastor'
  | 'vocal'
  | 'piano'
  | 'acoustic-guitar'
  | 'electric-guitar'
  | 'bass'
  | 'drums'
  | 'playback'
  | 'other';
export type Role = 'speech' | 'voice' | 'music';
export type PatchSource = {
  id: string;
  name: string;
  kind: Kind;
  role: Role;
  channels: string[];
};
export type Patch = { version: 1; sources: PatchSource[] };
export const PATCH_KEY = 'sunday-sound.assistant-patch.v1';
export const kinds: { value: Kind; en: string; zh: string; role: Role }[] = [
  { value: 'pastor', en: 'Pastor / speaker', zh: '牧師／講員', role: 'speech' },
  { value: 'vocal', en: 'Vocal microphone', zh: '人聲麥克風', role: 'voice' },
  { value: 'piano', en: 'Piano / keyboard', zh: '鋼琴／鍵盤', role: 'music' },
  {
    value: 'acoustic-guitar',
    en: 'Acoustic guitar',
    zh: '木吉他',
    role: 'music',
  },
  {
    value: 'electric-guitar',
    en: 'Electric guitar',
    zh: '電吉他',
    role: 'music',
  },
  { value: 'bass', en: 'Bass', zh: '貝斯', role: 'music' },
  { value: 'drums', en: 'Drums', zh: '鼓', role: 'music' },
  {
    value: 'playback',
    en: 'Playback / computer',
    zh: '播放／電腦',
    role: 'music',
  },
  { value: 'other', en: 'Other', zh: '其他', role: 'music' },
];
export const examplePatch: Patch = {
  version: 1,
  sources: [
    {
      id: 'pastor',
      name: 'Pastor',
      kind: 'pastor',
      role: 'speech',
      channels: ['ch1'],
    },
    {
      id: 'lead',
      name: 'Lead vocal',
      kind: 'vocal',
      role: 'voice',
      channels: ['ch2'],
    },
    {
      id: 'vocals',
      name: 'Vocals',
      kind: 'vocal',
      role: 'voice',
      channels: ['ch3', 'ch4'],
    },
    {
      id: 'piano',
      name: 'Piano',
      kind: 'piano',
      role: 'music',
      channels: ['ch9', 'ch10'],
    },
    {
      id: 'guitar',
      name: 'Guitar',
      kind: 'acoustic-guitar',
      role: 'music',
      channels: ['ch11'],
    },
    {
      id: 'drums',
      name: 'Drums',
      kind: 'drums',
      role: 'music',
      channels: ['ch13', 'ch14'],
    },
  ],
};
export function channelName(id: string) {
  return id.startsWith('ch') ? `CH ${id.slice(2)}` : id.toUpperCase();
}
export function parseChannels(text: string): string[] {
  const tokens = text.trim().split(/\s*,\s*/);
  if (
    !text.trim() ||
    tokens.some((x) => !/^(?:\d{1,2}|(?:ch\s*)\d{1,2}|st\s*[1-3])$/i.test(x))
  )
    throw new Error(
      'Use channel numbers 1–24 or ST1–ST3, separated by commas.',
    );
  return tokens
    .map((x) => x.replace(/\s/g, '').toLowerCase())
    .map((x) => (x.startsWith('st') ? x : `ch${Number(x.replace('ch', ''))}`));
}
export function validatePatch(value: unknown): Patch {
  const p = value as Patch;
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.sources) ||
    p.sources.length < 1 ||
    p.sources.length > 27
  )
    throw new Error('Add between 1 and 27 sources.');
  const ids = new Set<string>(),
    used = new Set<string>();
  const sources = p.sources.map((s) => {
    if (
      !s ||
      typeof s.id !== 'string' ||
      !s.id ||
      s.id.length > 80 ||
      ids.has(s.id)
    )
      throw new Error('Invalid source identity.');
    ids.add(s.id);
    if (
      typeof s.name !== 'string' ||
      !s.name.trim() ||
      s.name.trim().length > 40 ||
      !kinds.some((k) => k.value === s.kind) ||
      !['speech', 'voice', 'music'].includes(s.role) ||
      !Array.isArray(s.channels) ||
      !s.channels.length
    )
      throw new Error(
        'Each source needs a name, instrument, role, and channel.',
      );
    const channels = s.channels.map((ch) => {
      if (
        typeof ch !== 'string' ||
        !/^(ch([1-9]|1\d|2[0-4])|st[1-3])$/.test(ch)
      )
        throw new Error('Channels must be 1–24 or ST1–ST3.');
      if (used.has(ch))
        throw new Error(`${channelName(ch)} is assigned more than once.`);
      used.add(ch);
      return ch;
    });
    return { ...s, name: s.name.trim(), channels };
  });
  return { version: 1, sources };
}
export type Channel = {
  id: string;
  label: string;
  group: 'speech' | 'voice' | 'music' | 'other' | 'fx';
  level: number;
  muted: boolean;
  kind?: Kind;
  sourceId?: string;
};
export type Mix = {
  mode: Mode;
  channels: Channel[];
  beforeMute: Channel[] | null;
};
export type Action =
  | { type: 'mode'; mode: Mode }
  | { type: 'adjust'; ids: string[]; delta: number }
  | { type: 'mute-all' }
  | { type: 'restore' };
export type Suggestion = {
  action: Action;
  title: string;
  titleZh: string;
  detail: string;
  detailZh: string;
};
export function initialMix(patch: Patch = examplePatch): Mix {
  const channels: Channel[] = Array.from({ length: 24 }, (_, i) => {
    const n = i + 1;
    const group: Channel['group'] = 'other';
    return {
      id: `ch${n}`,
      label: `CH ${n}`,
      group,
      level: -12,
      muted: true,
    };
  });
  for (let i = 1; i <= 3; i++)
    channels.push({
      id: `st${i}`,
      label: `Stereo ${i}`,
      group: 'other',
      level: -12,
      muted: true,
    });
  for (let i = 1; i <= 4; i++)
    channels.push({
      id: `fx${i}`,
      label: `FX return ${i}`,
      group: 'fx',
      level: -18,
      muted: i > 2,
    });
  return applyPatch({ mode: 'worship', channels, beforeMute: null }, patch);
}
export function applyPatch(mix: Mix, patch: Patch): Mix {
  if (mix.beforeMute) return mix;
  const valid = validatePatch(patch);
  const channels = mix.channels.map((c) => {
    if (c.group === 'fx') return c;
    const source = valid.sources.find((s) => s.channels.includes(c.id));
    return {
      ...c,
      label: source?.name || channelName(c.id),
      group: source?.role || ('other' as Channel['group']),
      sourceId: source?.id,
      kind: source?.kind,
      muted: true,
    };
  });
  return applyAction({ ...mix, channels }, { type: 'mode', mode: mix.mode });
}
export function applyAction(mix: Mix, action: Action): Mix {
  if (action.type === 'mute-all')
    return mix.beforeMute
      ? mix
      : {
          ...mix,
          beforeMute: mix.channels.map((c) => ({ ...c })),
          channels: mix.channels.map((c) => ({ ...c, muted: true })),
        };
  if (action.type === 'restore')
    return mix.beforeMute
      ? {
          ...mix,
          channels: mix.beforeMute.map((c) => ({ ...c })),
          beforeMute: null,
        }
      : mix;
  if (mix.beforeMute) return mix;
  if(action.type==='mode'&&action.mode==='desk')return {...mix,mode:'desk'};
  if (action.type === 'mode')
    return {
      ...mix,
      mode: action.mode,
      channels: mix.channels.map((c) => {
        if (c.group === 'other') return c;
        const active =
          action.mode === 'together'
            ? c.group === 'speech' ||
              c.group === 'voice' ||
              c.group === 'music' ||
              (c.group === 'fx' && ['fx1', 'fx2'].includes(c.id))
            : action.mode === 'speaking'
              ? c.group === 'speech'
              : c.group === 'voice' ||
                c.group === 'music' ||
                (c.group === 'fx' && ['fx1', 'fx2'].includes(c.id));
        return { ...c, muted: !active };
      }),
    };
  if (!Number.isFinite(action.delta) || Math.abs(action.delta) > 2) return mix;
  return {
    ...mix,
    channels: mix.channels.map((c) =>
      action.ids.includes(c.id) && !c.muted
        ? { ...c, level: Math.max(-48, Math.min(0, c.level + action.delta)) }
        : c,
    ),
  };
}
export function balanceIds(mix: Mix, group: 'voice' | 'music'): string[] {
  return mix.channels
    .filter(
      (c) =>
        !c.muted &&
        (group === 'voice'
          ? mix.mode === 'speaking'
            ? c.group === 'speech'
            : c.group === 'voice' ||
              ((mix.mode === 'together'||mix.mode==='desk') && c.group === 'speech')
          : c.group === 'music'),
    )
    .map((c) => c.id);
}
export function suggest(text: string, mix: Mix): Suggestion | null {
  const q = text.trim().toLowerCase();
  if (/^(mute all|mute everything|靜音全部|全部靜音)[.!。！]?$/.test(q))
    return {
      action: { type: 'mute-all' },
      title: 'Mute every input',
      titleZh: '全部輸入靜音',
      detail:
        'Mute all 24 mono inputs, 3 stereo inputs, and 4 FX returns. Their previous mute states are kept for Restore.',
      detailZh:
        '將 24 個單聲道、3 個立體聲輸入及 4 個效果返回靜音，並保留原有狀態以便還原。',
    };
  // Only unambiguous level requests are actionable in this first assistant.
  const increase =
    /(too quiet|louder|bring.*forward|more|increase|太小|大聲|提高|增加)/.test(
      q,
    );
  const decrease =
    /(too loud|softer|quieter|less|lower|reduce|太大|小聲|降低|減少)/.test(q);
  if (increase === decrease) return null;
  let targets: Channel[] = [];
  let label = '',
    labelZh = '';
  const matches = [
    [/piano|keyboard|鋼琴|鍵盤/, 'Piano', '鋼琴', ['piano']],
    [/guitar|吉他/, 'Guitar', '吉他', ['acoustic-guitar', 'electric-guitar']],
    [/bass|貝斯|低音吉他/, 'Bass', '貝斯', ['bass']],
    [/drum|鼓/, 'Drums', '鼓', ['drums']],
    [/pastor|speaker|牧師|講員/, 'Pastor', '講員', ['pastor']],
    [/playback|computer|播放|電腦/, 'Playback', '播放', ['playback']],
  ] as const;
  const named = matches.filter(([regex]) => regex.test(q));
  // A single destination and one source per request; monitor/EQ requests need more context.
  if (
    /monitor|in.?ear|stream|eq|harsh|muddy|feedback|監聽|耳機|直播|刺耳|混濁|回授/.test(
      q,
    ) ||
    named.length > 1
  )
    return null;
  const custom = [
    ...new Set(
      mix.channels
        .filter((c) => c.sourceId && q.includes(c.label.toLowerCase()))
        .map((c) => c.sourceId),
    ),
  ];
  if (custom.length > 1) return null;
  if (custom.length === 1) {
    targets = mix.channels.filter((c) => c.sourceId === custom[0]);
    label = targets[0].label;
    labelZh = label;
  } else if (named.length) {
    const [, en, zh, ids] = named[0];
    label = en;
    labelZh = zh;
    targets = mix.channels.filter(
      (c) => !!c.kind && (ids as readonly string[]).includes(c.kind),
    );
  } else if (/voice|vocal|sing|人聲|主唱|和聲/.test(q)) {
    label = 'Voices';
    labelZh = '人聲';
    const ids = balanceIds(mix, 'voice');
    targets = mix.channels.filter((c) => ids.includes(c.id));
  } else if (/music|band|instrument|音樂|樂團|樂器/.test(q)) {
    label = 'Music';
    labelZh = '樂器';
    targets = mix.channels.filter((c) => c.group === 'music');
  } else return null;
  targets = targets.filter((c) => !c.muted);
  if (!targets.length) return null;
  const delta = increase ? 1 : -1;
  const up = increase ? 'up' : 'down';
  return {
    action: { type: 'adjust', ids: targets.map((c) => c.id), delta },
    title: `${label} ${up} a little`,
    titleZh: `${labelZh}${increase ? '提高' : '降低'}一點`,
    detail: `Move ${targets.map((c) => c.label).join(', ')} ${up} 1 dB. Changes channel faders; post-fader destinations may also change.`,
    detailZh: `將 ${labelZh} 通道推桿${increase ? '提高' : '降低'} 1 dB。推桿後的輸出也可能受影響。`,
  };
}
