import { useState } from 'react';
import { Radio, Unplug } from 'lucide-react';
import { QuSession, type ConnectionState } from '@/lib/qu-session';
export function QuConnection({
  session,
  state,
  zh,
  onDemo,
  onRead,
}: {
  session: QuSession;
  state: ConnectionState;
  zh: boolean;
  onDemo: () => void;
  onRead: () => void;
}) {
  const [host, setHost] = useState(''),
    [error, setError] = useState('');
  const t = (en: string, cn: string) => (zh ? cn : en);
  const invoke = (fn: () => Promise<void> | void) => {
    setError('');
    Promise.resolve()
      .then(fn)
      .catch((e) => setError((e as Error).message));
  };
  const pending =
    state.phase === 'connecting' || state.phase === 'syncing' || state.busy;
  return (
    <section className="qu-connection">
      <h3>
        <Radio size={18} />
        {t('Qu-24 connection', 'Qu-24 連線')}
      </h3>
      <p role="status">{state.message}</p>
      {state.identity && (
        <p className="assistant-small">
          Qu-24 · {t('Firmware', '韌體')} {state.identity.major}.
          {state.identity.minor} · MIDI {state.identity.midi + 1}
          <br />
          {session.muteCount()}/31 {t('mute states', '靜音狀態')} ·{' '}
          {session.faderCount()}/31 {t('faders received', '推桿已接收')}
        </p>
      )}
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
        onClick={() =>
          invoke(async () => {
            const attempt = session.connect(host.trim());
            if (session.state.phase === 'connecting') onRead();
            await attempt;
          })
        }
      >
        {t('Connect & read desk', '連線並讀取混音台')}
      </button>
      {state.phase === 'readonly' && (
        <>
          <p className="assistant-small">
            {t(
              'Check your saved patch against the desk before enabling live control. Connecting never applies demo settings.',
              '啟用即時控制前，請先確認已儲存配置與混音台一致。連線不會套用示範設定。',
            )}
          </p>
          <button
            className="assistant-primary"
            disabled={!session.complete()}
            onClick={() => invoke(() => session.enableLive())}
          >
            {t('Enable live channel control', '啟用即時通道控制')}
          </button>
        </>
      )}
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
