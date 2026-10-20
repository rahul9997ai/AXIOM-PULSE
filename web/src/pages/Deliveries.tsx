import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Delivery } from '@/lib/types';
import { DEALERSHIP_VIEW_ROLES, MANAGER_ROLES, ROLE_LABEL } from '@/lib/types';
import { monthLabel } from '@/lib/monthClose';
import { monthKeyOf } from '@/lib/bonus';
import { CONFLICT_WINDOW_MIN, findClashes, initials, isActive, requirementProgress, timeLabel } from '@/lib/schedule';
import { useIsDesktop } from '@/lib/useIsDesktop';
import ProgressRing from '@/components/ProgressRing';
import DeliveryCard from '@/components/DeliveryCard';
import StatusBoard from '@/components/StatusBoard';
import SalespersonHome from '@/components/SalespersonHome';
import AdminHome from './AdminHome';

type Chip = 'today' | 'outstanding' | 'ready' | 'mine' | 'all' | 'delivered';
type View = 'list' | 'board';
const VIEW_KEY = 'pulse_home_view';

export default function Deliveries() {
  const { profile, session } = useSession();
  const { isMaster, actingRole, actingDealershipId, isAdminMode, effectiveSalespersonId } = useActingRole();
  const isDesktop = useIsDesktop();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [chip, setChip] = useState<Chip>('today');
  const [search, setSearch] = useState('');
  // The Delivered chip defaults to the current month — older months are one
  // pick away, without an ever-growing list of every delivery ever made.
  const [deliveredMonthKey, setDeliveredMonthKey] = useState(() => monthKeyOf(new Date()));
  const [view, setView] = useState<View>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board'; } catch { return 'board'; }
  });
  const [nudging, setNudging] = useState(false);
  // Installed PWAs get foregrounded from the background rather than
  // reloaded, so a `new Date()` computed only at render time can go stale
  // (countdowns, "Good afternoon") if nothing else re-renders. Refresh it on
  // a timer and whenever the app becomes visible again.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const effectiveRole = isMaster ? actingRole : profile?.role;
  // Dealership-wide view scope — includes the read-only Sales Manager.
  const isManager = effectiveRole ? DEALERSHIP_VIEW_ROLES.includes(effectiveRole) : false;
  // Write actions (nudging salespeople) stay MANAGER_ROLES-only.
  const canWrite = effectiveRole ? MANAGER_ROLES.includes(effectiveRole) : false;
  const isSalespersonView = effectiveRole === 'Salesperson';
  const youId = session?.user.id;

  const load = useCallback(async () => {
    if (!profile || isAdminMode) return;
    let query = supabase
      .from('deliveries')
      .select('*, delivery_requirements(*), lenders(name, address)')
      .order('delivery_at', { ascending: true });
    if (isMaster) {
      if (!actingDealershipId) { setRows([]); setLoading(false); return; }
      query = query.eq('dealership_id', actingDealershipId);
      // Previewing a salesperson shows just that salesperson's deliveries,
      // the same as they'd see themselves.
      if (actingRole === 'Salesperson') {
        if (!effectiveSalespersonId) { setRows([]); setLoading(false); return; }
        query = query.eq('salesperson_id', effectiveSalespersonId);
      }
    } else if (!isManager) {
      query = query.eq('salesperson_id', session?.user.id);
    }
    const { data, error } = await query;
    if (error) setNotice(error.message);
    else setRows((data as Delivery[]) || []);
    setLoading(false);
  }, [profile, isManager, isMaster, isAdminMode, actingRole, actingDealershipId, effectiveSalespersonId, session?.user.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: any change to deliveries or their requirements refreshes the
  // list, so the FSM sees salesperson progress and vice versa, live.
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('pulse-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requirements' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, load]);

  if (isAdminMode) return <AdminHome />;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const atOf = (d: Delivery) => new Date(d.delivery_at);
  const isToday = (d: Delivery) => atOf(d) >= startOfToday && atOf(d) < endOfToday;

  // "This month" for the header ring: the same scheduled-this-month bucket
  // the month-close review uses, so the two numbers always agree.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const scheduledThisMonth = rows.filter((d) => atOf(d) >= monthStart && atOf(d) < monthEnd && d.status !== 'cancelled');
  const deliveredThisMonth = scheduledThisMonth.filter((d) => d.status === 'delivered').length;
  const monthPercent = scheduledThisMonth.length ? (deliveredThisMonth / scheduledThisMonth.length) * 100 : 0;
  const todayCount = rows.filter((d) => isActive(d) && isToday(d)).length;
  const outstandingCount = rows.filter((d) => d.status === 'requirements_outstanding').length;
  const overdueCount = rows.filter((d) => isActive(d) && atOf(d) < now).length;
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateLine = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const header = (
    <div className="card-3d" style={{ padding: '18px 18px 16px', display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{dateLine} · {greeting}</div>
          <div style={{ fontSize: '1.3125rem', fontWeight: 800, marginTop: 2, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.name}</div>
          {isMaster && effectiveRole && (
            <div style={{ fontSize: '0.71875rem', fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>Previewing · {ROLE_LABEL[effectiveRole]}</div>
          )}
        </div>
        <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {initials(profile?.name)}
        </span>
      </div>
      {isManager && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ProgressRing percent={monthPercent} trackColor="var(--line)" fillColor="var(--accent)" textColor="var(--ink)" />
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
              {scheduledThisMonth.length ? `${deliveredThisMonth} of ${scheduledThisMonth.length} delivered this month` : 'No deliveries scheduled this month yet'}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.78125rem', color: 'var(--muted)', fontWeight: 600 }}>
              <span><strong style={{ color: 'var(--ink)' }}>{todayCount}</strong> today</span>
              <span><strong style={{ color: outstandingCount ? '#b45309' : 'var(--ink)' }}>{outstandingCount}</strong> outstanding</span>
              <span><strong style={{ color: overdueCount ? '#dc2626' : 'var(--ink)' }}>{overdueCount}</strong> overdue</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const noticeCard = notice && (
    <div className="card-3d tint-blue" role="status" style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
      <span>{notice}</span>
      <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
    </div>
  );

  if (isSalespersonView) {
    return (
      <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
        {header}
        {noticeCard}
        {loading ? <Skeletons /> : (
          <SalespersonHome rows={rows} now={now} canEdit={effectiveRole === 'Salesperson'} onReload={load} onNotice={setNotice} />
        )}
      </div>
    );
  }

  // ---- manager / FSM / Sales Manager home ----
  const q = search.trim().toLowerCase();
  const matches = (d: Delivery) => !q || [d.customer_name, d.stock_number, d.salesperson_name, d.fsm_name]
    .some((v) => v?.toLowerCase().includes(q));
  const inChip = (d: Delivery): boolean => {
    switch (chip) {
      // Today also carries anything still open from an earlier day — an
      // overdue delivery is exactly what today's attention should be on.
      case 'today': return d.status !== 'cancelled' && (isToday(d) || (isActive(d) && atOf(d) < startOfToday));
      case 'outstanding': return d.status === 'requirements_outstanding';
      case 'ready': return d.status === 'ready' || d.status === 'new';
      case 'mine': return isActive(d) && d.fsm_id === youId;
      case 'all': return isActive(d);
      case 'delivered': return d.status === 'delivered' && monthKeyOf(atOf(d)) === deliveredMonthKey;
    }
  };
  const visible = rows.filter((d) => inChip(d) && matches(d)).sort((a, b) => chip === 'delivered'
    ? (b.delivered_at ?? b.delivery_at).localeCompare(a.delivered_at ?? a.delivery_at)
    : Number(!isActive(a)) - Number(!isActive(b)) || a.delivery_at.localeCompare(b.delivery_at));

  const clashes = findClashes(rows.filter((d) => isActive(d) && atOf(d) >= startOfToday));
  const clashSlots: Delivery[][] = [];
  clashes.forEach((others, id) => {
    const d = rows.find((r) => r.id === id);
    if (!d || clashSlots.some((slot) => slot.some((s) => s.id === id))) return;
    clashSlots.push([d, ...others]);
  });

  const nudgeTargets = rows.filter((d) => isActive(d) && atOf(d) < endOfToday && requirementProgress(d).open > 0);
  const nudge = async () => {
    const people = new Set(nudgeTargets.map((d) => d.salesperson_id)).size;
    if (!window.confirm(`Send a reminder to ${people} salesperson${people === 1 ? '' : 's'} about ${nudgeTargets.length} deliver${nudgeTargets.length === 1 ? 'y' : 'ies'} with items still outstanding?`)) return;
    setNudging(true);
    let reached = 0;
    for (const d of nudgeTargets) {
      const labels = (d.delivery_requirements || []).filter((r) => r.status === 'outstanding').map((r) => r.label);
      const { data } = await supabase.functions.invoke('send-webpush', {
        body: {
          profile_ids: [d.salesperson_id],
          title: `Reminder: ${d.customer_name}`,
          body: `Still needed: ${labels.join(', ')}. Delivery ${timeLabel(atOf(d), now)}.`,
          data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'urgent' },
        },
      }).catch(() => ({ data: null }));
      if (data?.sent) reached++;
    }
    setNudging(false);
    setNotice(reached === nudgeTargets.length
      ? `Reminder sent for ${reached} deliver${reached === 1 ? 'y' : 'ies'}.`
      : `Reminder sent for ${reached} of ${nudgeTargets.length} deliveries — the rest have no device enrolled for push.`);
  };

  const showMine = effectiveRole === 'FSM' || isMaster;
  const chips: [Chip, string][] = [
    ['today', 'Today'], ['outstanding', 'Outstanding'], ['ready', 'Ready'],
    ...(showMine ? [['mine', 'Mine'] as [Chip, string]] : []),
    ['all', 'All active'], ['delivered', 'Delivered'],
  ];
  const chipTitle = chips.find(([c]) => c === chip)?.[1] ?? '';
  const boardAvailable = isDesktop && chip !== 'delivered';
  const showBoard = boardAvailable && view === 'board';
  const setViewPersist = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const deliveredMonthOptions = Array.from(new Set([
    monthKeyOf(now),
    ...rows.filter((d) => d.status === 'delivered').map((d) => monthKeyOf(atOf(d))),
  ])).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return by - ay || bm - am;
  });

  const searchBox = (
    <label className="search-box">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customer, stock # or salesperson"
        aria-label="Search deliveries"
        style={{ border: 'none', outline: 'none', background: 'transparent', padding: 0, fontSize: '0.875rem', flex: 1, minWidth: 0, boxShadow: 'none' }}
      />
    </label>
  );

  const chipRow = (
    <div className="chip-row" role="group" aria-label="Filter deliveries">
      {chips.map(([c, label]) => (
        <button key={c} type="button" className={`chip${chip === c ? ' is-active' : ''}`} aria-pressed={chip === c} onClick={() => setChip(c)}>{label}</button>
      ))}
    </div>
  );

  const monthSelect = chip === 'delivered' && deliveredMonthOptions.length > 1 && (
    <select value={deliveredMonthKey} onChange={(e) => setDeliveredMonthKey(e.target.value)} aria-label="Month" style={isDesktop ? { width: 'auto' } : undefined}>
      {deliveredMonthOptions.map((key) => { const [y, m] = key.split('-').map(Number); return <option key={key} value={key}>{monthLabel(y, m)}</option>; })}
    </select>
  );

  const clashBanner = clashSlots.length > 0 && chip !== 'delivered' && (
    <div role="alert" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: 'var(--banner-warn-bg)', border: '1px solid var(--banner-warn-border)', borderRadius: 12, padding: '11px 14px', fontSize: '0.8125rem', color: 'var(--banner-warn-fg)' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
      <span style={{ flex: 1, minWidth: 200 }}>
        <strong>Scheduling conflict:</strong> {clashSlots[0].map((d) => d.customer_name).join(' and ')} are booked within {CONFLICT_WINDOW_MIN} minutes for the same salesperson or Finance Manager ({timeLabel(atOf(clashSlots[0][0]), now)}).
        {clashSlots.length > 1 && ` ${clashSlots.length - 1} more conflict${clashSlots.length === 2 ? '' : 's'}.`}
      </span>
      {canWrite && <Link to={`/edit/${clashSlots[0][1].id}`} style={{ fontWeight: 800, color: 'inherit' }}>Reschedule one</Link>}
    </div>
  );

  const toolbarActions = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {canWrite && nudgeTargets.length > 0 && (
        <button
          type="button"
          disabled={nudging}
          onClick={nudge}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--banner-warn-border)', background: 'var(--banner-warn-bg)', color: 'var(--banner-warn-fg)', borderRadius: 999, padding: '0 12px', height: 34, fontSize: '0.78125rem', fontWeight: 800, cursor: 'pointer' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          {nudging ? 'Sending…' : `Nudge ${nudgeTargets.length} outstanding`}
        </button>
      )}
      {boardAvailable && (
        <div role="group" aria-label="Layout" style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 3, gap: 3 }}>
          {(['board', 'list'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setViewPersist(v)}
              style={{ border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: '0.78125rem', fontWeight: 700, cursor: 'pointer', background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? '#fff' : 'var(--muted)' }}
            >
              {v === 'board' ? 'Board' : 'List'}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const sectionTitle = (
    <div style={{ fontSize: '0.78125rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
      {chipTitle} · {visible.length} deliver{visible.length === 1 ? 'y' : 'ies'}
    </div>
  );

  const content = (
    <>
      {loading && <Skeletons />}
      {!loading && visible.length === 0 && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 24 }}>
          {q ? 'No deliveries match your search.'
            : chip === 'today' ? 'Nothing scheduled for today.'
            : chip === 'delivered' ? 'No delivered units for this month.'
            : 'Nothing here right now.'}
        </div>
      )}
      {!loading && visible.length > 0 && (showBoard
        ? <StatusBoard rows={visible} now={now} clashes={clashes} showFsm youId={youId} />
        : (
          <div className={isDesktop ? 'card-grid' : undefined} style={isDesktop ? undefined : { display: 'grid', gap: 14 }}>
            {visible.map((d) => (
              <DeliveryCard key={d.id} d={d} now={now} clashWith={clashes.get(d.id)} showSalesperson showFsm youId={youId} />
            ))}
          </div>
        ))}
    </>
  );

  if (isDesktop) {
    const stat = (label: string, value: number, tone: string, target: Chip, hint: string, highlight = true) => (
      <button type="button" className={`stat-tile${highlight && chip === target ? ' is-active' : ''}`} onClick={() => setChip(target)}>
        <span className="stat-tile-label">{label}</span>
        <span className="stat-tile-value" style={{ color: value ? tone : 'var(--ink)' }}>{value}</span>
        <span className="stat-tile-hint">{hint}</span>
      </button>
    );
    return (
      <div className="dash">
        <div className="dash-head">
          <div style={{ minWidth: 0 }}>
            <div className="dash-eyebrow">{dateLine} · {greeting}{isMaster && effectiveRole ? ` · Previewing ${ROLE_LABEL[effectiveRole]}` : ''}</div>
            <h1 className="page-title">Deliveries</h1>
          </div>
          <div style={{ width: 380, maxWidth: '45%' }}>{searchBox}</div>
        </div>

        {isManager && (
          <div className="stat-strip">
            <div className="stat-tile stat-tile-month">
              <ProgressRing percent={monthPercent} trackColor="var(--line)" fillColor="var(--accent)" textColor="var(--ink)" />
              <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                <span className="stat-tile-label">This month</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 800 }}>{deliveredThisMonth} of {scheduledThisMonth.length} delivered</span>
              </div>
            </div>
            {stat('Today', todayCount, 'var(--accent)', 'today', 'scheduled today')}
            {stat('Outstanding', outstandingCount, '#b45309', 'outstanding', 'requirements open')}
            {stat('Overdue', overdueCount, '#dc2626', 'today', 'past delivery time', false)}
          </div>
        )}

        {noticeCard}
        {clashBanner}

        <div className="dash-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
            {chipRow}
            {monthSelect}
          </div>
          {toolbarActions}
        </div>
        {sectionTitle}
        {content}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      {header}
      {noticeCard}
      {searchBox}
      {chipRow}
      {monthSelect}
      {clashBanner}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        {sectionTitle}
        {toolbarActions}
      </div>
      {content}
    </div>
  );
}

function Skeletons() {
  return (
    <div style={{ display: 'grid', gap: 12 }} aria-label="Loading deliveries">
      {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 112, borderRadius: 18 }} />)}
    </div>
  );
}
