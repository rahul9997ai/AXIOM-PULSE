import { useCallback, useEffect, useRef, useState } from 'react';
import { ShareIcon } from '@/components/Icons';

// Shared between InstallAppCard (Settings) and the floating InstallPrompt —
// iOS has no programmatic install API at all, so both surfaces fall back to
// the same manual Share-sheet instructions.
// Resistance that grows the further past its limit something is pulled.
function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Where a release at `velocity` px/s would come to rest, like scroll deceleration.
function projectMomentum(velocity: number, decelerationRate = 0.99): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

export default function IosInstallModal({ onClose }: { onClose: () => void }) {
  // Closing plays the entrance in reverse (the sheet drops back the way it
  // came) before unmounting, instead of vanishing.
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onClose();
  }, [onClose]);
  const close = useCallback(() => setLeaving(true), []);

  // Keyboard: focus moves into the dialog, Escape closes it, and focus goes
  // back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    doneRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.({ preventScroll: true }); };
  }, [close]);

  // Safety net if the exit animation never reports back.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(finish, 500);
    return () => clearTimeout(t);
  }, [leaving, finish]);

  // Drag the sheet down to dismiss. It follows the finger 1:1 (resisting if
  // pulled upward), and on release the finger's velocity is projected forward
  // like scroll momentum: a flick throws it away even from a short drag, a
  // slow drag that stops short springs back.
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ startY: number; samples: { y: number; t: number }[] } | null>(null);

  const dragOffset = (dy: number) => (dy >= 0 ? dy : -rubberband(-dy, 160));
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leaving || (e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.setPointerCapture(e.pointerId);
    sheet.style.animation = 'none'; // an entrance animation would override the live transform
    sheet.style.transition = 'none';
    gesture.current = { startY: e.clientY, samples: [{ y: e.clientY, t: e.timeStamp }] };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; const sheet = sheetRef.current;
    if (!g || !sheet) return;
    g.samples.push({ y: e.clientY, t: e.timeStamp });
    if (g.samples.length > 6) g.samples.shift();
    const offset = dragOffset(e.clientY - g.startY);
    sheet.style.transform = `translateY(${offset}px)`;
    if (scrimRef.current) scrimRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, offset) / (sheet.offsetHeight * 1.2)));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; const sheet = sheetRef.current;
    gesture.current = null;
    if (!g || !sheet) return;
    const offset = dragOffset(e.clientY - g.startY);
    const first = g.samples[0]; const last = g.samples[g.samples.length - 1];
    const velocity = last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0; // px/s
    const landing = offset + projectMomentum(velocity);
    if (landing > sheet.offsetHeight * 0.4) {
      sheet.style.transition = 'transform 0.24s cubic-bezier(0.4, 0, 1, 1)';
      sheet.style.transform = `translateY(${sheet.offsetHeight + 40}px)`;
      if (scrimRef.current) { scrimRef.current.style.transition = 'opacity 0.24s ease-in'; scrimRef.current.style.opacity = '0'; }
      finished.current = false;
      setTimeout(finish, 240);
    } else {
      sheet.style.transition = 'transform 0.5s var(--spring)';
      sheet.style.transform = 'translateY(0)';
      if (scrimRef.current) { scrimRef.current.style.transition = 'opacity 0.3s ease-out'; scrimRef.current.style.opacity = '1'; }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install on iPhone or iPad"
      ref={scrimRef}
      className={`sheet-scrim${leaving ? ' is-leaving' : ''}`}
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 27, 58, 0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onAnimationEnd={(e) => { if (leaving && e.target === e.currentTarget) finish(); }}
        className={`card sheet${leaving ? ' is-leaving' : ''}`}
        style={{ width: '100%', maxWidth: 420, borderRadius: '20px 20px 0 0', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))', touchAction: 'none' }}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 14 }}>Install on iPhone or iPad</div>
        <div style={{ display: 'grid', gap: 14 }}>
          <Step n={1}>
            Tap the <span style={{ color: 'var(--blue)', display: 'inline-flex', verticalAlign: 'middle', margin: '0 4px' }}><ShareIcon size={16} /></span>
            <strong>Share</strong> button in Safari's toolbar
          </Step>
          <Step n={2}>Scroll down and tap <strong>Add to Home Screen</strong></Step>
          <Step n={3}>Tap <strong>Add</strong> — Mahanex Pulse now opens like any other app</Step>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 14 }}>
          This must be done from Safari itself — Apple doesn't allow installing from inside another
          app's browser (e.g. a link opened in Messages or Instagram).
        </p>
        <button ref={doneRef} className="btn secondary" style={{ width: '100%', marginTop: 6 }} onClick={close}>Got it</button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--blue)', color: '#fff',
        fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {n}
      </div>
      <div style={{ fontSize: '0.875rem', lineHeight: 1.4, paddingTop: 2 }}>{children}</div>
    </div>
  );
}
