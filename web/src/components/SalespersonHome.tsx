import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Delivery } from '@/lib/types';
import { HATTRICK_BONUS_CENTS, groupHattricks, monthKeyOf, nextVolumeTier, volumeBonusFor } from '@/lib/bonus';
import { completeDelivery } from '@/lib/deliveryActions';
import { countdown, isActive, isSameDay, requirementProgress, timeLabel } from '@/lib/schedule';
import { monthLabel } from '@/lib/monthClose';
import RequirementTiles from './RequirementTiles';
import DeliveryCard from './DeliveryCard';

type Tab = 'today' | 'upcoming' | 'delivered';

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function SalespersonHome({
  rows, now, canEdit, onReload, onNotice,
}: {
  rows: Delivery[];
  now: Date;
  canEdit: boolean;
  onReload: () => void;
  onNotice: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('today');
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(now));
  const [completingId, setCompletingId] = useState<string | null>(null);

  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const today = rows
    .filter((d) => (isActive(d) && new Date(d.delivery_at) < endOfToday) || (d.status === 'delivered' && isSameDay(new Date(d.delivery_at), now)))
    .sort((a, b) => Number(!isActive(a)) - Number(!isActive(b)) || a.delivery_at.localeCompare(b.delivery_at));
  const upcoming = rows.filter((d) => isActive(d) && new Date(d.delivery_at) >= endOfToday).sort((a, b) => a.delivery_at.localeCompare(b.delivery_at));
  const deliveredAll = rows.filter((d) => d.status === 'delivered');
  const monthOptions = Array.from(new Set([monthKeyOf(now), ...deliveredAll.map((d) => monthKeyOf(new Date(d.delivery_at)))]))
    .sort((a, b) => { const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number); return by - ay || bm - am; });
  const delivered = deliveredAll
    .filter((d) => monthKeyOf(new Date(d.delivery_at)) === monthKey)
    .sort((a, b) => b.delivery_at.localeCompare(a.delivery_at));
  const itemsLeft = today.filter(isActive).reduce((n, d) => n + requirementProgress(d).open, 0);

  const markDelivered = async (d: Delivery) => {
    setCompletingId(d.id);
    const { error, notice } = await completeDelivery(d, d.delivery_requirements || []);
    setCompletingId(null);
    if (error) { onNotice(error); return; }
    if (notice) onNotice(notice);
    onReload();
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <BonusTracker rows={rows} now={now} />

      <div className="chip-row" role="group" aria-label="Show">
        {([['today', `My day · ${today.length}`], ['upcoming', `Upcoming · ${upcoming.length}`], ['delivered', 'Delivered']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" className={`chip${tab === key ? ' is-active' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          {itemsLeft > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
              <span>{itemsLeft} item{itemsLeft === 1 ? '' : 's'} left today</span>
              <span style={{ display: 'flex', gap: 10 }}>
                <Legend color="var(--accent)" label="Done" />
                <Legend color="var(--btn3d-lo)" label="To do" border />
                <Legend color="#b06a12" label="Exception" />
              </span>
            </div>
          )}
          {today.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 24 }}>
              Nothing scheduled for today. Check Upcoming or the Calendar.
            </div>
          )}
          {today.map((d) => {
            if (!isActive(d)) return <DeliveryCard key={d.id} d={d} now={now} />;
            const reqs = d.delivery_requirements || [];
            const { open } = requirementProgress(d);
            const due = countdown(d, now);
            return (
              <div key={d.id} className="card-3d tint-blue" style={{ display: 'grid', gap: 14, padding: 14 }}>
                <Link to={`/delivery/${d.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{d.customer_name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {d.stock_number && <span className="pill pill-stock">#{d.stock_number}</span>}
                      {d.vehicle_condition && <span className="pill pill-plain">{d.vehicle_condition === 'new' ? 'New' : 'Used'}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', justifyItems: 'end', gap: 4, flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{timeLabel(new Date(d.delivery_at), now)}</div>
                    <span className={`pill pill-${due.tone}`}>{due.label}</span>
                  </div>
                </Link>
                {reqs.length > 0 && (
                  <RequirementTiles requirements={reqs} canEdit={canEdit} delivery={d} onChanged={onReload} onError={onNotice} />
                )}
                {canEdit && (
                  <button
                    type="button"
                    className={open > 0 ? 'btn secondary' : 'btn'}
                    disabled={open > 0 || completingId === d.id}
                    onClick={() => markDelivered(d)}
                  >
                    {open > 0 ? `${open} item${open === 1 ? '' : 's'} left before delivery` : completingId === d.id ? 'Marking delivered…' : 'Mark vehicle delivered'}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'upcoming' && (
        <>
          {upcoming.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 24 }}>No upcoming deliveries yet.</div>}
          {upcoming.map((d) => <DeliveryCard key={d.id} d={d} now={now} />)}
        </>
      )}

      {tab === 'delivered' && (
        <>
          {monthOptions.length > 1 && (
            <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)} aria-label="Month">
              {monthOptions.map((key) => { const [y, m] = key.split('-').map(Number); return <option key={key} value={key}>{monthLabel(y, m)}</option>; })}
            </select>
          )}
          {delivered.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 24 }}>No delivered units for this month.</div>}
          {delivered.map((d) => <DeliveryCard key={d.id} d={d} now={now} />)}
        </>
      )}
    </div>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, border: border ? '1px solid var(--btn3d-border)' : 'none' }} />
      {label}
    </span>
  );
}

// Live version of the monthly report's bonus math (lib/bonus.ts) — same
// rules, so what a salesperson sees here is what the PDF will pay out.
function BonusTracker({ rows, now }: { rows: Delivery[]; now: Date }) {
  const key = monthKeyOf(now);
  const count = rows.filter((d) => d.status === 'delivered' && monthKeyOf(new Date(d.delivery_at)) === key).length;
  const volume = volumeBonusFor(count);
  const next = nextVolumeTier(count);
  const groups = groupHattricks(rows.filter((d) => d.sold_at).map((d) => ({
    id: d.id, customer_name: d.customer_name, stock_number: d.stock_number, delivery_at: d.delivery_at,
    delivered_at: d.delivered_at, sold_at: d.sold_at as string, status: d.status,
  })));
  const earnedGroups = groups.filter((g) => g.allDelivered && g.completedAt && monthKeyOf(new Date(g.completedAt)) === key);
  const pending = groups.filter((g) => !g.allDelivered)
    .map((g) => ({ delivered: g.members.filter((m) => m.status === 'delivered').length, total: g.members.length }))
    .sort((a, b) => (b.delivered / b.total) - (a.delivered / a.total));
  const earned = (volume?.cents ?? 0) + earnedGroups.length * HATTRICK_BONUS_CENTS;
  const pct = next ? Math.min(100, Math.round((count / next.count) * 100)) : 100;
  const month = now.toLocaleDateString([], { month: 'long' });

  return (
    <section aria-label={`${month} bonus tracker`} style={{ background: '#1e3a8a', color: '#fff', borderRadius: 18, padding: 18, display: 'grid', gap: 14, boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 10px 24px rgba(30,58,138,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c9d6f2' }}>{month} bonus tracker</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{count}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#dbe4f7' }}>delivered</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'grid', gap: 2 }}>
          <div style={{ fontSize: 12, color: '#c9d6f2', fontWeight: 600 }}>Earned so far</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{dollars(earned)}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        <div style={{ height: 10, background: '#34509b', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, fontWeight: 600, color: '#dbe4f7' }}>
          <span>
            {next
              ? <><strong style={{ color: '#fff' }}>{next.count - count} more</strong> {volume ? `to reach the ${dollars(next.cents)} tier` : `to unlock the ${dollars(next.cents)} volume bonus`}</>
              : <strong style={{ color: '#fff' }}>Top volume tier reached</strong>}
          </span>
          <span>{count} / {next ? next.count : count}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <div style={{ background: '#2a4799', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 3 }}>
          <div style={{ fontSize: 11.5, color: '#c9d6f2', fontWeight: 700 }}>Hat-tricks this month</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{earnedGroups.length} · {dollars(earnedGroups.length * HATTRICK_BONUS_CENTS)}</div>
        </div>
        <div style={{ background: '#2a4799', borderRadius: 12, padding: '10px 12px', display: 'grid', gap: 3 }}>
          <div style={{ fontSize: 11.5, color: '#c9d6f2', fontWeight: 700 }}>Pending hat-trick</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {pending.length ? `${pending[0].delivered} / ${pending[0].total} delivered${pending.length > 1 ? ` +${pending.length - 1}` : ''}` : 'None in progress'}
          </div>
        </div>
      </div>
    </section>
  );
}
