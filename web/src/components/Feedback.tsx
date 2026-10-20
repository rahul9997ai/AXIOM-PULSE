import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// In-app replacements for the browser's alert/confirm boxes: a confirmation
// sheet in Pulse's own style, and a toast with an optional Undo. Both are
// available anywhere through useConfirm() and useToast().

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button, and focus starts on Cancel so Enter can't delete by accident.
  destructive?: boolean;
}

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  duration?: number;
}

interface FeedbackApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (options: ToastOptions) => void;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useConfirm needs <FeedbackProvider>');
  return ctx.confirm;
}

export function useToast() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useToast needs <FeedbackProvider>');
  return ctx.toast;
}

interface PendingConfirm { id: number; options: ConfirmOptions; resolve: (ok: boolean) => void }
interface ActiveToast extends ToastOptions { id: number }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toastState, setToastState] = useState<ActiveToast | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);
  const toastId = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    // A new question replaces any still open one (which counts as "no").
    pendingRef.current?.resolve(false);
    const next = { id: ++toastId.current, options, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);

  const toast = useCallback((options: ToastOptions) => {
    setToastState({ ...options, id: ++toastId.current });
  }, []);

  const api = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {pending && (
        <ConfirmSheet
          key={pending.id}
          options={pending.options}
          onDecide={(ok) => {
            pending.resolve(ok);
            if (pendingRef.current === pending) pendingRef.current = null;
          }}
          onGone={() => setPending((p) => (p === pending ? null : p))}
        />
      )}
      {toastState && <Toast key={toastState.id} toast={toastState} onGone={() => setToastState((t) => (t?.id === toastState.id ? null : t))} />}
    </FeedbackContext.Provider>
  );
}

// ---- Confirmation sheet ----------------------------------------------------

function ConfirmSheet({ options, onDecide, onGone }: { options: ConfirmOptions; onDecide: (ok: boolean) => void; onGone: () => void }) {
  const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive } = options;
  const [leaving, setLeaving] = useState(false);
  const decided = useRef(false);
  const gone = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useRef(`confirm-title-${Math.random().toString(36).slice(2, 8)}`).current;
  const bodyId = `${titleId}-body`;

  const decide = useCallback((ok: boolean) => {
    if (decided.current) return;
    decided.current = true;
    onDecide(ok); // the action can start now; the sheet finishes leaving on its own
    setLeaving(true);
  }, [onDecide]);

  const finish = useCallback(() => {
    if (gone.current) return;
    gone.current = true;
    onGone();
  }, [onGone]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    (destructive ? cancelRef : confirmRef).current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); decide(false); }
      if (e.key === 'Tab') {
        // Keep focus inside the two buttons.
        const a = cancelRef.current; const b = confirmRef.current;
        if (!a || !b) return;
        const active = document.activeElement;
        if (e.shiftKey && active === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && active === b) { e.preventDefault(); a.focus(); }
        else if (active !== a && active !== b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.({ preventScroll: true }); };
  }, [decide, destructive]);

  // Safety net if the exit animation never reports back.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(finish, 500);
    return () => clearTimeout(t);
  }, [leaving, finish]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={message ? bodyId : undefined}
      className={`sheet-scrim confirm-scrim${leaving ? ' is-leaving' : ''}`}
      onClick={() => decide(false)}
    >
      <div
        className={`card sheet confirm-card${leaving ? ' is-leaving' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(e) => { if (leaving && e.target === e.currentTarget) finish(); }}
      >
        <h3 id={titleId} className="confirm-title">{title}</h3>
        {message && <div id={bodyId} className="confirm-body">{message}</div>}
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="btn secondary" onClick={() => decide(false)}>{cancelLabel}</button>
          <button ref={confirmRef} type="button" className={`btn${destructive ? ' btn-danger' : ''}`} onClick={() => decide(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Toast -----------------------------------------------------------------

function Toast({ toast, onGone }: { toast: ActiveToast; onGone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const gone = useRef(false);
  const duration = toast.duration ?? (toast.actionLabel ? 7000 : 4000);

  const finish = useCallback(() => {
    if (gone.current) return;
    gone.current = true;
    onGone();
  }, [onGone]);

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), duration);
    return () => clearTimeout(t);
  }, [duration]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(finish, 400);
    return () => clearTimeout(t);
  }, [leaving, finish]);

  const act = async () => {
    if (busy) return;
    setBusy(true);
    try { await toast.onAction?.(); } finally { setLeaving(true); }
  };

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className={`toast${leaving ? ' is-leaving' : ''}`} onAnimationEnd={(e) => { if (leaving && e.target === e.currentTarget) finish(); }}>
        <span className="toast-text">{toast.message}</span>
        {toast.actionLabel && (
          <button type="button" className="toast-action" disabled={busy} onClick={act}>{toast.actionLabel}</button>
        )}
      </div>
    </div>
  );
}
