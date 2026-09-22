import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from '@/lib/session';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import App from './App';
import './styles.css';

applyTheme(getStoredTheme());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Safari/WebKit has never supported `type: 'module'` service workers —
    // registering with it fails silently on every iPhone and iPad. That
    // failure was swallowed here, so nothing about it was ever visible: no
    // registration ever existed, so navigator.serviceWorker.ready (used
    // throughout the push flow) waited forever. The service worker is now
    // built as a classic script (see vite.config.ts rollupFormat) so this
    // registers as a plain classic worker, which Safari does support.
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Force an immediate byte-diff check against the deployed sw.js,
      // bypassing the browser's normal (up to 24h) throttle on that check —
      // otherwise a new deploy can silently not appear for a long time.
      registration.update();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    }).catch((e) => console.error('Service worker registration failed:', e));

    // sw.ts calls self.skipWaiting() + clients.claim(), so once a new
    // worker installs it takes control right away — this reloads the page
    // exactly once to actually pick up the new bundle. Without this, the
    // already-loaded page keeps running the old JS until a fresh navigation.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
