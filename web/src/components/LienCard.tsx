import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useConfirm, useToast } from '@/components/Feedback';
import type { Delivery } from '@/lib/types';

// Lien payoff on the trade-in, shown to finance managers. While it's pending,
// Pulse sends 3 reminders (push + email) once the delivery is delivered.
export default function LienCard({ delivery, onChanged }: { delivery: Delivery; onChanged: () => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = delivery.lien_status;
  if (status !== 'pending' && status !== 'paid') return null;

  const write = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('deliveries').update(patch).eq('id', delivery.id);
    setBusy(false);
    if (err) { setError(err.message); return false; }
    onChanged();
    return true;
  };

  const prev = { lien_status: status, lien_paid_at: delivery.lien_paid_at };

  const markPaid = async () => {
    if (!(await confirm({ title: 'Mark the lien as paid off?', message: 'The remaining reminders will stop.', confirmLabel: 'Lien paid off' }))) return;
    if (await write({ lien_status: 'paid', lien_paid_at: new Date().toISOString() })) {
      toast({ message: 'Lien marked as paid off', actionLabel: 'Undo', onAction: async () => { await write(prev); } });
    }
  };
  const noLien = async () => {
    if (await write({ lien_status: 'none', lien_paid_at: null })) {
      toast({ message: 'Lien removed — no reminders will be sent', actionLabel: 'Undo', onAction: async () => { await write(prev); } });
    }
  };

  const sent = delivery.lien_reminders_sent ?? 0;
  const delivered = delivery.status === 'delivered';

  return (
    <div className="card-3d tint-amber lien-card">
      <h2 style={{ margin: 0, fontSize: '0.875rem' }}>Trade-in lien</h2>
      {status === 'paid' ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
          ✓ Paid off{delivery.lien_paid_at ? ` on ${new Date(delivery.lien_paid_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}.
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
            A lien on the trade-in still needs to be paid off.{' '}
            <span style={{ color: 'var(--muted)' }}>
              {delivered ? `Reminders sent: ${sent} of 3.` : 'Reminders start once this delivery is marked delivered.'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" style={{ flex: '1 1 140px' }} disabled={busy} onClick={markPaid}>Lien paid off</button>
            <button type="button" className="btn secondary" style={{ flex: '1 1 140px' }} disabled={busy} onClick={noLien}>No lien after all</button>
          </div>
        </>
      )}
      {error && <div role="alert" style={{ fontSize: '0.75rem', color: '#a3261b' }}>{error}</div>}
    </div>
  );
}
