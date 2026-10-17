'use client';
import { useState } from 'react';
import { Radio } from 'lucide-react';
import { logEvent } from '@/lib/diagnostics';

export function ConnectionPanel({ zh }: { zh: boolean }) {
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [ip, setIp] = useState('');
  const [message, setMessage] = useState('');
  function check() {
    const valid =
      /^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim()) &&
      ip
        .trim()
        .split('.')
        .every((n) => Number(n) <= 255);
    setMessage(
      valid
        ? t(
            'IP format is valid. Device availability is unknown: mixer connectivity is not implemented yet. No network request was sent.',
            'IP 格式正確。混音器連線功能尚未實作，無法確認裝置是否存在。未傳送網路請求。',
          )
        : t(
            'Enter a valid IPv4 address, for example 192.168.1.24.',
            '請輸入有效 IPv4 位址，例如 192.168.1.24。',
          ),
    );
    logEvent('connection.address-validation', { valid, mode: 'demo' });
  }
  return (
    <section className="panel connection-panel">
      <h2>
        <Radio size={18} />
        {t('Mixer connection', '混音器連線')}
      </h2>
      <span className="preview-chip">
        {t('Demo · not connected', '示範 · 尚未連線')}
      </span>
      <label>
        {t('Qu IP address', 'Qu IP 位址')}
        <input
          value={ip}
          onChange={(e) => {
            setIp(e.target.value);
            setMessage('');
          }}
          placeholder="192.168.1.24"
          inputMode="decimal"
          autoComplete="off"
          maxLength={15}
        />
      </label>
      <button className="secondary" onClick={check}>
        {t('Validate IP format', '檢查 IP 格式')}
      </button>
      <p role="status">
        {message ||
          t(
            'Mixer detection is planned for a later version. All controls currently change sample data only.',
            '混音器偵測將於後續版本提供。目前所有控制僅變更範例資料。',
          )}
      </p>
      <button className="secondary" disabled>
        {t('Find Qu devices · coming later', '尋找 Qu 裝置 · 後續提供')}
      </button>
    </section>
  );
}
