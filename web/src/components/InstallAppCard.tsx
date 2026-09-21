import { useState } from 'react';
import { usePwaInstall } from '@/lib/pwaInstall';
import { DownloadIcon, ShareIcon } from '@/components/Icons';

export default function InstallAppCard() {
  const { installed, canPromptInstall, promptInstall, isIOS } = usePwaInstall();
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  if (installed) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color: '#15803d' }}><DownloadIcon /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Axiom Pulse is installed</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>You're using the installed app.</div>
          </div>
        </div>
      </div>
    );
  }

  const onInstallClick = () => {
    if (canPromptInstall) promptInstall();
    else if (isIOS) setShowIOSSteps(true);
  };

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ color: 'var(--blue)' }}><DownloadIcon /></div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Install Axiom Pulse</div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Add it to your home screen for one-tap access and background delivery notifications, even
          when the app isn't open.
        </p>
        <button className="btn" style={{ width: '100%' }} onClick={onInstallClick}>
          Install app
        </button>
        {!canPromptInstall && !isIOS && (
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            If nothing happens, open your browser menu and choose <strong>Install app</strong> — some
            browsers don't support installing from a button yet.
          </p>
        )}
      </div>

      {showIOSSteps && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowIOSSteps(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 27, 58, 0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: '100%', maxWidth: 420, borderRadius: '20px 20px 0 0', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Install on iPhone or iPad</div>
            <div style={{ display: 'grid', gap: 14 }}>
              <Step n={1}>
                Tap the <span style={{ color: 'var(--blue)', display: 'inline-flex', verticalAlign: 'middle', margin: '0 4px' }}><ShareIcon size={16} /></span>
                <strong>Share</strong> button in Safari's toolbar
              </Step>
              <Step n={2}>Scroll down and tap <strong>Add to Home Screen</strong></Step>
              <Step n={3}>Tap <strong>Add</strong> — Axiom Pulse now opens like any other app</Step>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14 }}>
              This must be done from Safari itself — Apple doesn't allow installing from inside another
              app's browser (e.g. a link opened in Messages or Instagram).
            </p>
            <button className="btn secondary" style={{ width: '100%', marginTop: 6 }} onClick={() => setShowIOSSteps(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--blue)', color: '#fff',
        fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {n}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.4, paddingTop: 2 }}>{children}</div>
    </div>
  );
}
