'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Download,
  Upload,
  ShieldCheck,
  SlidersHorizontal,
  Activity,
  Monitor,
  ChevronRight,
  LockKeyhole,
  Save,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  type Assignment,
  type Profile,
  validateProfile,
} from '@/lib/channel-profile';
import {
  BUILD_ID,
  createReport,
  downloadJson,
  getEvents,
  logEvent,
  scrub,
} from '@/lib/diagnostics';
import { ConnectionPanel } from '@/components/connection-panel';

type Props = {
  zh: boolean;
  profile: Profile;
  onSave: (p: Profile) => void;
  onMix: () => void;
  state: unknown;
  storageReady: boolean;
  storageWarning: string;
};
const roles = ['Pastor', 'Lead vocal', 'Vocals', 'Keyboard', 'Guitar', 'Drums'];
const rolesZh = ['牧師', '主唱', '和聲', '鍵盤', '吉他', '鼓'];
export function QuickSetup({
  zh,
  profile,
  onSave,
  onMix,
  state,
  storageReady,
  storageWarning,
}: Props) {
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [admin, setAdmin] = useState(true),
    [draft, setDraft] = useState(profile),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [support, setSupport] = useState(false),
    [note, setNote] = useState(''),
    [includeLabels, setIncludeLabels] = useState(false),
    [logCount, setLogCount] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const [fileStatus, setFileStatus] = useState('');
  useEffect(() => {
    const listener = (e: Event) =>
      setFileStatus((e as CustomEvent<string>).detail);
    window.addEventListener('sound-file-status', listener);
    return () => window.removeEventListener('sound-file-status', listener);
  }, []);
  useEffect(() => {
    setDraft(profile);
  }, [profile]);
  useEffect(() => {
    const update = () => setLogCount(getEvents().length);
    update();
    window.addEventListener('sound-diagnostics', update);
    return () => window.removeEventListener('sound-diagnostics', update);
  }, []);
  const update = (id: number, patch: Partial<Assignment>) => {
    setSaved(false);
    setError('');
    setDraft((p) => ({
      ...p,
      assignments: p.assignments.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    }));
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const save = () => {
    try {
      const p = validateProfile(draft);
      onSave(p);
      setSaved(true);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      logEvent(
        'profile.validation-failed',
        { message: scrub((e as Error).message) },
        'error',
      );
    }
  };
  return (
    <>
      <div className="page-heading setup-heading">
        <div>
          <p className="eyebrow">
            {t('YOUR TEAM. YOUR CONSOLE.', '您的團隊，您的混音台。')}
          </p>
          <h1>{t('Make the console yours.', '讓混音台，貼近您的團隊。')}</h1>
          <p>
            {t(
              'Give each source a name. Match it to the channels at church.',
              '為每個聲音命名，對應教會的輸入通道。',
            )}
          </p>
        </div>
        <button
          className={'mode-button ' + (admin ? 'admin-on' : '')}
          onClick={() => setAdmin((a) => !a)}
        >
          {admin ? <ShieldCheck size={18} /> : <LockKeyhole size={18} />}{' '}
          {admin
            ? t('Admin setup', '管理員設定')
            : t('Operator view', '操作員檢視')}
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="setup-grid">
        <section className="panel mapping-panel">
          <div className="mapping-title">
            <div>
              <h2>{t('Channel map', '通道配置')}</h2>
              <p>
                {t(
                  'Names follow you into Quick mix, Monitors, and Livestream.',
                  '名稱會同步顯示於快速混音、監聽和直播。',
                )}
              </p>
            </div>
            <span className="preview-chip">{t('6 sources', '6 個聲音')}</span>
          </div>
          <div className="mapping-scroll">
            <table className="mapping-table">
              <thead>
                <tr>
                  <th>{t('SOURCE', '來源')}</th>
                  <th>{t('DISPLAY NAME', '顯示名稱')}</th>
                  <th>{t('QU CHANNELS', 'QU 通道')}</th>
                  <th>{t('QUICK MIX TAB', '快速混音分頁')}</th>
                </tr>
              </thead>
              <tbody>
                {draft.assignments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className={'source-marker marker-' + a.id} />
                      {zh ? rolesZh[a.id] : roles[a.id]}
                    </td>
                    <td>
                      <input
                        aria-label={`${roles[a.id]} display name`}
                        maxLength={40}
                        disabled={!admin || !storageReady}
                        value={a.label}
                        placeholder={zh ? rolesZh[a.id] : roles[a.id]}
                        onChange={(e) =>
                          update(a.id, { label: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <div className="channel-input">
                        <span>CH</span>
                        <input
                          aria-label={`${roles[a.id]} channels`}
                          value={a.channels}
                          maxLength={100}
                          disabled={!admin || !storageReady}
                          onChange={(e) =>
                            update(a.id, { channels: e.target.value })
                          }
                        />
                      </div>
                    </td>
                    <td>
                      <Select
                        value={a.group}
                        disabled={!admin || !storageReady}
                        onValueChange={(v) => {
                          if (v) update(a.id, { group: v });
                        }}
                      >
                        <SelectTrigger
                          aria-label={`${roles[a.id]} quick mix tab`}
                        >
                          <SelectValue>
                            {a.group === 'speech'
                              ? t('Speech', '講員')
                              : a.group === 'vocals'
                                ? t('Vocals', '人聲')
                                : t('Instruments', '樂器')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="speech">
                            {t('Speech', '講員')}
                          </SelectItem>
                          <SelectItem value="vocals">
                            {t('Vocals', '人聲')}
                          </SelectItem>
                          <SelectItem value="instruments">
                            {t('Instruments', '樂器')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && (
            <p className="mapping-error" role="alert">
              {t(
                error,
                '配置無效：請使用 1–24 的通道編號，以逗號分隔，且不可重複。',
              )}
            </p>
          )}
          <div className="mapping-footer">
            <span className={saved ? 'mint' : 'subtle'}>
              {saved ? (
                <>
                  <Check size={16} />
                  {t('Layout applied', '配置已套用')}
                </>
              ) : dirty ? (
                t('Unsaved changes', '有尚未儲存的變更')
              ) : (
                t(
                  'Example patching · confirm at church',
                  '範例配置，請於教會確認',
                )
              )}
            </span>
            <button
              className="primary"
              disabled={!admin || !storageReady || !dirty}
              onClick={save}
            >
              <Save size={17} />
              {t('Save layout', '儲存配置')}
            </button>
          </div>
        </section>
        <aside className="setup-aside">
          <section className="panel host-summary">
            <div className="section-title">
              <h2>
                <Monitor size={18} />
                {t('Local workspace', '本機工作區')}
              </h2>
              <span className="demo-dot" />
            </div>
            <strong>{t('Main Sanctuary', '主堂')}</strong>
            <p>
              {t(
                'UI preview · Mixer not connected',
                '介面預覽，混音器尚未連線',
              )}
            </p>
            <div className="setting-row">
              <span>{t('Interface', '介面')}</span>
              <span className="mint">{t('Ready to review', '可供檢視')}</span>
            </div>
            <div className="setting-row">
              <span>{t('Channel map', '通道配置')}</span>
              <span>{t('Sample data', '範例資料')}</span>
            </div>
            <button className="primary" onClick={onMix} disabled={dirty}>
              <SlidersHorizontal size={17} />
              {t('Open Quick mix', '開啟快速混音')}
              <ArrowRight size={17} />
            </button>
          </section>
          <button className="diagnostic-card" onClick={() => setSupport(true)}>
            <Activity size={23} />
            <div>
              <h2>{t('Bring the details back.', '把問題細節帶回來。')}</h2>
              <p>
                {t(
                  'Download a report after a church test.',
                  '現場測試後，下載診斷報告。',
                )}
              </p>
            </div>
            <ChevronRight size={18} />
          </button>
          <section className="layout-files">
            <h3>{t('Take this layout with you', '帶著配置到另一台裝置')}</h3>
            <div>
              <button
                className="secondary"
                disabled={dirty}
                onClick={() =>
                  downloadJson('sunday-sound-layout.json', profile)
                }
              >
                <Download size={16} />
                {t('Export', '匯出')}
              </button>
              <button
                className="secondary"
                disabled={!admin}
                onClick={() => file.current?.click()}
              >
                <Upload size={16} />
                {t('Import', '匯入')}
              </button>
            </div>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 32000)
                    throw new Error('Profile file is too large.');
                  setDraft(validateProfile(JSON.parse(await f.text())));
                  setSaved(false);
                  setError('');
                  logEvent('profile.import-staged');
                } catch (err) {
                  setError(scrub((err as Error).message));
                }
                e.target.value = '';
              }}
            />
            <p>
              {t(
                'Layout files include your display names.',
                '配置檔案會包含您輸入的顯示名稱。',
              )}
            </p>
          </section>
        </aside>
      </div>
      {fileStatus && (
        <p className="file-status" role="status">
          {fileStatus}
        </p>
      )}
      <ConnectionPanel zh={zh} />
      <div className="setup-footnote">
        <ShieldCheck size={16} />
        {t(
          'Admin is an editing mode in this prototype. Access protection is planned for a later version.',
          '此原型的管理員僅為編輯模式，存取權限保護將於後續版本加入。',
        )}
      </div>
      {storageWarning && (
        <p className="mapping-error" role="alert">
          {storageWarning}
        </p>
      )}
      <Dialog open={support} onOpenChange={setSupport}>
        <DialogContent className="sound-dialog">
          <DialogTitle>
            {t('A useful report for later.', '留下診斷報告，方便後續分析。')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Saved on this device. Nothing is uploaded automatically.',
              '資料儲存於此裝置，不會自動上傳。',
            )}
          </DialogDescription>
          <div className="report-meta">
            <span>{BUILD_ID}</span>
            <span>
              {logCount} {t('recent events', '筆近期事件')}
            </span>
          </div>
          <p>
            {t(
              'Includes browser errors, recent actions, screen size, app version, and sample mixer state. Mixer errors require future hardware integration.',
              '包含瀏覽器錯誤、近期操作、畫面大小、版本與範例狀態。尚未建立橋接服務，因此無法記錄 Qu-24 錯誤。',
            )}
          </p>
          <label className="report-note">
            {t('What happened?', '發生了什麼問題？')}
            <textarea
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(
                'Example: the monitor slider stopped responding after the iPad woke up.',
                '例如：iPad 喚醒後，監聽推桿無法操作。',
              )}
            />
          </label>
          <label className="lineup-choice">
            <Checkbox
              checked={includeLabels}
              onCheckedChange={(v) => setIncludeLabels(!!v)}
            />
            {t('Include my channel display names', '包含通道顯示名稱')}
          </label>
          <button
            className="primary"
            onClick={() => {
              logEvent('diagnostics.exported');
              downloadJson(
                `sunday-sound-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
                createReport(
                  {
                    ui: state,
                    profile: {
                      ...profile,
                      assignments: profile.assignments.map((a) => ({
                        ...a,
                        label: includeLabels ? a.label : '[omitted]',
                      })),
                    },
                  },
                  note,
                ),
              );
            }}
          >
            <Download size={18} />
            {t('Download report', '下載報告')}
          </button>
          <p className="subtle">
            {t(
              'Review the file before sharing. Free-text notes and errors may contain details you entered.',
              '分享前請先檢查檔案，自由輸入的備註及錯誤可能包含您輸入的資料。',
            )}
          </p>
          {fileStatus && <p role="status">{fileStatus}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
