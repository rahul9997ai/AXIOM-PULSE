import type { Delivery, DeliveryStatus } from '@/lib/types';
import { STATUS_COLOR } from '@/lib/types';
import DeliveryCard from './DeliveryCard';

const COLUMNS: { status: DeliveryStatus; title: string }[] = [
  { status: 'new', title: 'New' },
  { status: 'requirements_outstanding', title: 'Outstanding' },
  { status: 'ready', title: 'Ready' },
  { status: 'delivered', title: 'Delivered' },
];

// Desktop-only: the same deliveries as the list, laid out by stage so a
// Finance Manager sees the whole day's flow at once. "New" only appears
// when something actually has no requirements yet.
export default function StatusBoard({
  rows, now, clashes, showFsm, youId,
}: {
  rows: Delivery[];
  now: Date;
  clashes: Map<string, Delivery[]>;
  showFsm: boolean;
  youId?: string;
}) {
  const columns = COLUMNS
    .map((c) => ({ ...c, cards: rows.filter((d) => d.status === c.status) }))
    .filter((c) => c.status !== 'new' || c.cards.length > 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))`, gap: 14, alignItems: 'start', overflowX: 'auto' }}>
      {columns.map((col) => (
        <section
          key={col.status}
          aria-label={col.title}
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 12, display: 'grid', gap: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[col.status].solid }} />
              <h2 style={{ margin: 0, fontSize: '0.78125rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{col.title}</h2>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text)', background: 'var(--focus-bg)', borderRadius: 999, padding: '2px 9px' }}>{col.cards.length}</span>
          </div>
          {col.cards.length === 0 && (
            <div style={{ fontSize: '0.78125rem', color: 'var(--muted)', textAlign: 'center', padding: '14px 0' }}>Nothing here</div>
          )}
          {col.cards.map((d) => (
            <DeliveryCard key={d.id} d={d} now={now} clashWith={clashes.get(d.id)} showSalesperson showFsm={showFsm} youId={youId} compact />
          ))}
        </section>
      ))}
    </div>
  );
}
