import { useState } from 'react';
import type { DeliveryRequirement } from '@/lib/types';
import { setRequirementStatus } from '@/lib/deliveryActions';

// The 3D requirement tiles, shared by the delivery page and the
// salesperson's "My day" cards: tap to complete, tap again to undo, or use
// the "!" badge to flag an exception with a reason.
export default function RequirementTiles({
  requirements, canEdit, onChanged, onError,
}: {
  requirements: DeliveryRequirement[];
  canEdit: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [exceptionFor, setExceptionFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const resolve = async (id: string, status: 'completed' | 'exception' | 'outstanding', why?: string) => {
    setBusyId(id);
    const err = await setRequirementStatus(id, status, why);
    setBusyId(null);
    if (err) { onError(err); return; }
    setExceptionFor(null);
    setReason('');
    onChanged();
  };

  const flagging = requirements.find((r) => r.id === exceptionFor);
  const withReasons = requirements.filter((r) => r.status === 'exception' && r.exception_reason);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
        {requirements.map((r) => {
          const tone = r.status === 'completed' ? 'is-done' : r.status === 'exception' ? 'is-exception' : 'is-open';
          const next = r.status === 'outstanding' ? 'completed' : 'outstanding';
          return (
            <div key={r.id} style={{ position: 'relative' }}>
              <button
                type="button"
                className={`req-tile ${tone}`}
                disabled={!canEdit || busyId === r.id}
                aria-pressed={r.status !== 'outstanding'}
                title={r.status === 'exception' && r.exception_reason ? r.exception_reason : undefined}
                onClick={() => resolve(r.id, next)}
              >
                <span className="req-tile-shine" />
                <span className="req-tile-body">
                  <TileIcon status={r.status} />
                  <span>{r.label}</span>
                </span>
              </button>
              {r.status === 'outstanding' && canEdit && (
                <button
                  type="button"
                  aria-label={`Flag an exception for ${r.label}`}
                  onClick={() => { setExceptionFor(r.id); setReason(''); }}
                  style={{
                    position: 'absolute', top: -18, right: -18, width: 44, height: 44, borderRadius: '50%',
                    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', background: '#fff', border: '1px solid #f0c98a',
                    color: '#a3520a', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(30,40,60,0.18)',
                  }}>!</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {withReasons.length > 0 && (
        <div style={{ display: 'grid', gap: 3, marginTop: 10 }}>
          {withReasons.map((r) => (
            <div key={r.id} style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              <strong style={{ color: '#b45309' }}>{r.label}:</strong> {r.exception_reason}
            </div>
          ))}
        </div>
      )}

      {flagging && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
            Why couldn't "{flagging.label}" be completed?
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 6 }} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} disabled={!reason.trim() || busyId === flagging.id} onClick={() => resolve(flagging.id, 'exception', reason.trim())}>
              Save exception
            </button>
            <button className="btn secondary" onClick={() => { setExceptionFor(null); setReason(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TileIcon({ status }: { status: DeliveryRequirement['status'] }) {
  if (status === 'completed') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  }
  if (status === 'exception') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}
