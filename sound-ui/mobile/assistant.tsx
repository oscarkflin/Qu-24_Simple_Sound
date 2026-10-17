import { useEffect, useState } from 'react';
import {
  AudioLines,
  Mic,
  Music2,
  VolumeX,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Settings2,
  Download,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  initialMix,
  applyAction,
  balanceIds,
  suggest,
  type Mix,
  type Action,
  type Suggestion,
  type Mode,
} from '@/lib/assistant-model';
import {
  createReport,
  downloadJson,
  logEvent,
  startDiagnostics,
} from '@/lib/diagnostics';
import './assistant.css';

export default function SoundAssistant() {
  const [mix, setMix] = useState(initialMix),
    [zh, setZh] = useState(false),
    [history, setHistory] = useState<Mix[]>([]);
  const [panel, setPanel] = useState<'ask' | 'settings' | 'restore' | null>(
      null,
    ),
    [request, setRequest] = useState(''),
    [proposal, setProposal] = useState<Suggestion | null>(null),
    [reply, setReply] = useState(''),
    [fileStatus, setFileStatus] = useState('');
  const [last, setLast] = useState({
    en: 'Voices and instruments are ready for worship.',
    zh: '人聲與樂器已準備好敬拜。',
  });
  const t = (en: string, cn: string) => (zh ? cn : en);
  const muted = !!mix.beforeMute;
  useEffect(() => {
    const stop = startDiagnostics();
    const status = (e: Event) =>
      setFileStatus((e as CustomEvent<string>).detail);
    window.addEventListener('sound-file-status', status);
    return () => {
      stop();
      window.removeEventListener('sound-file-status', status);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = zh ? 'zh-Hant' : 'en';
  }, [zh]);
  const act = (action: Action, en: string, cn: string) => {
    const next = applyAction(mix, action);
    if (next === mix) return;
    if (action.type !== 'mute-all' && action.type !== 'restore')
      setHistory((h) => [...h.slice(-19), mix]);
    setMix(next);
    setLast({ en, zh: cn });
    setProposal(null);
    logEvent('assistant.action', {
      action: action.type,
      ...(action.type === 'adjust'
        ? { ids: action.ids, delta: action.delta }
        : {}),
      mutedInputs: next.channels.filter((c) => c.muted).length,
    });
  };
  const mode = (value: Mode) =>
    act(
      { type: 'mode', mode: value },
      value === 'speaking'
        ? 'Pastor microphone ready. Worship channels muted.'
        : 'Worship voices and instruments ready. Pastor muted.',
      value === 'speaking'
        ? '講員麥克風已開啟，敬拜通道已靜音。'
        : '敬拜人聲與樂器已開啟，講員已靜音。',
    );
  const adjust = (group: 'voice' | 'music', delta: number) => {
    const ids = balanceIds(mix, group);
    if (!ids.length) return;
    act(
      { type: 'adjust', ids, delta },
      `${group === 'voice' ? 'Voices' : 'Instruments'} ${delta > 0 ? 'raised' : 'lowered'} 1 dB.`,
      `${group === 'voice' ? '人聲' : '樂器'}已${delta > 0 ? '提高' : '降低'} 1 dB。`,
    );
  };
  const ask = (value: string) => {
    setRequest(value);
    const answer = suggest(value, mix);
    setProposal(answer);
    setReply(
      answer
        ? ''
        : t(
            'Try one clear level request, such as “piano too loud.” Muted sources stay muted. Monitor and tone changes need a listening check first.',
            '請描述單一音量問題，例如「鋼琴太大」。已靜音的通道會保持靜音。監聽或音色調整需要先確認聽感。',
          ),
    );
    logEvent('assistant.request', { matched: !!answer });
  };
  return (
    <div className={'assistant-app ' + (muted ? 'is-muted' : '')}>
      <header className="assistant-header">
        <div className="assistant-brand">
          <AudioLines size={23} />
          <span>Sunday Sound</span>
        </div>
        <button
          className="assistant-icon"
          aria-label={t('Options', '選項')}
          onClick={() => setPanel('settings')}
        >
          <Settings2 size={20} />
        </button>
      </header>
      <div className="assistant-demo">
        <span />
        {t('DEMO · No mixer connected', '示範 · 尚未連接混音器')}
      </div>
      <main className="assistant-main">
        <section className="assistant-intro">
          <p>{t('ONE THING AT A TIME', '一次做好一件事')}</p>
          <h1>
            {muted
              ? t('Everything is muted.', '全部已靜音。')
              : t('Let’s take care of sound.', '一起照顧好聲音。')}
          </h1>
        </section>
        <div
          className="assistant-modes"
          role="group"
          aria-label={t('Service mode', '聚會模式')}
        >
          <button
            disabled={muted}
            aria-pressed={mix.mode === 'speaking'}
            onClick={() => mode('speaking')}
          >
            <Mic size={26} />
            <span>{t('Speaking', '講道')}</span>
            <small>{t('Pastor mic', '講員麥克風')}</small>
          </button>
          <button
            disabled={muted}
            aria-pressed={mix.mode === 'worship'}
            onClick={() => mode('worship')}
          >
            <Music2 size={26} />
            <span>{t('Worship', '敬拜')}</span>
            <small>{t('Voices + music', '人聲與樂器')}</small>
          </button>
        </div>
        <section className="assistant-status" aria-live="polite">
          <span className="assistant-status-icon">
            {muted ? <VolumeX size={19} /> : <Check size={19} />}
          </span>
          <div>
            <strong>
              {muted
                ? t('All input channels muted', '所有輸入通道已靜音')
                : t(last.en, last.zh)}
            </strong>
            <p>
              {muted
                ? t(
                    'Previous channel states are saved for Restore.',
                    '已保留先前通道狀態，可隨時還原。',
                  )
                : t('Sample channel changes only.', '目前僅變更範例通道。')}
            </p>
          </div>
        </section>
        <div className="assistant-balance">
          <button
            disabled={muted || !balanceIds(mix, 'voice').length}
            onClick={() => adjust('voice', 1)}
          >
            <ArrowUp size={20} />
            {t('More voice', '人聲大一點')}
          </button>
          <button
            disabled={muted || !balanceIds(mix, 'music').length}
            onClick={() => adjust('music', -1)}
          >
            <ArrowDown size={20} />
            {t('Less music', '樂器小一點')}
          </button>
        </div>
        <button
          className="assistant-ask"
          disabled={muted}
          onClick={() => {
            setProposal(null);
            setRequest('');
            setReply('');
            setPanel('ask');
          }}
        >
          <Sparkles size={23} />
          <span>
            <strong>{t('Help me balance', '幫我調整平衡')}</strong>
            <small>
              {t('Tell me what needs changing', '告訴我哪裡需要調整')}
            </small>
          </span>
          <ArrowRight size={20} />
        </button>
        <button
          className="assistant-undo"
          disabled={muted || !history.length}
          onClick={() => {
            const previous = history.at(-1);
            if (previous) {
              setMix(previous);
              setHistory((h) => h.slice(0, -1));
              setLast({
                en: 'Last adjustment undone.',
                zh: '已復原上一個調整。',
              });
              logEvent('assistant.undo');
            }
          }}
        >
          <RotateCcw size={16} />
          {t('Undo last adjustment', '復原上一個調整')}
        </button>
      </main>
      <footer className="assistant-footer">
        <button
          className={'assistant-mute ' + (muted ? 'restore' : '')}
          onClick={() => {
            if (muted) setPanel('restore');
            else {
              setPanel(null);
              act(
                { type: 'mute-all' },
                'All inputs muted.',
                '全部輸入已靜音。',
              );
            }
          }}
        >
          {muted ? <RotateCcw size={24} /> : <VolumeX size={24} />}
          <span>
            {muted ? t('Restore sound', '還原聲音') : t('Mute all', '全部靜音')}
          </span>
        </button>
        <p>
          {t(
            'Every input channel · including stereo inputs & FX returns',
            '所有輸入通道 · 包含立體聲與效果返回',
          )}
        </p>
      </footer>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="assistant-dialog">
          <DialogTitle>
            {panel === 'ask'
              ? t('What needs changing?', '哪裡需要調整？')
              : panel === 'restore'
                ? t('Restore the previous sound?', '還原先前的聲音？')
                : t('A simpler Sunday.', '讓主日更簡單。')}
          </DialogTitle>
          <DialogDescription>
            {panel === 'ask'
              ? t(
                  'Describe one level change. I’ll show you before applying it.',
                  '描述單一音量調整，套用前會先讓您確認。',
                )
              : panel === 'restore'
                ? t(
                    'Channels that were open will reopen. Channels already muted will stay muted.',
                    '先前開啟的通道將重新開啟，原本靜音的通道會保持靜音。',
                  )
                : t(
                    'Offline demo · sample channel assignments',
                    '離線示範 · 範例通道配置',
                  )}
          </DialogDescription>
          {panel === 'ask' && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(request);
                }}
              >
                <label className="assistant-request">
                  {t('Your request', '您的需求')}
                  <input
                    value={request}
                    maxLength={200}
                    onChange={(e) => {
                      setRequest(e.target.value);
                      setProposal(null);
                      setReply('');
                    }}
                    placeholder={t('e.g. piano too loud', '例如：鋼琴太大')}
                    autoComplete="off"
                  />
                </label>
                <button
                  className="assistant-primary"
                  disabled={!request.trim() || muted}
                  type="submit"
                >
                  {t('Suggest a change', '建議調整')}
                </button>
              </form>
              <div className="assistant-examples">
                {[
                  ['Piano too loud', '鋼琴太大'],
                  ['Vocals too quiet', '人聲太小'],
                  ['Guitar too loud', '吉他太大'],
                ].map(([en, cn]) => (
                  <button
                    disabled={muted}
                    key={en}
                    onClick={() => ask(t(en, cn))}
                  >
                    {t(en, cn)}
                  </button>
                ))}
              </div>
              {reply && <p role="status">{reply}</p>}
              {proposal && (
                <section className="assistant-proposal">
                  <h3>{t(proposal.title, proposal.titleZh)}</h3>
                  <p>{t(proposal.detail, proposal.detailZh)}</p>
                  <button
                    className="assistant-primary"
                    disabled={muted}
                    onClick={() => {
                      act(proposal.action, proposal.title, proposal.titleZh);
                      setPanel(null);
                    }}
                  >
                    {t('Apply this change', '套用此調整')}
                  </button>
                </section>
              )}
              <p className="assistant-small">
                {t(
                  'This demo uses simple request rules. Voice listening and automatic balancing come later.',
                  '此示範使用簡單需求規則，語音偵測與自動平衡將於後續提供。',
                )}
              </p>
            </>
          )}
          {panel === 'restore' && (
            <>
              <button
                className="assistant-primary"
                onClick={() => {
                  act(
                    { type: 'restore' },
                    'Previous channel states restored.',
                    '已還原先前通道狀態。',
                  );
                  setPanel(null);
                }}
              >
                {t('Restore previous channels', '還原先前的通道')}
              </button>
              <button
                className="assistant-secondary"
                onClick={() => setPanel(null)}
              >
                {t('Keep muted', '保持靜音')}
              </button>
            </>
          )}
          {panel === 'settings' && (
            <>
              <button
                className="assistant-secondary"
                onClick={() => setZh((v) => !v)}
              >
                {zh ? 'English' : '繁體中文'}
              </button>
              <div className="assistant-about">
                <p>
                  {t(
                    'Mute all covers 24 mono inputs, 3 stereo inputs, and 4 FX returns—even those outside the sample worship group. Output master levels are left as they were.',
                    '全部靜音包含 24 個單聲道、3 個立體聲輸入與 4 個效果返回，包括範例敬拜群組以外的通道。輸出主推桿保持原位。',
                  )}
                </p>
                <p>
                  {t(
                    'The assistant is not listening to audio yet. Speaking and Worship use example channel assignments.',
                    '助理尚未聆聽音訊。講道與敬拜使用範例通道配置。',
                  )}
                </p>
              </div>
              <button
                className="assistant-secondary"
                onClick={() => {
                  downloadJson(
                    'sunday-sound-report.json',
                    createReport({ experience: 'simple-assistant', mix }, ''),
                  );
                }}
              >
                <Download size={18} />
                {t('Share diagnostic report', '分享診斷報告')}
              </button>
              {fileStatus && <p role="status">{fileStatus}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
