import { useState } from 'react';
import { usePwaInstall } from '@/lib/pwaInstall';
import { DownloadIcon } from '@/components/Icons';
import IosInstallModal from '@/components/IosInstallModal';

const DISMISS_KEY = 'pulse_install_prompt_dismissed';

// Floating, dismissible pill shown app-wide (mounted once at the App root,
// above sign-in too) so anyone visiting pulse.rahulchamp.ca sees an install
// option without having to find it buried in Settings. Dismissing it only
// silences it for the current browser session (sessionStorage) — it comes
// back next time they visit, same as most "add to home screen" prompts.
export default function InstallPrompt() {
  const { installed, canPromptInstall, promptInstall, isIOS } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  // Nothing useful to offer: already installed, or this browser supports
  // neither the native install prompt nor has an iOS fallback (e.g. desktop
  // Firefox) — no point showing a banner that can't do anything.
  if (installed || dismissed || (!canPromptInstall && !isIOS)) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const onInstallClick = () => {
    if (canPromptInstall) promptInstall();
    else if (isIOS) setShowIOSSteps(true);
  };

  return (
    <>
      <div
        role="complementary"
        aria-label="Install Axiom Pulse"
        style={{
          position: 'fixed', left: 14, right: 14, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 40,
          maxWidth: 420, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 12px 12px 16px', borderRadius: 16,
          background: 'var(--card)', boxShadow: '-6px -6px 14px var(--neu-hi), 8px 10px 22px var(--neu-lo)',
        }}
      >
        <div style={{ color: 'var(--blue)', display: 'flex', flexShrink: 0 }}><DownloadIcon size={22} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Install Axiom Pulse</div>
          <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 1 }}>One-tap access &amp; delivery alerts</div>
        </div>
        <button type="button" className="btn" style={{ padding: '8px 14px', fontSize: 12.5, flexShrink: 0 }} onClick={onInstallClick}>
          Install
        </button>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          style={{ border: 'none', background: 'transparent', color: 'var(--muted)', fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 4, flexShrink: 0 }}
        >
          ×
        </button>
      </div>
      {showIOSSteps && <IosInstallModal onClose={() => setShowIOSSteps(false)} />}
    </>
  );
}
