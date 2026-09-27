import { useState } from 'react';
import { usePwaInstall } from '@/lib/pwaInstall';
import { DownloadIcon } from '@/components/Icons';
import IosInstallModal from '@/components/IosInstallModal';

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

      {showIOSSteps && <IosInstallModal onClose={() => setShowIOSSteps(false)} />}
    </>
  );
}
