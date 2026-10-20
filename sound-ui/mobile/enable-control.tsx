import { useState } from 'react';
import type { ConnectionState, QuSession } from '@/lib/qu-session';
export function EnableControl({
  session,
  state,
  zh,
  onEnabled,
}: {
  session: QuSession;
  state: ConnectionState;
  zh: boolean;
  onEnabled?: () => void;
}) {
  const [error, setError] = useState('');
  if (state.phase !== 'readonly' || !session.complete()) return null;
  const t = (en: string, cn: string) => (zh ? cn : en);
  return (
    <section className="qu-enable" aria-label="Mixer ready to control">
      <strong>
        {t('Qu-24 connected — ready to control', 'Qu-24 已連線 — 可以啟用控制')}
      </strong>
      <p>
        {t(
          'Connection succeeded. One more step: enable control to use the sound buttons.',
          '連線成功。再完成一步：啟用控制即可使用音量按鈕。',
        )}
      </p>
      <button
        className="assistant-primary"
        disabled={state.busy}
        onClick={() => {
          setError('');
          try {
            session.enableLive();
            onEnabled?.();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {t('Enable control', '啟用控制')}
      </button>
      <small>
        {t(
          'Keeps the desk’s current settings. No demo settings or service mode will be applied. Auto balance stays OFF. Verify your saved channel assignments before making changes.',
          '保留混音台目前設定，不套用示範設定或聚會模式。自動平衡保持關閉。操作前請確認通道配置。',
        )}
      </small>
      {error && (
        <p className="patch-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
