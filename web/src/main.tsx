import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from '@/lib/session';
import App from './App';
import './styles.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { type: 'module' }).then((registration) => {
      // Force an immediate byte-diff check against the deployed sw.js,
      // bypassing the browser's normal (up to 24h) throttle on that check —
      // otherwise a new deploy can silently not appear for a long time.
      registration.update();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    }).catch(() => {});

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
