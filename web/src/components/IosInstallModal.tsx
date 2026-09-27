import { ShareIcon } from '@/components/Icons';

// Shared between InstallAppCard (Settings) and the floating InstallPrompt —
// iOS has no programmatic install API at all, so both surfaces fall back to
// the same manual Share-sheet instructions.
export default function IosInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
        <button className="btn secondary" style={{ width: '100%', marginTop: 6 }} onClick={onClose}>Got it</button>
      </div>
    </div>
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
