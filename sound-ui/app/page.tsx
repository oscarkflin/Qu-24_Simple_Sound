'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { QuickSetup } from '@/components/quick-setup';
import { initialProfile, PROFILE_KEY, validateProfile, type Profile } from '@/lib/channel-profile';
import { startDiagnostics, logEvent, scrub } from '@/lib/diagnostics';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog';
import {
  AudioLines,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Guitar,
  Headphones,
  LayoutDashboard,
  Mic,
  Music2,
  Piano,
  Radio,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Users,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const sources = [
  { en: 'Pastor', zh: '牧師', icon: Mic, color: '#c4b5fd' },
  { en: 'Lead vocal', zh: '主唱', icon: Mic, color: '#86dbbd' },
  { en: 'Vocals', zh: '和聲', icon: Users, color: '#81c7da' },
  { en: 'Keyboard', zh: '鍵盤', icon: Piano, color: '#e9be83' },
  { en: 'Guitar', zh: '吉他', icon: Guitar, color: '#eaa698' },
  { en: 'Drums', zh: '鼓', icon: Music2, color: '#a7b6ed' },
];
const steps = [
  'Countdown',
  'Worship',
  'Offering',
  'Sermon',
  'Response',
  'Outro',
];
const stepsZh = ['倒數', '敬拜', '奉獻', '講道', '回應詩歌', '散會'];
const dests = [
  'Main speakers',
  'Vocal monitor',
  'Piano monitor',
  'Band monitor',
  'Drummer IEM',
  'Livestream',
];
const destsZh = [
  '主喇叭',
  '人聲監聽',
  '鋼琴監聽',
  '樂團監聽',
  '鼓手耳內監聽',
  '直播',
];
type Snapshot = {
  levels: number[][];
  mutes: boolean[];
  step: number;
  main: number;
};
export default function Home() {
  const gesture = useRef(false);
  const [zh, setZh] = useState(false),
    [tab, setTab] = useState('settings'),
    [step, setStep] = useState(1);
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [profile,setProfile]=useState<Profile>(initialProfile);
  const [storageReady,setStorageReady]=useState(false),[storageWarning,setStorageWarning]=useState('');
  const [mixGroup,setMixGroup]=useState('all');
  const name = (i: number) => profile.assignments[i].label || (zh ? sources[i].zh : sources[i].en);
  useEffect(()=>{
    const cleanup=startDiagnostics();
    try{const saved=localStorage.getItem(PROFILE_KEY);if(saved)setProfile(validateProfile(JSON.parse(saved)));}
    catch(error){setStorageWarning('Saved layout could not be loaded. Example assignments are shown; export your layout after editing.');logEvent('profile.load-failed',{message:scrub((error as Error).message)},'error');}
    setStorageReady(true);
    return cleanup;
  },[]);
  useEffect(()=>{logEvent('screen.opened',{screen:tab});},[tab]);
  const saveProfile=(p:Profile)=>{
    setProfile(p);
    try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));setStorageWarning('');}
    catch(error){setStorageWarning(t('Browser storage unavailable. Export the layout to keep it.','瀏覽器無法儲存，請匯出配置檔案。'));logEvent('profile.save-failed',{message:scrub((error as Error).message)},'error');}
    logEvent('profile.saved',{sourceCount:p.assignments.length});
  };
  const destName = (i: number) => (zh ? destsZh[i] : dests[i]);
  const [levels, setLevels] = useState(
    Array.from({ length: 6 }, (_, i) =>
      [-12, -3, -6, -10, -12, -14].map((v) => v - (i ? 3 : 0)),
    ),
  );
  const [mutes, setMutes] = useState([true, false, false, false, false, false]);
  const [main, setMain] = useState(-6),
    [dest, setDest] = useState(1);
  const [history, setHistory] = useState<Snapshot[]>([]),
    [notice, setNotice] = useState('');
  const [modal, setModal] = useState<
      'help' | 'setup' | 'transition' | 'mute' | null
    >(null),
    [target, setTarget] = useState(2);
  const [issue, setIssue] = useState('quiet'),
    [helpSource, setHelpSource] = useState(1),
    [helpBus, setHelpBus] = useState(1),
    [suggested, setSuggested] = useState(false);
  const [lineup, setLineup] = useState([true, true, true, true, true, true]),
    [checked, setChecked] = useState<number[]>([]);
  useEffect(() => { document.documentElement.lang = zh ? 'zh-Hant' : 'en'; }, [zh]);
  useEffect(() => {
    type Registry = { registerTool: (tool: {name:string;description:string;inputSchema:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>unknown };
    const registry = (document as Document & {modelContext?:Registry}).modelContext;
    if (!registry) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(registry.registerTool({
        name:'navigate_sound_preview',
        description:'Open a review screen in the sample-data sound UI. Does not control hardware.',
        inputSchema:{type:'object',properties:{screen:{type:'string',enum:['service','mix','monitors','stream','settings']}},required:['screen'],additionalProperties:false},
        execute(input) {
          const screen = (input as {screen?:unknown})?.screen;
          if(typeof screen!=='string'||!['service','mix','monitors','stream','settings'].includes(screen)) throw new Error('Unknown preview screen');
          flushSync(()=>setTab(screen));
          return {screen,mode:'sample-data'};
        },
      },{signal:lifecycle.signal})).catch(()=>{});
    } catch { /* Ordinary browsers do not need agent navigation support. */ }
    return ()=>lifecycle.abort();
  }, []);
  const save = () =>
    setHistory((h) => [
      ...h.slice(-19),
      { levels: levels.map((r) => [...r]), mutes: [...mutes], step, main },
    ]);
  const undo = () => {
    const s = history.at(-1);
    if (!s) return;
    setLevels(s.levels);
    setMutes(s.mutes);
    setStep(s.step);
    setMain(s.main);
    setHistory((h) => h.slice(0, -1));
    setNotice(t('Last adjustment undone.', '已復原上一個調整。'));
    logEvent('control.undo');
  };
  const setLevel = (b: number, c: number, v: number, record = true) => {
    if(record) save();
    if(record)logEvent('level.adjusted',{bus:b,source:c,value:v});
    setLevels((l) =>
      l.map((r, i) => (i === b ? r.map((n, j) => (j === c ? v : n)) : r)),
    );
  };
  const chooseStep = (n: number) => {
    setTarget(n);
    setModal('transition');
  };
  const transition = () => {
    save();
    setStep(target);
    logEvent('section.applied',{section:target});
    setMutes(
      sources.map(
        (_, i) =>
          !lineup[i] ||
          ([2, 3].includes(target)
            ? i !== 0
            : target === 0
              ? true
              : target === 5
                ? i < 3
                : i === 0),
      ),
    );
    setModal(null);
    setNotice(
      t(
        'Section updated. Fader levels preserved.',
        '流程已切換，推桿音量保持不變。',
      ),
    );
  };
  const help = () => {
    setSuggested(false);
    setModal('help');
  };
  const nav = [
    ['settings', 'Quick setup', '快速設定', Settings2],
    ['service', 'Service', '聚會', LayoutDashboard],
    ['mix', 'Quick mix', '快速混音', SlidersHorizontal],
    ['monitors', 'Monitors', '監聽', Headphones],
    ['stream', 'Livestream', '直播', Radio],
  ] as const;
  const fader = (i: number, b: number) => {
    const s = sources[i],
      Icon = s.icon;
    return (
      <div
        key={i}
        className={'fader-card ' + (b === 0 && mutes[i] ? 'is-muted' : '')}
        style={{ '--source': s.color } as CSSProperties}
      >
        <div className="source-icon">
          <Icon size={23} />
        </div>
        <h3>{name(i)}</h3>
        <span className="channel-badge">CH {profile.assignments[i].channels}</span>
        <span className="fader-caption">
          {b === 0
            ? mutes[i]
              ? t('Muted', '已靜音')
              : t('In the mix', '混音中')
            : t('Send level', '傳送音量')}
        </span>
        <div className="vertical-control">
          <div className="scale">
            <span>0</span>
            <span>−12</span>
            <span>−24</span>
            <span>−48</span>
          </div>
          <Slider
            aria-label={`${name(i)} ${destName(b)}`}
            orientation="vertical"
            min={-48}
            max={0}
            step={1}
            value={[levels[b][i]]}
            onValueChange={(v) => {
              if(!gesture.current){save();gesture.current=true;}
              setLevel(b, i, Array.isArray(v) ? v[0] : v, false);
            }}
            onValueCommitted={(v)=>{gesture.current=false;logEvent('level.adjusted',{bus:b,source:i,value:Array.isArray(v)?v[0]:v});}}
          />
        </div>
        <output>
          {levels[b][i]}
          <small> dB</small>
        </output>
        {b === 0 ? (
          <button
            aria-pressed={mutes[i]}
            className={'mute-button ' + (mutes[i] ? 'muted' : '')}
            onClick={() => {
              save();
              setMutes((m) => m.map((v, n) => (n === i ? !v : v)));
              logEvent('mute.changed',{source:i,muted:!mutes[i]});
            }}
          >
            {mutes[i] ? <VolumeX size={16} /> : <Volume2 size={16} />}{' '}
            {mutes[i] ? t('Unmute', '取消靜音') : t('Mute', '靜音')}
          </button>
        ) : (
          <span className="destination-note">
            {t('This destination only', '僅此輸出')}
          </span>
        )}
      </div>
    );
  };
  const heading = (
    eyebrow: string,
    title: string,
    desc: string,
    action?: React.ReactNode,
  ) => (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  );
  return (
    <main className="sound-app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            <AudioLines />
          </span>
          <div>
            Sunday Sound<span>{t('MAIN SANCTUARY', '主堂')}</span>
          </div>
        </div>
        <div className="top-status">
          <span className="demo-dot" />
          {t('UI preview · Sample data', '介面預覽 · 範例資料')}
          <span className="status-divider" />
          <span className="mixer-label">Qu-24</span>
        </div>
        <button className="language-button" onClick={() => setZh((z) => !z)}>
          {zh ? 'EN' : '繁中'}
        </button>
      </header>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(String(v))}
        className="app-tabs"
      >
        <div className="workspace">
          <TabsContent value="service">
            {heading(
              t('SUNDAY MORNING', '主日早晨'),
              t('A little less to think about.', '讓服事，更從容。'),
              t(
                'Your service, one step at a time.',
                '一步一步，完成今天的聚會。',
              ),
              <button className="secondary" onClick={() => setModal('setup')}>
                <Users size={18} />
                {t("Today's lineup", '今日團隊')}
                <span className="count">{lineup.filter(Boolean).length}</span>
              </button>,
            )}
            <div className="service-grid">
              <section className="current-card">
                <div className="card-topline">
                  <span className="eyebrow">
                    <span className="green-dot" />
                    {t('CURRENT SECTION', '目前流程')}
                  </span>
                  <span className="step-number">0{step + 1} / 06</span>
                </div>
                <div className="current-title">
                  <span className="big-icon">
                    {[2, 3].includes(step) ? <Mic /> : <Music2 />}
                  </span>
                  <div>
                    <h2>{zh ? stepsZh[step] : steps[step]}</h2>
                    <p>
                      {[2, 3].includes(step)
                        ? t('Make room for the message.', '預備心，聆聽信息。')
                        : t(
                            'Let every voice be heard.',
                            '讓每個聲音，都能被聽見。',
                          )}
                    </p>
                  </div>
                </div>
                <div className="source-status">
                  {sources.slice(0, 3).map((s, i) => (
                    <div key={s.en}>
                      <span>{name(i)}</span>
                      <span className={mutes[i] ? 'dim' : 'mint'}>
                        {mutes[i] ? <VolumeX size={15} /> : <Check size={15} />}{' '}
                        {mutes[i] ? t('Muted', '已靜音') : t('On', '開啟')}
                      </span>
                    </div>
                  ))}
                  <div>
                    <span>{t('Instruments', '樂器')}</span>
                    <span
                      className={mutes.slice(3).every(Boolean) ? 'dim' : 'mint'}
                    >
                      {mutes.slice(3).every(Boolean) ? (
                        <VolumeX size={15} />
                      ) : (
                        <Check size={15} />
                      )}{' '}
                      {mutes.slice(3).every(Boolean)
                        ? t('Muted', '已靜音')
                        : t('On', '開啟')}
                    </span>
                  </div>
                </div>
                <div className="next-section">
                  <div>
                    <span className="eyebrow">{t('UP NEXT', '接下來')}</span>
                    <strong>
                      {step === 5
                        ? t('Service complete', '聚會結束')
                        : zh
                          ? stepsZh[step + 1]
                          : steps[step + 1]}
                    </strong>
                  </div>
                  <button
                    className="primary"
                    onClick={() => chooseStep(step === 5 ? 0 : step + 1)}
                  >
                    {step === 5
                      ? t('Restart', '重新開始')
                      : t('Next section', '下一流程')}
                    <ArrowRight size={19} />
                  </button>
                </div>
              </section>
              <section className="run-sheet panel">
                <div className="section-title">
                  <h2>{t('Order of service', '聚會流程')}</h2>
                  <span className="subtle">{t('6 sections', '6 個流程')}</span>
                </div>
                <ol>
                  {steps.map((s, i) => (
                    <li key={s}>
                      <button
                        className={i === step ? 'active-step' : ''}
                        onClick={() => chooseStep(i)}
                      >
                        <span className="step-index">
                          {i < step ? (
                            <Check size={16} />
                          ) : (
                            String(i + 1).padStart(2, '0')
                          )}
                        </span>
                        <span>{zh ? stepsZh[i] : s}</span>
                        {i === step ? (
                          <span className="now">{t('NOW', '目前')}</span>
                        ) : (
                          <span className="duration">
                            {['05', '20', '05', '30', '10', '05'][i]}{' '}
                            {t('min', '分')}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="run-note">
                  <Check size={16} />
                  {t(
                    'You choose when to move on.',
                    '由您決定何時進入下一流程。',
                  )}
                </div>
              </section>
              <aside className="right-stack">
                <section className="room-card panel">
                  <div className="section-title">
                    <h2>
                      <Volume2 size={19} />
                      {t('Room volume', '主堂音量')}
                    </h2>
                  </div>
                  <div className="room-value">
                    {main}
                    <span>dB</span>
                  </div>
                  <Slider
                    aria-label={t('Room volume', '主堂音量')}
                    min={-48}
                    max={0}
                    value={[main]}
                    onValueChange={(v) => {
                      if(!gesture.current){save();gesture.current=true;}
                      setMain(Array.isArray(v) ? v[0] : v);
                    }}
                    onValueCommitted={(v)=>{gesture.current=false;logEvent('main.adjusted',{value:Array.isArray(v)?v[0]:v});}}
                  />
                  <div className="range-labels">
                    <span>{t('Quieter', '較小')}</span>
                    <span>{t('Louder', '較大')}</span>
                  </div>
                </section>
                <button
                  className="stream-card panel"
                  onClick={() => setTab('stream')}
                >
                  <Radio className="stream-icon" size={22} />
                  <div>
                    <h2>{t('Livestream', '直播')}</h2>
                    <p>
                      {t(
                        'Its own mix. Its own audience.',
                        '獨立混音，照顧線上會眾。',
                      )}
                    </p>
                  </div>
                  <ChevronRight size={18} />
                </button>
                <button className="help-card" onClick={help}>
                  <CircleHelp size={25} />
                  <h2>{t('Something sounds wrong?', '聲音不太對？')}</h2>
                  <p>
                    {t("Let's work through it together.", '一起找出調整方向。')}
                  </p>
                  <span>
                    {t('Get a suggestion', '取得建議')}
                    <ArrowRight size={18} />
                  </span>
                </button>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="mix">
            {heading(
              t('MAIN SPEAKERS', '主喇叭'),
              t('Find your balance.', '找到合適的平衡。'),
              t(
                'Small adjustments. A clearer mix.',
                '小幅調整，讓聲音更清楚。',
              ),
              <button className="secondary" onClick={() => setModal('mute')}>
                <VolumeX size={18} />
                {t('Mute microphones', '麥克風靜音')}
              </button>,
            )}
            <Tabs value={mixGroup} onValueChange={v=>setMixGroup(String(v))}>
              <TabsList className="mix-filters" aria-label={t('Source groups','來源分組')}>
                <TabsTrigger value="all">{t('All sources','所有來源')}</TabsTrigger>
                <TabsTrigger value="speech">{t('Speech','講員')}</TabsTrigger>
                <TabsTrigger value="vocals">{t('Vocals','人聲')}</TabsTrigger>
                <TabsTrigger value="instruments">{t('Instruments','樂器')}</TabsTrigger>
              </TabsList>
              <div className="fader-grid filtered">{sources.map((_,i)=>(mixGroup==='all'||profile.assignments[i].group===mixGroup)?fader(i,0):null)}</div>
              {mixGroup!=='all'&&!profile.assignments.some(a=>a.group===mixGroup)&&<p className="inline-note">{t('No sources in this tab. Assign one in Quick setup.','此分頁尚無來源，請於快速設定中指派。')}</p>}
            </Tabs>
          </TabsContent>
          <TabsContent value="monitors">
            {heading(
              t('ON STAGE', '舞台上'),
              t('Help them hear each other.', '讓彼此，聽得更清楚。'),
              t(
                'Choose who is listening before adjusting their mix.',
                '調整前，先選擇監聽的對象。',
              ),
              <button
                className="secondary"
                onClick={() => {
                  setHelpBus(dest);
                  help();
                }}
              >
                <CircleHelp size={18} />
                {t('Musician feedback', '樂手回饋')}
              </button>,
            )}
            <div className="destination-picker">
              {dests.slice(1, 5).map((d, i) => (
                <button
                  key={d}
                  aria-pressed={dest === i + 1}
                  className={dest === i + 1 ? 'selected' : ''}
                  onClick={() => setDest(i + 1)}
                >
                  <Headphones size={18} />
                  {destName(i + 1)}
                </button>
              ))}
            </div>
            <div className="inline-note">
              <Users size={17} />
              {[1, 3].includes(dest)
                ? t(
                    'Shared monitor — changes affect everyone using this speaker.',
                    '共用監聽：調整會影響使用此喇叭的所有人。',
                  )
                : t(
                    'Independent monitor mix. Output mapping to be confirmed at church.',
                    '獨立監聽混音，實際輸出配置待現場確認。',
                  )}
            </div>
            <div className="fader-grid compact">
              {sources.map((_, i) => fader(i, dest))}
            </div>
          </TabsContent>
          <TabsContent value="stream">
            {heading(
              t('FOR THE PEOPLE AT HOME', '給線上的會眾'),
              t('Bring the room to them.', '讓他們，也在其中。'),
              t(
                'An independent mix for your online audience.',
                '為線上的會眾，調整獨立混音。',
              ),
              <span className="preview-chip">
                <Radio size={16} />
                {t('Audio not monitored', '未接收音訊')}
              </span>,
            )}
            <div className="fader-grid">
              {sources.map((_, i) => fader(i, 5))}
            </div>
            <p className="inline-note">
              {t(
                'Sample send levels are independent of room faders. Actual pre/post-fader routing must be verified.',
                '範例傳送音量獨立於主堂推桿，實際推桿前後路由待確認。',
              )}
            </p>
          </TabsContent>
          <TabsContent value="settings">
            <QuickSetup zh={zh} profile={profile} onSave={saveProfile} onMix={()=>setTab('mix')} state={{screen:tab,step,levels,mutes,main}} storageReady={storageReady} storageWarning={storageWarning}/>
          </TabsContent>
        </div>
        <footer className="bottom-bar">
          <TabsList
            className="navigation"
            aria-label={t('Main navigation', '主選單')}
          >
            {nav.map(([key, en, cn, Icon]) => (
              <TabsTrigger key={key} value={key}>
                <Icon size={21} />
                <span>{t(en, cn)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <button
            className="undo-button"
            onClick={undo}
            disabled={!history.length}
          >
            <RotateCcw size={18} />
            {t('Undo', '復原')}
          </button>
        </footer>
      </Tabs>
      {notice && (
        <div className="notice" role="status">
          <Check size={17} />
          {notice}
          <button
            aria-label={t('Dismiss', '關閉')}
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <Dialog
        open={modal !== null && modal !== 'mute'}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="sound-dialog">
          <DialogTitle>
            {modal === 'help'
              ? t('Let’s listen to the feedback.', '先聽聽大家的回饋。')
              : modal === 'setup'
                ? t('Who is here today?', '今天有哪些人服事？')
                : modal === 'mute'
                  ? t('Mute all microphones?', '將所有麥克風靜音？')
                  : t('Move to this section?', '切換聚會流程？')}
          </DialogTitle>
          <DialogDescription>
            {modal === 'help'
              ? t(
                  'One destination, one small adjustment at a time.',
                  '一次選一個輸出，做一個小調整。',
                )
              : t(
                  'UI preview — changes only affect sample data.',
                  '介面預覽：調整僅影響範例資料。',
                )}
          </DialogDescription>
          {modal === 'transition' && (
            <>
              <div className="transition-preview">
                <span>{zh ? stepsZh[step] : steps[step]}</span>
                <ArrowRight />
                <strong>{zh ? stepsZh[target] : steps[target]}</strong>
              </div>
              <p>
                {t(
                  'Microphone and instrument mutes will follow this section. Fader levels will stay as they are.',
                  '麥克風與樂器靜音狀態將隨流程切換，推桿音量保持不變。',
                )}
              </p>
              <button className="primary" onClick={transition}>
                {t('Apply section', '套用流程')}
                <ArrowRight size={18} />
              </button>
            </>
          )}
          {modal === 'mute' && (
            <>
              <p>
                {t(
                  'Pastor, lead vocal, and supporting vocals will be muted. Instruments stay unchanged.',
                  '牧師、主唱與和聲將靜音，樂器保持不變。',
                )}
              </p>
              <button
                className="danger"
                onClick={() => {
                  save();
                  setMutes((m) => m.map((v, i) => (i < 3 ? true : v)));
                  setModal(null);
                  setNotice(
                    t(
                      'Microphones muted. Undo is available.',
                      '麥克風已靜音，可復原。',
                    ),
                  );
                }}
              >
                {t('Mute microphones', '麥克風靜音')}
              </button>
            </>
          )}
          {modal === 'setup' && (
            <>
              <div className="lineup-list">
                {sources.map((s, i) => (
                  <div key={s.en}>
                    <label className="lineup-choice">
                      <Checkbox checked={lineup[i]} onCheckedChange={value=>setLineup(l=>l.map((v,n)=>n===i?!!value:v))}/>
                      {name(i)}
                    </label>
                    <button
                      disabled={!lineup[i]}
                      className={
                        'check-status ' + (checked.includes(i) ? 'mint' : '')
                      }
                      onClick={() =>
                        setChecked((c) =>
                          c.includes(i) ? c.filter((n) => n !== i) : [...c, i],
                        )
                      }
                    >
                      {checked.includes(i) ? (
                        <Check size={16} />
                      ) : (
                        <Mic size={16} />
                      )}{' '}
                      {checked.includes(i)
                        ? t('Checked', '已試音')
                        : t('Mark checked', '標記已試音')}
                    </button>
                  </div>
                ))}
              </div>
              <p className="subtle">
                {t(
                  'Ask each person to perform at service volume and check levels on the console.',
                  '請以聚會音量演唱或演奏，並查看混音器音量表。',
                )}
              </p>
              <button
                className="primary"
                onClick={() => {
                  setModal(null);
                  setNotice(
                    t(
                      'Lineup updated for the next section change.',
                      '團隊已更新，於下次流程切換套用。',
                    ),
                  );
                }}
              >
                {t('Done', '完成')}
                <Check size={18} />
              </button>
            </>
          )}
          {modal === 'help' && (
            <>
              <div className="help-fields">
                <label>
                  {t('Listening through', '聆聽的輸出')}
                  <Select
                    value={helpBus}
                    onValueChange={(value) => {
                      if(value===null) return;
                      setHelpBus(value);
                      setSuggested(false);
                    }}
                  >
                    <SelectTrigger><SelectValue>{destName(helpBus)}</SelectValue></SelectTrigger>
                    <SelectContent>
                    {dests.map((d, i) => (
                      <SelectItem key={d} value={i}>
                        {destName(i)}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  {t('Which source?', '哪個聲音？')}
                  <Select
                    value={helpSource}
                    onValueChange={(value) => {
                      if(value===null) return;
                      setHelpSource(value);
                      setSuggested(false);
                    }}
                  >
                    <SelectTrigger><SelectValue>{name(helpSource)}</SelectValue></SelectTrigger>
                    <SelectContent>
                    {sources.map((s, i) => (
                      <SelectItem key={s.en} value={i}>
                        {name(i)}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <RadioGroup className="issue-picker" value={issue} onValueChange={value=>{setIssue(String(value));setSuggested(false);}} aria-label={t('Reported problem','回饋問題')}>
                {[
                  ['quiet', 'Too quiet', '太小聲'],
                  ['loud', 'Too loud', '太大聲'],
                  ['muddy', 'Muddy / unclear', '混濁／不清楚'],
                  ['harsh', 'Too harsh', '太刺耳'],
                ].map(([key, en, cn]) => (
                  <label
                    className={issue === key ? 'selected' : ''}
                    key={key}
                  >
                    <RadioGroupItem value={key}/>
                    {t(en, cn)}
                  </label>
                ))}
              </RadioGroup>
              <div className="suggestion">
                <span className="eyebrow">
                  {t('SUGGESTED NEXT STEP', '建議下一步')}
                </span>
                <h3>
                  {['quiet', 'loud'].includes(issue)
                    ? `${t('Try', '試著調整')} ${issue === 'quiet' ? '+1' : '−1'} dB`
                    : t(
                        'Check the scope before EQ.',
                        '調整 EQ 前，確認影響範圍。',
                      )}
                </h3>
                <p>
                  {['quiet', 'loud'].includes(issue)
                    ? t(
                        `Adjust ${name(helpSource)} in ${destName(helpBus)}, then ask whether it is better. Shared monitors affect everyone using them.`,
                        `調整${destName(helpBus)}中的${name(helpSource)}，再詢問是否改善。共用監聽會影響所有使用者。`,
                      )
                    : t(
                        'Is only this source unclear, or the whole monitor? Check placement and balance first. Input EQ may also affect the room and stream. We need verified routing before suggesting a targeted EQ change.',
                        '只有這個聲音不清楚，還是整個監聽？先確認位置與平衡。輸入 EQ 可能影響主堂和直播，需要確認路由後再建議調整。',
                      )}
                </p>
              </div>
              {['quiet', 'loud'].includes(issue) && (
                <button
                  className="primary"
                  disabled={suggested || (issue==='quiet' ? levels[helpBus][helpSource]>=0 : levels[helpBus][helpSource]<=-48)}
                  onClick={() => {
                    setLevel(
                      helpBus,
                      helpSource,
                      Math.max(
                        -48,
                        Math.min(
                          0,
                          levels[helpBus][helpSource] +
                            (issue === 'quiet' ? 1 : -1),
                        ),
                      ),
                    );
                    setSuggested(true);
                  }}
                >
                  {suggested
                    ? t('Applied · Is it better?', '已套用，是否改善？')
                    : t('Try this adjustment', '試試這個調整')}
                  <Check size={18} />
                </button>
              )}
              {suggested && (
                <div className="dialog-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      undo();
                      setSuggested(false);
                    }}
                  >
                    {t('Undo adjustment', '復原調整')}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setModal(null);
                      setNotice(
                        t(
                          'Adjustment kept for this preview.',
                          '已保留此次預覽調整。',
                        ),
                      );
                    }}
                  >
                    {t('Yes, keep it', '是的，保留')}
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={modal==='mute'} onOpenChange={open=>{if(!open)setModal(null);}}>
        <AlertDialogContent className="sound-dialog">
          <AlertDialogTitle>{t('Mute all microphones?','將所有麥克風靜音？')}</AlertDialogTitle>
          <AlertDialogDescription>{t('Preview only: pastor, lead vocal, and supporting vocals will be muted. Instruments stay unchanged.','僅供預覽：牧師、主唱與和聲將靜音，樂器保持不變。')}</AlertDialogDescription>
          <div className="dialog-actions"><AlertDialogCancel>{t('Cancel','取消')}</AlertDialogCancel><button className="danger" onClick={()=>{save();setMutes(m=>m.map((v,i)=>i<3?true:v));setModal(null);setNotice(t('Microphones muted. Undo is available.','麥克風已靜音，可復原。'));}}>{t('Mute microphones','麥克風靜音')}</button></div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
