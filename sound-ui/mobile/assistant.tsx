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
  Users,
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
  examplePatch,
  validatePatch,
  applyPatch,
  PATCH_KEY,
  channelName,
  type Patch,
} from '@/lib/assistant-model';
import { PatchEditor } from './patch-editor';
import { QuSession, type ConnectionState } from '@/lib/qu-session';
import { QuConnection } from './qu-connection';
import { EnableControl } from './enable-control';
import { AutoBalanceControl } from './auto-balance';
import { Checkbox } from '@/components/ui/checkbox';
import {
  createReport,
  downloadJson,
  logEvent,
  startDiagnostics,
} from '@/lib/diagnostics';
import './assistant.css';

export default function SoundAssistant() {
  const [connection, setConnection] = useState<ConnectionState>({
    phase: 'demo',
    message: 'Demo; no mixer connection',
    observed: {},
    busy: false,
    canUndo: false,
    revision: 0,
  });
  const [qu] = useState(() => new QuSession(setConnection));
  const [actionError, setActionError] = useState(''),
    [reportNote, setReportNote] = useState(''),
    [rawTrace, setRawTrace] = useState(false);
  const [initial] = useState(() => {
    try {
      const saved = localStorage.getItem(PATCH_KEY);
      return {
        patch: saved ? validatePatch(JSON.parse(saved)) : examplePatch,
        saved: !!saved,
        error: '',
      };
    } catch {
      return {
        patch: examplePatch,
        saved: false,
        error:
          'Saved patch could not be loaded. Example assignments are shown.',
      };
    }
  });
  const [patch, setPatch] = useState<Patch>(initial.patch);
  const [savedPatch, setSavedPatch] = useState(initial.saved);
  const [patchWarning, setPatchWarning] = useState(initial.error);
  const [mix, setMix] = useState(() => initialMix(initial.patch)),
    [zh, setZh] = useState(false),
    [history, setHistory] = useState<Mix[]>([]);
  const [panel, setPanel] = useState<
      'ask' | 'settings' | 'restore' | 'patch' | null
    >(null),
    [request, setRequest] = useState(''),
    [proposal, setProposal] = useState<Suggestion | null>(null),
    [reply, setReply] = useState(''),
    [fileStatus, setFileStatus] = useState('');
  const [last, setLast] = useState({
    en: initial.saved
      ? 'Your saved patch is ready for worship.'
      : 'Using the example patch. Set up your channels in Options.',
    zh: initial.saved
      ? '已載入您的配置，可進行敬拜。'
      : '目前使用範例配置，請在選項中設定您的通道。',
  });
  const t = (en: string, cn: string) => (zh ? cn : en);
  const controlEnabled = () => {
    setPanel(null);
    setLast({
      en: 'Control enabled. The desk’s current settings are unchanged.',
      zh: '已啟用控制，混音台目前設定保持不變。',
    });
  };
  const muted = !!mix.beforeMute;
  const allInputsMuted = mix.channels.every((c) => c.muted);
  const blocked =
    (connection.phase !== 'demo' && connection.phase !== 'live') ||
    connection.busy;
  useEffect(() => {
    void qu.start().catch((e) => setActionError((e as Error).message));
    return () => {
      void qu.stop();
    };
  }, [qu]);
  useEffect(() => {
    if (connection.phase === 'live' || connection.phase === 'readonly')
      setMix((current) => qu.observedMix(current));
    if (connection.phase === 'connecting') {
      setMix((current) => ({ ...current, beforeMute: null, mode: 'desk' }));
      setHistory([]);
    }
  }, [connection.revision]);
  const savePatch = (value: Patch) => {
    if (muted || connection.phase !== 'demo')
      throw new Error('Return to demo before changing the patch.');
    localStorage.setItem(PATCH_KEY, JSON.stringify(value));
    setPatch(value);
    setSavedPatch(true);
    setPatchWarning('');
    setMix((current) => applyPatch(current, value));
    setHistory([]);
    setProposal(null);
    setLast({
      en: 'Your patch is saved. Current mode applied.',
      zh: '已儲存您的配置，並套用目前模式。',
    });
    setPanel('settings');
    logEvent('assistant.patch-saved', { sourceCount: value.sources.length });
  };
  const shareReport = async () => {
    try {
      logEvent('diagnostics.exported', { rawTrace, phase: connection.phase });
      const native = await qu.diagnostics(rawTrace);
      downloadJson(
        `sunday-sound-report-${Date.now()}.json`,
        createReport(
          {
            experience: 'simple-assistant',
            connection: { ...qu.state },
            native,
            patch: {
              ...patch,
              sources: patch.sources.map((s) => ({ ...s, name: '[omitted]' })),
            },
            mix: {
              ...mix,
              channels: mix.channels.map((c) => ({
                ...c,
                label: channelName(c.id),
              })),
              beforeMute:
                mix.beforeMute?.map((c) => ({
                  ...c,
                  label: channelName(c.id),
                })) || null,
            },
          },
          reportNote,
          connection.phase === 'demo' ? 'demo' : `qu24-${connection.phase}`,
        ),
      );
    } catch (e) {
      setFileStatus('Report could not be prepared: ' + (e as Error).message);
      logEvent(
        'diagnostics.prepare-failed',
        { message: (e as Error).message },
        'error',
      );
    }
  };
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
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>('.assistant-dialog')
        ?.scrollTo({ top: 0, behavior: 'instant' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [panel]);
  const act = async (action: Action, en: string, cn: string) => {
    setActionError('');
    if (connection.phase !== 'demo') {
      try {
        const next = await qu.run(action, mix);
        setMix(next);
        setLast({
          en: en + ' Mixer readback confirmed.',
          zh: cn + '已收到混音台回報。',
        });
        setProposal(null);
      } catch (e) {
        setActionError((e as Error).message);
        logEvent(
          'qu.ui.action-failed',
          { action: action.type, message: (e as Error).message },
          'error',
        );
      }
      return;
    }
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
        ? 'Speaking microphones ready. Worship channels muted.'
        : value === 'together'
          ? 'Speaking, vocals, and instruments are ready together.'
          : 'Worship voices and instruments ready. Speaking channels muted.',
      value === 'speaking'
        ? '講員麥克風已開啟，敬拜通道已靜音。'
        : value === 'together'
          ? '講員、人聲與樂器已一起開啟。'
          : '敬拜人聲與樂器已開啟，講員已靜音。',
    );
  const adjust = (group: 'voice' | 'music', delta: number) => {
    const ids = balanceIds(mix, group);
    if (!ids.length) return;
    act(
      { type: 'adjust', ids, delta },
      `${group === 'voice' ? 'Voices' : 'Instruments'} ${delta > 0 ? 'raised' : 'lowered'} ${connection.phase === 'live' ? 'about ' : ''}1 dB.`,
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
        {connection.phase === 'demo'
          ? t('DEMO · No mixer connected', '示範 · 尚未連接混音器')
          : connection.phase === 'live'
            ? t('LIVE · Qu-24 channel control', '即時 · Qu-24 通道控制')
            : connection.phase === 'readonly'
              ? qu.complete()
                ? t(
                    'CONNECTED · Ready to enable control',
                    '已連線 · 可以啟用控制',
                  )
                : t(
                    'Control unavailable · Check connection',
                    '無法控制 · 請檢查連線',
                  )
              : t('Mixer controls paused', '混音器控制已暫停')}
      </div>
      {panel === null && (
        <EnableControl
          session={qu}
          state={connection}
          zh={zh}
          onEnabled={controlEnabled}
        />
      )}
      {actionError && (
        <p role="alert" className="patch-error">
          {actionError}
        </p>
      )}
      {connection.phase !== 'demo' && connection.phase !== 'live' && (
        <p className="assistant-small" role="status">
          {connection.message}
        </p>
      )}
      <main className="assistant-main">
        <section className="assistant-intro">
          <p>{t('ONE THING AT A TIME', '一次做好一件事')}</p>
          <h1>
            {muted
              ? allInputsMuted
                ? t('Everything is muted.', '全部已靜音。')
                : t('The desk has changed.', '混音台狀態已變更。')
              : t('Let’s take care of sound.', '一起照顧好聲音。')}
          </h1>
        </section>
        <div
          className="assistant-modes"
          role="group"
          aria-label={t('Service mode', '聚會模式')}
        >
          <button
            disabled={muted || blocked}
            aria-pressed={mix.mode === 'speaking'}
            onClick={() => mode('speaking')}
          >
            <Mic size={26} />
            <span>{t('Speaking', '講道')}</span>
            <small>{t('Speaking mics', '講員麥克風')}</small>
          </button>
          <button
            className="assistant-together"
            disabled={muted || blocked}
            aria-pressed={mix.mode === 'together'}
            onClick={() => mode('together')}
          >
            <Users size={21} />
            <span>{t('Together', '一起使用')}</span>
            <small>{t('Speaking + worship', '講員與敬拜')}</small>
          </button>
          <button
            disabled={muted || blocked}
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
                ? allInputsMuted
                  ? t('All input channels muted', '所有輸入通道已靜音')
                  : t(
                      'An input was reopened on the desk. Check the console.',
                      '混音台上有輸入重新開啟，請確認控制台。',
                    )
                : t(last.en, last.zh)}
            </strong>
            <p>
              {muted
                ? t(
                    'Previous channel states are saved for Restore.',
                    '已保留先前通道狀態，可隨時還原。',
                  )
                : connection.phase === 'demo'
                  ? t('Sample channel changes only.', '目前僅變更範例通道。')
                  : t(connection.message, '混音台狀態已同步，詳情請見設定。')}
            </p>
          </div>
        </section>
        <AutoBalanceControl
          session={qu}
          state={connection}
          mix={mix}
          savedPatch={savedPatch}
          zh={zh}
        />
        <div className="assistant-balance">
          <button
            disabled={muted || blocked || !balanceIds(mix, 'voice').length}
            onClick={() => adjust('voice', 1)}
          >
            <ArrowUp size={20} />
            {t('More voice', '人聲大一點')}
          </button>
          <button
            disabled={muted || blocked || !balanceIds(mix, 'music').length}
            onClick={() => adjust('music', -1)}
          >
            <ArrowDown size={20} />
            {t('Less music', '樂器小一點')}
          </button>
        </div>
        <button
          className="assistant-ask"
          disabled={muted || blocked}
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
          disabled={
            muted ||
            blocked ||
            (connection.phase === 'live'
              ? !connection.canUndo
              : !history.length)
          }
          onClick={async () => {
            if (connection.phase === 'live') {
              try {
                setMix(await qu.undo(mix));
                setLast({
                  en: 'Last live adjustment undone and confirmed.',
                  zh: '已復原即時調整，並收到確認。',
                });
              } catch (e) {
                setActionError((e as Error).message);
              }
              return;
            }
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
          disabled={blocked}
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
            {connection.busy
              ? t('Applying…', '套用中…')
              : muted
                ? t('Restore sound', '還原聲音')
                : t('Mute all', '全部靜音')}
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
                : panel === 'patch'
                  ? t('Your instruments & channels', '您的樂器與通道')
                  : t('Your sound setup', '您的音響設定')}
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
                : panel === 'patch'
                  ? t(
                      'Enter the actual patch from your Qu-24. Changes stay on this phone.',
                      '輸入 Qu-24 的實際配置，變更將儲存於此手機。',
                    )
                  : connection.phase === 'demo'
                    ? t(
                        savedPatch
                          ? 'Offline demo · using your saved patch'
                          : 'Offline demo · example patch',
                        savedPatch
                          ? '離線示範 · 使用已儲存配置'
                          : '離線示範 · 使用範例配置',
                      )
                    : connection.phase === 'live'
                      ? t(
                          'Live Qu-24 · control enabled',
                          '即時 Qu-24 · 已啟用控制',
                        )
                      : connection.phase === 'readonly' && qu.complete()
                        ? t(
                            'Mixer connected · enable control below',
                            '混音器已連線 · 請在下方啟用控制',
                          )
                        : t(
                            'Mixer connection · check status below',
                            '混音器連線 · 請查看下方狀態',
                          )}
          </DialogDescription>
          {panel === 'patch' && (
            <PatchEditor
              patch={patch}
              zh={zh}
              onSave={savePatch}
              onCancel={() => setPanel('settings')}
            />
          )}
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
                  disabled={!request.trim() || muted || blocked}
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
                    disabled={muted || blocked}
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
                    disabled={muted || blocked}
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
                  'Requests use simple rules. Live Auto balance can maintain an approved mix using mixer meters; it does not listen to audio or detect voices.',
                  '需求使用簡單規則。即時自動平衡可依混音器電平維持已確認的混音，不會聆聽音訊或偵測語音。',
                )}
              </p>
            </>
          )}
          {panel === 'restore' && (
            <>
              <button
                className="assistant-primary"
                disabled={blocked}
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
              <QuConnection
                session={qu}
                state={connection}
                zh={zh}
                onEnabled={controlEnabled}
                onRead={() => {
                  setMix((current) => ({
                    ...current,
                    mode: 'desk',
                    beforeMute: null,
                  }));
                  setHistory([]);
                  setLast({
                    en: 'Reading the desk. No service mode has been applied.',
                    zh: '正在讀取混音台，尚未套用任何聚會模式。',
                  });
                }}
                onDemo={() => {
                  setMix(initialMix(patch));
                  setHistory([]);
                  setActionError('');
                  setLast({
                    en: 'Demo restored. No mixer commands will be sent.',
                    zh: '已返回示範，不會傳送混音台指令。',
                  });
                }}
              />
              <button
                className="assistant-primary"
                disabled={muted || connection.phase !== 'demo'}
                onClick={() => setPanel('patch')}
              >
                {t('Set up instruments & channels', '設定樂器與通道')}
              </button>
              {(muted || connection.phase !== 'demo') && (
                <p className="assistant-small">
                  {t(
                    'Return to demo and restore any demo mute before editing assignments.',
                    '請先返回示範並還原示範靜音，再編輯配置。',
                  )}
                </p>
              )}
              {patchWarning && (
                <p role="alert" className="patch-error">
                  {patchWarning}
                </p>
              )}
              <div className="patch-summary">
                {patch.sources.map((s) => (
                  <div key={s.id}>
                    <span>{s.name}</span>
                    <small>{s.channels.map(channelName).join(', ')}</small>
                  </div>
                ))}
              </div>
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
                    'The assistant is not listening to audio. Modes, requests, and live meter-based Auto balance follow your channel assignments.',
                    '助理不會聆聽音訊。模式、需求及即時電平自動平衡會依您的通道配置運作。',
                  )}
                </p>
              </div>
              <label className="assistant-request">
                {t('What went wrong? (optional)', '發生了什麼問題？（選填）')}
                <textarea
                  value={reportNote}
                  maxLength={2000}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder={t(
                    'What you tried and what happened at church',
                    '您在教會進行了什麼操作，以及遇到的問題',
                  )}
                />
              </label>
              <label className="qu-trace-option">
                <Checkbox
                  checked={rawTrace}
                  onCheckedChange={(value) => setRawTrace(!!value)}
                />
                {t('Include protocol byte trace', '包含通訊位元組紀錄')}
              </label>
              <p className="assistant-small">
                {t(
                  'Logs stay on the phone until shared. Traces may contain mixer labels; review before sharing. Opening the share sheet disconnects the mixer.',
                  '紀錄會保留於手機，直到您分享。通訊紀錄可能包含混音台名稱，分享前請先檢查。開啟分享選單會中斷混音器連線。',
                )}
              </p>
              <button
                className="assistant-secondary"
                disabled={connection.busy}
                onClick={() => void shareReport()}
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
