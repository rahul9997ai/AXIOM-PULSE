import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReminderSettings from '@/components/ReminderSettings';
import ThankYouSettingsPanel from '@/components/ThankYouSettingsPanel';
import NotifyEmailCard from '@/components/NotifyEmailCard';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import { MANAGER_ROLES } from '@/lib/types';
import InstallAppCard from '@/components/InstallAppCard';
import PushCard from '@/components/PushCard';
import { LogOutIcon } from '@/components/Icons';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';
import { downloadMonthlyReport, shareMonthlyReport, type DealershipDetails, type HattrickGroup, type HattrickPendingGroup, type MonthlyReportRow } from '@/lib/monthlyReport';
import { downloadDealershipReport, shareDealershipReport, type DealershipReportRow } from '@/lib/dealershipReport';
import { monthLabel, monthRange } from '@/lib/monthClose';
import { groupHattricks, monthKeyOf, type HattrickRow } from '@/lib/bonus';

interface Dealership { id: string; name: string; }


const EMPTY_DEALERSHIP: DealershipDetails = { name: '', address: '', city: '', phone: '', dealerCode: '' };

export default function Settings() {
  const { profile } = useSession();
  const { actingDealershipId, effectiveRole, effectiveSalespersonId, salespeople, actingSalespersonId } = useActingRole();
  const isMaster = profile?.role === 'Master Administrator';
  const canManageLists = profile ? MANAGER_ROLES.includes(profile.role) : false;
  // A Master previewing the app as "Salesperson" (via the Viewing-as bar)
  // should see this feature too, not just a real Salesperson — effectiveRole
  // already resolves to the previewed role for a Master, or the real role
  // for everyone else.
  const isSalesperson = effectiveRole === 'Salesperson';
  // Read-only, dealership-wide: sees the same report feature but for every
  // salesperson combined, not themselves — gets its own card and PDF below.
  const isSalesManager = effectiveRole === 'Sales Manager';
  // The report's "whose data" — effectiveSalespersonId already resolves to
  // whichever salesperson the Master picked in the Viewing-as bar, or the
  // real signed-in user otherwise.
  const reportSalespersonName = (isMaster && effectiveRole === 'Salesperson')
    ? (salespeople.find((s) => s.id === actingSalespersonId)?.name ?? 'Salesperson')
    : (profile?.name ?? 'Salesperson');
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [reportBusy, setReportBusy] = useState<'download' | 'share' | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const now = new Date();
  const [reportMonthKey, setReportMonthKey] = useState(`${now.getFullYear()}-${now.getMonth() + 1}`);
  const [reportMonthOptions, setReportMonthOptions] = useState<{ year: number; month: number }[]>([
    { year: now.getFullYear(), month: now.getMonth() + 1 },
  ]);
  const [reportRows, setReportRows] = useState<MonthlyReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [hattrickRows, setHattrickRows] = useState<HattrickRow[]>([]);
  const [reportDealership, setReportDealership] = useState<DealershipDetails | null>(null);
  const [dealershipReportRows, setDealershipReportRows] = useState<DealershipReportRow[]>([]);

  const onSetTheme = (t: Theme) => { setTheme(t); applyTheme(t, { animate: true }); };

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState(actingDealershipId);
  const dealershipId = isMaster ? selectedDealershipId : (profile?.dealership_id ?? '');

  // If the Master switches dealerships via the "Viewing as" bar elsewhere,
  // this dropdown needs to follow — otherwise lender/template edits made
  // here can silently target whichever dealership was selected when this
  // page first mounted.
  useEffect(() => {
    if (isMaster && actingDealershipId) setSelectedDealershipId(actingDealershipId);
  }, [isMaster, actingDealershipId]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMaster) return;
    supabase.from('dealerships').select('id,name').order('name')
      .then(({ data, error }) => {
        if (error) { setError(error.message); return; }
        const list = (data as Dealership[]) || [];
        setDealerships(list);
        setSelectedDealershipId((prev) => prev || list[0]?.id || '');
      });
  }, [isMaster]);


  // The report's month picker only needs to go back as far as this
  // salesperson's very first delivery — no point offering empty months
  // from before they started using Pulse.
  useEffect(() => {
    if (!isSalesperson || !effectiveSalespersonId) return;
    supabase
      .from('deliveries')
      .select('delivery_at')
      .eq('salesperson_id', effectiveSalespersonId)
      .order('delivery_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        const earliest = data?.[0]?.delivery_at ? new Date(data[0].delivery_at) : now;
        const options: { year: number; month: number }[] = [];
        const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
        const floor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        while (cursor >= floor) {
          options.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
          cursor.setMonth(cursor.getMonth() - 1);
        }
        setReportMonthOptions(options.length ? options : [{ year: now.getFullYear(), month: now.getMonth() + 1 }]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesperson, effectiveSalespersonId]);

  // Same idea for a Sales Manager, but scoped to the whole dealership's
  // earliest delivery rather than one salesperson's.
  useEffect(() => {
    if (!isSalesManager || !dealershipId) return;
    supabase
      .from('deliveries')
      .select('delivery_at')
      .eq('dealership_id', dealershipId)
      .order('delivery_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        const earliest = data?.[0]?.delivery_at ? new Date(data[0].delivery_at) : now;
        const options: { year: number; month: number }[] = [];
        const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
        const floor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        while (cursor >= floor) {
          options.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
          cursor.setMonth(cursor.getMonth() - 1);
        }
        setReportMonthOptions(options.length ? options : [{ year: now.getFullYear(), month: now.getMonth() + 1 }]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesManager, dealershipId]);

  // Dealership details for the report footer. Uses dealershipId (not
  // profile.dealership_id directly) so a Master previewing as Salesperson
  // gets the dealership they're currently viewing as, since a Master's own
  // profile isn't tied to any single dealership.
  useEffect(() => {
    if (!(isSalesperson || isSalesManager) || !dealershipId) return;
    supabase
      .from('dealerships')
      .select('name, data')
      .eq('id', dealershipId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = (data.data as Record<string, string>) || {};
        setReportDealership({
          name: data.name,
          address: d.address || '',
          city: d.city || '',
          phone: d.phone || '',
          dealerCode: d.dealerCode || '',
        });
      });
  }, [isSalesperson, isSalesManager, dealershipId]);

  // Every sold-dated delivery for this salesperson, regardless of month or
  // status — a hat-trick group's membership and completion state can span
  // months, so it can't be computed from a single month's rows the way the
  // main report table is.
  useEffect(() => {
    if (!isSalesperson || !effectiveSalespersonId) { setHattrickRows([]); return; }
    supabase
      .from('deliveries')
      .select('id, customer_name, stock_number, delivery_at, delivered_at, sold_at, status')
      .eq('salesperson_id', effectiveSalespersonId)
      .not('sold_at', 'is', null)
      .then(({ data }) => setHattrickRows((data as HattrickRow[]) || []));
  }, [isSalesperson, effectiveSalespersonId]);

  const hattrickCandidates = groupHattricks(hattrickRows);
  // Only groups that finished delivering IN the selected report month
  // belong on that month's PDF — the bonus is paid once, when the group
  // completes, not split across the months its members happened to deliver in.
  const completedThisMonth = hattrickCandidates.filter(
    (g) => g.allDelivered && g.completedAt && monthKeyOf(new Date(g.completedAt)) === reportMonthKey,
  );
  const pendingHattricks = hattrickCandidates.filter((g) => !g.allDelivered);
  const reportHattrickGroups: HattrickGroup[] = completedThisMonth.map((g) => ({
    sold_at: g.soldAt,
    completed_at: g.completedAt!,
    members: g.members.map((m) => ({ id: m.id, customer_name: m.customer_name, stock_number: m.stock_number, delivery_at: m.delivery_at })),
  }));
  const reportPendingHattricks: HattrickPendingGroup[] = pendingHattricks.map((g) => ({
    sold_at: g.soldAt,
    members: g.members.map((m) => ({ customer_name: m.customer_name, stock_number: m.stock_number, delivered: m.status === 'delivered' })),
  }));

  // Every delivered unit dealership-wide for the selected month — no
  // bonus content (that's personal payroll info, not a manager's business)
  // and no per-salesperson narrowing, since a Sales Manager sees everyone.
  useEffect(() => {
    if (!isSalesManager || !dealershipId) { setDealershipReportRows([]); return; }
    setReportLoading(true);
    setReportNotice(null);
    const [yearStr, monthStr] = reportMonthKey.split('-');
    const { start, end } = monthRange(Number(yearStr), Number(monthStr));
    supabase
      .from('deliveries')
      .select('id, customer_name, stock_number, salesperson_name, fsm_name, delivery_at, vehicle_condition')
      .eq('dealership_id', dealershipId)
      .eq('status', 'delivered')
      .gte('delivery_at', start.toISOString())
      .lt('delivery_at', end.toISOString())
      .order('delivery_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { setReportNotice(error.message); setReportLoading(false); return; }
        setDealershipReportRows((data as DealershipReportRow[]) || []);
        setReportLoading(false);
      });
  }, [isSalesManager, dealershipId, reportMonthKey]);

  const runDownloadDealershipReport = async () => {
    if (dealershipReportRows.length === 0) { setReportNotice('No deliveries marked complete for this month yet.'); return; }
    setReportBusy('download');
    setReportNotice(null);
    const [y, m] = reportMonthKey.split('-').map(Number);
    const label = monthLabel(y, m);
    await downloadDealershipReport(dealershipReportRows, reportDealership?.name ?? 'Dealership', label, profile?.name ?? 'Sales Manager', reportDealership ?? EMPTY_DEALERSHIP);
    setReportBusy(null);
  };

  const runShareDealershipReport = async () => {
    if (dealershipReportRows.length === 0) { setReportNotice('No deliveries marked complete for this month yet.'); return; }
    setReportBusy('share');
    setReportNotice(null);
    const [y, m] = reportMonthKey.split('-').map(Number);
    const label = monthLabel(y, m);
    const outcome = await shareDealershipReport(dealershipReportRows, reportDealership?.name ?? 'Dealership', label, profile?.name ?? 'Sales Manager', reportDealership ?? EMPTY_DEALERSHIP);
    setReportBusy(null);
    if (outcome === 'downloaded') {
      setReportNotice('Your browser can\'t share files directly, so the PDF downloaded instead — attach it to an email yourself.');
    }
  };

  // Bucketed by the delivery's scheduled date (delivery_at), not when it
  // was actually marked delivered — a vehicle scheduled for Sep 30 but
  // only marked delivered Oct 1 still belongs in the September report,
  // not October's.
  const fetchReportForSelectedMonth = async (): Promise<{ rows: MonthlyReportRow[]; label: string } | null> => {
    if (!effectiveSalespersonId) return null;
    const [yearStr, monthStr] = reportMonthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const { start, end } = monthRange(year, month);
    const label = monthLabel(year, month);
    const { data, error } = await supabase
      .from('deliveries')
      .select('id, customer_name, stock_number, fsm_name, delivery_at')
      .eq('salesperson_id', effectiveSalespersonId)
      .eq('status', 'delivered')
      .gte('delivery_at', start.toISOString())
      .lt('delivery_at', end.toISOString())
      .order('delivery_at', { ascending: true });
    if (error) { setReportNotice(error.message); return null; }
    return { rows: (data as MonthlyReportRow[]) || [], label };
  };

  // Reloads the delivery list (for the hat-trick checkboxes) whenever the
  // selected month — or, for a Master, the previewed salesperson — changes.
  // The bonus selection doesn't carry over between months or salespeople,
  // since it's a per-month, hand-picked flag.
  useEffect(() => {
    if (!isSalesperson || !effectiveSalespersonId) { setReportRows([]); return; }
    setReportLoading(true);
    setReportNotice(null);
    fetchReportForSelectedMonth().then((result) => {
      setReportRows(result?.rows ?? []);
      setReportLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesperson, effectiveSalespersonId, reportMonthKey]);

  const runDownloadReport = async () => {
    if (reportRows.length === 0) { setReportNotice('No deliveries marked complete for this month yet.'); return; }
    setReportBusy('download');
    setReportNotice(null);
    const label = (() => {
      const [y, m] = reportMonthKey.split('-').map(Number);
      return monthLabel(y, m);
    })();
    await downloadMonthlyReport(reportRows, reportSalespersonName, label, reportDealership ?? EMPTY_DEALERSHIP, reportHattrickGroups, reportPendingHattricks);
    setReportBusy(null);
  };

  const runShareReport = async () => {
    if (reportRows.length === 0) { setReportNotice('No deliveries marked complete for this month yet.'); return; }
    setReportBusy('share');
    setReportNotice(null);
    const label = (() => {
      const [y, m] = reportMonthKey.split('-').map(Number);
      return monthLabel(y, m);
    })();
    const outcome = await shareMonthlyReport(reportRows, reportSalespersonName, label, reportDealership ?? EMPTY_DEALERSHIP, reportHattrickGroups, reportPendingHattricks);
    setReportBusy(null);
    if (outcome === 'downloaded') {
      setReportNotice('Your browser can\'t share files directly, so the PDF downloaded instead — attach it to an email yourself.');
    }
  };

  return (
    <div className="settings-page">
      <h1 className="page-title">Settings</h1>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{profile?.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{profile?.role}</div>
          </div>
          <button
            type="button"
            className="btn secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.8125rem' }}
            onClick={() => supabase.auth.signOut()}
          >
            <LogOutIcon size={16} /> Sign out
          </button>
        </div>
      </div>

      <NotifyEmailCard />

      <div className="card">
        <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, marginBottom: 10 }}>APPEARANCE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={theme === t ? 'btn' : 'btn secondary'}
              style={{ flex: 1, textTransform: 'capitalize' }}
              onClick={() => onSetTheme(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isSalesperson && (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, marginBottom: 6 }}>MONTHLY REPORT</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 0, marginBottom: 12 }}>
            A PDF of every delivery completed for the selected month — customer name, Finance Manager and delivery date.
            {isMaster && ` Viewing ${reportSalespersonName}'s report.`}
          </p>
          <select
            value={reportMonthKey}
            onChange={(e) => setReportMonthKey(e.target.value)}
            style={{ marginBottom: 10 }}
          >
            {reportMonthOptions.map(({ year, month }) => (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>{monthLabel(year, month)}</option>
            ))}
          </select>

          {reportLoading && <div style={{ color: 'var(--muted)', fontSize: '0.78125rem', marginBottom: 10 }}>Loading deliveries…</div>}

          {!reportLoading && completedThisMonth.length > 0 && (
            <div style={{
              marginBottom: 12, padding: 10, borderRadius: 10,
              background: 'var(--banner-ok-bg)', border: '1px solid var(--banner-ok-border)',
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.78125rem', color: 'var(--banner-ok-fg)' }}>
                {completedThisMonth.length === 1 ? '1 hat-trick bonus' : `${completedThisMonth.length} hat-trick bonuses`} complete this month
              </div>
              <div style={{ fontSize: '0.71875rem', color: 'var(--banner-ok-fg)', marginTop: 3, opacity: 0.9 }}>
                Detected automatically from sold dates — included on the PDF below.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn secondary" style={{ flex: 1 }} disabled={reportBusy !== null} onClick={runDownloadReport}>
              {reportBusy === 'download' ? 'Preparing…' : 'Download PDF'}
            </button>
            <button type="button" className="btn" style={{ flex: 1 }} disabled={reportBusy !== null} onClick={runShareReport}>
              {reportBusy === 'share' ? 'Preparing…' : 'Share / Email'}
            </button>
          </div>
          {reportNotice && <p style={{ color: 'var(--muted)', fontSize: '0.78125rem', marginTop: 10, marginBottom: 0 }}>{reportNotice}</p>}
        </div>
      )}

      {isSalesperson && pendingHattricks.length > 0 && (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, marginBottom: 6 }}>PENDING HAT-TRICKS</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 0, marginBottom: 10 }}>
            3+ vehicles sold the same day — included on the PDF as a status snapshot, and the bonus itself moves into the report once every one of them is delivered.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {pendingHattricks.map((g) => {
              const outstanding = g.members.filter((m) => m.status !== 'delivered');
              return (
                <div key={g.soldAt} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                    Sold {new Date(`${g.soldAt}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {g.members.length} vehicles
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                    Still waiting on: {outstanding.map((m) => m.customer_name).join(', ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSalesManager && (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, marginBottom: 6 }}>DEALERSHIP DELIVERY REPORT</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 0, marginBottom: 12 }}>
            A PDF of every delivery completed dealership-wide for the selected month — customer name, salesperson, Finance Manager and delivery date.
          </p>
          <select
            value={reportMonthKey}
            onChange={(e) => setReportMonthKey(e.target.value)}
            style={{ marginBottom: 10 }}
          >
            {reportMonthOptions.map(({ year, month }) => (
              <option key={`${year}-${month}`} value={`${year}-${month}`}>{monthLabel(year, month)}</option>
            ))}
          </select>

          {reportLoading && <div style={{ color: 'var(--muted)', fontSize: '0.78125rem', marginBottom: 10 }}>Loading deliveries…</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn secondary" style={{ flex: 1 }} disabled={reportBusy !== null} onClick={runDownloadDealershipReport}>
              {reportBusy === 'download' ? 'Preparing…' : 'Download PDF'}
            </button>
            <button type="button" className="btn" style={{ flex: 1 }} disabled={reportBusy !== null} onClick={runShareDealershipReport}>
              {reportBusy === 'share' ? 'Preparing…' : 'Share / Email'}
            </button>
          </div>
          {reportNotice && <p style={{ color: 'var(--muted)', fontSize: '0.78125rem', marginTop: 10, marginBottom: 0 }}>{reportNotice}</p>}
        </div>
      )}

      <InstallAppCard />

      <PushCard />

      {canManageLists && isMaster && (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, marginBottom: 8 }}>DEALERSHIP</div>
          <select value={selectedDealershipId} onChange={(e) => setSelectedDealershipId(e.target.value)}>
            {dealerships.length === 0 && <option value="">No dealerships yet</option>}
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {(isMaster || profile?.role === 'General Manager') && dealershipId && <ReminderSettings dealershipId={dealershipId} />}

      {(isMaster || profile?.role === 'General Manager') && dealershipId && <ThankYouSettingsPanel dealershipId={dealershipId} />}

      {error && <div className="card" style={{ fontSize: '0.8125rem', color: '#a3261b' }}>{error}</div>}

      {canManageLists && (
        <Link to="/lenders" className="card settings-link">
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Lenders &amp; requirements</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 2 }}>Lenders, lessors and the requirement checklist offered on new deliveries.</div>
          </div>
          <span aria-hidden="true" style={{ fontSize: '1.25rem', color: 'var(--muted)' }}>›</span>
        </Link>
      )}
    </div>
  );
}
