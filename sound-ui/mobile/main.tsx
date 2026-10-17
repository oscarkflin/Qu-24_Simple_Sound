import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import SoundAssistant from './assistant';
import { logEvent } from '../lib/diagnostics';
import '../app/globals.css';

document.documentElement.dataset.platform = Capacitor.getPlatform();
if (Capacitor.isNativePlatform()) {
  App.addListener('appStateChange', ({ isActive }) =>
    logEvent('app.state', { isActive }),
  );
  // Keep the control surface open on Android Back; dialogs handle Back first.
  App.addListener('backButton', () => {
    const dialog = document.querySelector(
      '[role="dialog"], [role="alertdialog"]',
    );
    if (dialog)
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
createRoot(document.getElementById('root')!).render(<SoundAssistant />);
