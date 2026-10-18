import { Link } from 'react-router-dom';
import type { Delivery } from '@/lib/types';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/types';
import { countdown, initials, requirementProgress, timeLabel } from '@/lib/schedule';

// One delivery at a glance: when, how urgent, how close to ready, and who's
// on it — so an FSM can scan the day without opening anything.
export default function DeliveryCard({
  d, now, clashWith, showSalesperson, showFsm, compact, youId,
}: {
  d: Delivery;
  now: Date;
  clashWith?: Delivery[];
  showSalesperson?: boolean;
  showFsm?: boolean;
  compact?: boolean;
  youId?: string;
}) {
  const at = new Date(d.delivery_at);
  const due = countdown(d, now);
  const { done, total } = requirementProgress(d);
  const sc = STATUS_COLOR[d.status];

  return (
    <Link
      to={`/delivery/${d.id}`}
      className="card-3d tint-blue"
      style={{ display: 'grid', gap: compact ? 8 : 10, padding: compact ? '12px 13px' : 14, textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: compact ? 14.5 : 16, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.customer_name}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {d.stock_number && <span className="pill pill-stock">#{d.stock_number}</span>}
            {d.vehicle_condition && <span className="pill pill-plain">{d.vehicle_condition === 'new' ? 'New' : 'Used'}</span>}
            {!compact && (
              <span className="pill" style={{ background: sc.bg, color: sc.fg }}>{STATUS_LABEL[d.status]}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: compact ? 13.5 : 14.5, fontWeight: 800, textAlign: 'right' }}>{timeLabel(at, now)}</div>
          <span className={`pill pill-${due.tone}`}>{due.label}</span>
        </div>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="progress-track">
            <div className={`progress-fill${done === total ? ' is-complete' : ''}`} style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{done}/{total} ready</span>
        </div>
      )}

      {(showSalesperson || showFsm || d.lenders?.name || clashWith?.length) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4, minWidth: 0, fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
            {showSalesperson && d.salesperson_name && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', color: 'var(--text)' }}>
                <span className="avatar" aria-hidden="true">{initials(d.salesperson_name)}</span>
                {d.salesperson_name}
              </span>
            )}
            {showFsm && d.fsm_name && <span style={{ whiteSpace: 'nowrap' }}>· FM {d.fsm_name}{d.fsm_id === youId ? ' (You)' : ''}</span>}
            {!compact && d.lenders?.name && <span style={{ whiteSpace: 'nowrap' }}>· {d.lenders.name}</span>}
          </div>
          {clashWith && clashWith.length > 0 && (
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#b45309' }}>
              Conflicts with {clashWith.map((o) => o.customer_name.split(' ')[0]).join(', ')}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
