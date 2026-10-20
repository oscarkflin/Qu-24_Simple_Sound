import { useState, useEffect } from 'react';
import { EnableControl } from './enable-control';
import { Radio, Unplug } from 'lucide-react';
import { QuSession, type ConnectionState } from '@/lib/qu-session';
export function QuConnection({
  session,
  state,
  zh,
  onDemo,
  onRead,
  onEnabled,
}: {
  session: QuSession;
  state: ConnectionState;
  zh: boolean;
  onDemo: () => void;
  onRead: () => void;
  onEnabled?: () => void;
}) {
  const [host, setHost] = useState(''),
    [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const t = (en: string, cn: string) => (zh ? cn : en);
  const ready = state.phase === 'readonly' && session.complete();
  useEffect(() => {
    if (ready)
      document
        .querySelector<HTMLElement>('.assistant-dialog')
        ?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ready]);
  const invoke = (fn: () => Promise<void> | void) => {
    setError('');
    Promise.resolve()
      .then(fn)
      .catch((e) => setError((e as Error).message));
  };
  const pending =
    state.phase === 'connecting' ||
    state.phase === 'syncing' ||
    state.busy ||
    searching;
  const connect = (address: string) =>
    invoke(async () => {
      setHost(address);
      const attempt = session.connect(address);
      if (session.state.phase === 'connecting') onRead();
      await attempt;
    });
  return (
    <section className="qu-connection">
      <h3>
        <Radio size={18} />
        {t('Qu-24 connection', 'Qu-24 連線')}
      </h3>
      <p role="status">{state.message}</p>
      <EnableControl
        session={session}
        state={state}
        zh={zh}
        onEnabled={onEnabled}
      />
      {state.identity && (
        <p className="assistant-small">
          Qu-24 · {t('Firmware', '韌體')} {state.identity.major}.
          {state.identity.minor} · MIDI {state.identity.midi + 1}
          <br />
          {session.muteCount()}/31 {t('mute states', '靜音狀態')} ·{' '}
          {session.faderCount()}/31 {t('faders received', '推桿已接收')}
        </p>
      )}
      <button
        className="assistant-primary"
        disabled={
          pending || !['demo', 'disconnected', 'error'].includes(state.phase)
        }
        onClick={() =>
          invoke(async () => {
            setSearching(true);
            setResults([]);
            setSearchMessage('');
            try {
              const result = await session.discover();
              setResults(result.hosts);
              setSearchMessage(
                result.hosts.length
                  ? t(
                      'Possible mixers found. Tap one to verify Qu-24 identity and read the desk.',
                      '找到可能的混音器。點選以驗證 Qu-24 並讀取混音台。',
                    )
                  : t(
                      'No mixer found. Check Wi-Fi, mixer power and cable; close other mixer apps, or enter its IP below.',
                      '找不到混音器。請檢查 Wi-Fi、電源與網路線，關閉其他混音器應用程式，或輸入 IP。',
                    ),
              );
              if (result.limited)
                setSearchMessage(
                  (message) =>
                    message +
                    t(
                      ' Large network: only the phone’s local /24 was searched; use manual IP for other addresses.',
                      ' 大型網路：僅搜尋手機所在的 /24 範圍；其他位址請手動輸入。',
                    ),
                );
            } finally {
              setSearching(false);
            }
          })
        }
      >
        {searching
          ? t('Searching Wi-Fi…', '正在搜尋 Wi-Fi…')
          : t('Find mixer on Wi-Fi', '搜尋 Wi-Fi 混音器')}
      </button>
      <p className="assistant-small">
        {t(
          'Search takes about 10 seconds. Close Qu-Pad and other MIDI clients first. Search opens control ports briefly but sends no mixer commands.',
          '搜尋約需 10 秒。請先關閉 Qu-Pad 和其他 MIDI 用戶端。搜尋會短暫開啟控制連接埠，但不傳送混音指令。',
        )}
      </p>
      {searchMessage && (
        <p className="assistant-small" role="status">
          {searchMessage}
        </p>
      )}
      {results.map((address) => (
        <button
          key={address}
          className="assistant-secondary"
          disabled={
            pending || !['demo', 'disconnected', 'error'].includes(state.phase)
          }
          onClick={() => connect(address)}
        >
          {t('Read mixer at', '讀取混音器')} {address}
        </button>
      ))}
      <label className="assistant-request">
        {t('Mixer IP address', '混音器 IP 位址')}
        <input
          aria-label="Mixer IP address"
          inputMode="decimal"
          value={host}
          maxLength={15}
          placeholder="192.168.1.24"
          disabled={pending || state.phase === 'live'}
          onChange={(e) => setHost(e.target.value)}
        />
      </label>
      <button
        className="assistant-secondary"
        disabled={pending || state.phase === 'live' || !host.trim()}
        onClick={() => connect(host.trim())}
      >
        {t('Connect & read desk', '連線並讀取混音台')}
      </button>
      {state.phase !== 'demo' && (
        <button
          className="assistant-secondary"
          disabled={state.busy}
          onClick={() => invoke(() => session.disconnect())}
        >
          <Unplug size={17} />
          {t('Disconnect', '中斷連線')}
        </button>
      )}
      {state.phase !== 'demo' && (
        <button
          className="assistant-secondary"
          disabled={state.busy}
          onClick={() =>
            invoke(async () => {
              await session.demo();
              onDemo();
            })
          }
        >
          {t('Return to demo', '返回示範')}
        </button>
      )}
      <p className="assistant-small">
        {t(
          'Use the same church Wi-Fi as the mixer. Only one TCP MIDI client can connect. Leaving the app pauses the connection; reconnect and read the desk again.',
          '請連接混音器所在的教會 Wi-Fi。同一時間僅能有一個 TCP MIDI 用戶端。離開應用程式會中斷連線，回來後請重新讀取混音台。',
        )}
      </p>
      {error && (
        <p className="patch-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
