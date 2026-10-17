import { useState } from 'react';
import type { Mix } from '@/lib/assistant-model';
import type { ConnectionState, QuSession } from '@/lib/qu-session';
export function AutoBalanceControl({
  session,
  state,
  mix,
  savedPatch,
  zh,
}: {
  session: QuSession;
  state: ConnectionState;
  mix: Mix;
  savedPatch: boolean;
  zh: boolean;
}) {
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const status = state.automation;
  const on = status?.mode === 'on',
    observing = status?.mode === 'observe';
  const t = (en: string, cn: string) => (zh ? cn : en);
  const available =
    state.phase === 'live' &&
    savedPatch &&
    mix.mode !== 'desk' &&
    !mix.beforeMute;
  return (
    <section className="assistant-auto" aria-label="Auto balance controls">
      <div className="assistant-auto-heading">
        <strong>{t('Auto balance', '自動平衡')}</strong>
        <button
          role="switch"
          aria-label="Auto balance"
          aria-checked={!!on}
          disabled={
            !on &&
            (!available ||
              state.busy ||
              !status?.ready ||
              !observing ||
              !approved ||
              starting)
          }
          onClick={() => {
            setError('');
            try {
              if (on) session.stopAuto();
              else session.enableAuto(mix);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {on ? t('ON · Turn off', '開啟 · 關閉') : t('OFF', '關閉')}
        </button>
      </div>
      <p className="assistant-small" aria-live="polite">
        {status?.message ||
          t(
            'Off. Connect to the mixer to check live meters.',
            '已關閉。連接混音器以檢查即時電平。',
          )}
      </p>
      {!available && !on && (
        <p className="assistant-small">
          {t(
            'Save your actual patch, enable live control, then choose a service mode.',
            '請儲存實際配置、啟用即時控制，再選擇聚會模式。',
          )}
        </p>
      )}
      {observing && (
        <>
          <p className="assistant-small">
            {t(
              `${status.frames} valid meter frames · ${status.ready ? 'Ready to enable' : 'Play/speak steadily for 10 seconds'}`,
              `${status.frames} 個有效電平資料框 · ${status.ready ? '可以啟用' : '請持續演奏／說話 10 秒'}`,
            )}
          </p>
          <details className="assistant-small">
            <summary>{t('Meter check readings', '電平檢查讀數')}</summary>
            <div className="assistant-auto-readings">
              {Object.entries(status.readings || {}).map(([id, db]) => (
                <span key={id}>
                  {id.toUpperCase()}: {db.toFixed(1)} dB
                </span>
              ))}
            </div>
            <p>
              {t(
                'Input post-delay meters, before the input fader. Verify their scaling at the desk before first use.',
                '輸入延遲後、推桿前電平；首次使用前請確認混音台上的讀數比例。',
              )}
            </p>
          </details>
          <label className="assistant-small">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            {t(
              'This mix sounds right. Use it as the reference.',
              '目前混音聽起來正確，以此作為參考。',
            )}
          </label>
        </>
      )}
      {available && !on && !observing && (
        <button
          className="assistant-secondary"
          disabled={state.busy || starting}
          onClick={async () => {
            setError('');
            setApproved(false);
            setStarting(true);
            try {
              await session.observeMeters();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setStarting(false);
            }
          }}
        >
          {t('Check meters · no fader changes', '檢查電平 · 不改變推桿')}
        </button>
      )}
      {observing && (
        <button
          className="assistant-secondary"
          onClick={() => session.stopAuto()}
        >
          {t('Cancel meter check', '取消電平檢查')}
        </button>
      )}
      {(observing || on) && (
        <p className="assistant-small">
          {t(
            'Experimental level hold: small fader steps, ±3 dB from your reference. No gain, EQ or unmuting. App actions and input fader/mute changes stop Auto. Not a replacement for listening or feedback protection.',
            '實驗性音量維持：以小幅推桿調整維持參考值 ±3 dB。不調整增益、EQ 或解除靜音。手動操作會停止自動模式，不能取代聽音或回授保護。',
          )}
        </p>
      )}
      {error && (
        <p className="patch-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
