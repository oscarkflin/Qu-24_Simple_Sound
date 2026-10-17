export type Mode = 'speaking' | 'worship';
export type Channel = {
  id: string;
  label: string;
  group: 'speech' | 'voice' | 'music' | 'other' | 'fx';
  level: number;
  muted: boolean;
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
const labels: Record<number, string> = {
  1: 'Pastor',
  2: 'Lead vocal',
  3: 'Vocal 2',
  4: 'Vocal 3',
  9: 'Piano L',
  10: 'Piano R',
  11: 'Guitar',
  13: 'Drums L',
  14: 'Drums R',
};
export function initialMix(): Mix {
  const channels: Channel[] = Array.from({ length: 24 }, (_, i) => {
    const n = i + 1;
    const group: Channel['group'] =
      n === 1
        ? 'speech'
        : [2, 3, 4].includes(n)
          ? 'voice'
          : [9, 10, 11, 13, 14].includes(n)
            ? 'music'
            : 'other';
    return {
      id: `ch${n}`,
      label: labels[n] || `CH ${n}`,
      group,
      level: group === 'voice' ? -6 : group === 'speech' ? -8 : -12,
      muted: !['voice', 'music'].includes(group),
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
  return { mode: 'worship', channels, beforeMute: null };
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
  if (action.type === 'mode')
    return {
      ...mix,
      mode: action.mode,
      channels: mix.channels.map((c) => {
        if (c.group === 'other') return c;
        const active =
          action.mode === 'speaking'
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
            : c.group === 'voice'
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
    [/piano|keyboard|鋼琴|鍵盤/, 'Piano', '鋼琴', ['ch9', 'ch10']],
    [/guitar|吉他/, 'Guitar', '吉他', ['ch11']],
    [/drum|鼓/, 'Drums', '鼓', ['ch13', 'ch14']],
    [/pastor|speaker|牧師|講員/, 'Pastor', '講員', ['ch1']],
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
  if (named.length) {
    const [, en, zh, ids] = named[0];
    label = en;
    labelZh = zh;
    targets = mix.channels.filter((c) =>
      (ids as readonly string[]).includes(c.id),
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
