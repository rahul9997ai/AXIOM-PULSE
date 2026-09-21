import { usePwaInstall } from '@/lib/pwaInstall';
import { DownloadIcon, ShareIcon } from '@/components/Icons';

export default function InstallAppCard() {
  const { installed, canPromptInstall, promptInstall, isIOS } = usePwaInstall();

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

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ color: 'var(--blue)' }}><DownloadIcon /></div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Install Axiom Pulse</div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
        Add it to your home screen for one-tap access and background delivery notifications, even
        when the app isn't open.
      </p>

      {canPromptInstall && (
        <button className="btn" style={{ width: '100%' }} onClick={promptInstall}>Install app</button>
      )}

      {!canPromptInstall && isIOS && (
        <div style={{ fontSize: 13, color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--blue)' }}><ShareIcon size={16} /></span>
            Tap the <strong>Share</strong> button in Safari
          </div>
          <div>Then choose <strong>Add to Home Screen</strong></div>
        </div>
      )}

      {!canPromptInstall && !isIOS && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
        </div>
      )}
    </div>
  );
}
