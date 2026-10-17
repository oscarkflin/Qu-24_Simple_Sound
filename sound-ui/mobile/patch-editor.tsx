import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  kinds,
  parseChannels,
  validatePatch,
  type Patch,
  type PatchSource,
} from '@/lib/assistant-model';

type Draft = Omit<PatchSource, 'channels'> & { channelsText: string };
export function PatchEditor({
  patch,
  zh,
  onSave,
  onCancel,
}: {
  patch: Patch;
  zh: boolean;
  onSave: (patch: Patch) => void;
  onCancel: () => void;
}) {
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [rows, setRows] = useState<Draft[]>(() =>
    patch.sources.map(({ channels, ...s }) => ({
      ...s,
      channelsText: channels
        .map((c) => (c.startsWith('ch') ? c.slice(2) : c.toUpperCase()))
        .join(', '),
    })),
  );
  const [error, setError] = useState('');
  const update = (id: string, changes: Partial<Draft>) => {
    setRows((list) =>
      list.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    );
    setError('');
  };
  function save() {
    try {
      const valid = validatePatch({
        version: 1,
        sources: rows.map(({ channelsText, ...s }) => ({
          ...s,
          channels: parseChannels(channelsText),
        })),
      });
      onSave(valid);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="patch-editor">
      <p className="assistant-small">
        {t(
          'Name each source, choose its instrument and role, then enter the real Qu channels. Use 9, 10 for a stereo pair or ST1 for a stereo input.',
          '為每個來源命名，選擇樂器與角色，再輸入實際 Qu 通道。立體聲對可輸入 9, 10，立體聲輸入可用 ST1。',
        )}
      </p>
      <div className="patch-rows">
        {rows.map((s, index) => (
          <fieldset className="patch-source" key={s.id}>
            <legend>
              {t('Source', '來源')} {index + 1}
            </legend>
            <div className="patch-source-heading">
              <label>
                {t('Name', '名稱')}
                <input
                  aria-label={`Source ${index + 1} name`}
                  value={s.name}
                  maxLength={40}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                  placeholder={t('e.g. Yamaha piano', '例如：Yamaha 鋼琴')}
                />
              </label>
              <button
                className="patch-remove"
                aria-label={`Remove source ${index + 1}`}
                onClick={() => {
                  setRows((list) => list.filter((row) => row.id !== s.id));
                  setError('');
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
            <label>
              {t('Instrument / microphone', '樂器／麥克風')}
              <Select
                value={s.kind}
                onValueChange={(value) => {
                  const next = kinds.find((k) => k.value === value);
                  if (next) {
                    const previous = kinds.find((k) => k.value === s.kind);
                    update(s.id, {
                      kind: next.value,
                      role: next.role,
                      ...(!s.name || s.name === previous?.en
                        ? { name: next.en }
                        : {}),
                    });
                  }
                }}
              >
                <SelectTrigger aria-label={`Source ${index + 1} instrument`}>
                  <SelectValue>
                    {zh
                      ? kinds.find((k) => k.value === s.kind)?.zh
                      : kinds.find((k) => k.value === s.kind)?.en}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {t(k.en, k.zh)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="patch-pair">
              <label>
                {t('Qu channels', 'Qu 通道')}
                <input
                  aria-label={`Source ${index + 1} channels`}
                  value={s.channelsText}
                  maxLength={100}
                  onChange={(e) =>
                    update(s.id, { channelsText: e.target.value })
                  }
                  placeholder="9, 10"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
              </label>
              <label>
                {t('Role', '角色')}
                <Select
                  value={s.role}
                  onValueChange={(value) => {
                    if (
                      value === 'speech' ||
                      value === 'voice' ||
                      value === 'music'
                    )
                      update(s.id, { role: value });
                  }}
                >
                  <SelectTrigger aria-label={`Source ${index + 1} role`}>
                    <SelectValue>
                      {s.role === 'speech'
                        ? t('Speaking', '講員')
                        : s.role === 'voice'
                          ? t('Vocal', '人聲')
                          : t('Instrument', '樂器')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="speech">
                      {t('Speaking', '講員')}
                    </SelectItem>
                    <SelectItem value="voice">{t('Vocal', '人聲')}</SelectItem>
                    <SelectItem value="music">
                      {t('Instrument', '樂器')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          </fieldset>
        ))}
      </div>
      <button
        className="assistant-secondary"
        disabled={rows.length >= 27}
        onClick={() => {
          setRows((list) => [
            ...list,
            {
              id: crypto.randomUUID(),
              name: '',
              kind: 'other',
              role: 'music',
              channelsText: '',
            },
          ]);
          setError('');
        }}
      >
        <Plus size={18} />
        {t('Add instrument or microphone', '新增樂器或麥克風')}
      </button>
      {error && (
        <p className="patch-error" role="alert">
          {zh
            ? '無法儲存，請確認名稱與通道（1–24 或 ST1–ST3），且不可重複。 '
            : ''}
          {error}
        </p>
      )}
      <div className="patch-save">
        <button className="assistant-primary" onClick={save}>
          <Save size={18} />
          {t('Save my patch', '儲存我的配置')}
        </button>
        <button className="assistant-secondary" onClick={onCancel}>
          {t('Cancel', '取消')}
        </button>
      </div>
      <p className="assistant-small">
        {t(
          'Speaking opens your speaking sources. Worship opens vocals and instruments. Together opens all assigned sources. Unassigned inputs stay muted. Saving applies the current mode to the demo.',
          '講道開啟講員來源；敬拜開啟人聲與樂器；一起使用開啟所有已配置來源。未配置的輸入保持靜音。儲存會將目前模式套用至示範。',
        )}
      </p>
    </div>
  );
}
