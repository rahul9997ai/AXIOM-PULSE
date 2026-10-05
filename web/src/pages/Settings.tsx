import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Lender, RequirementTemplate } from '@/lib/types';
import { MANAGER_ROLES } from '@/lib/types';
import InstallAppCard from '@/components/InstallAppCard';
import PushCard from '@/components/PushCard';
import { LogOutIcon } from '@/components/Icons';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';
import { downloadMonthlyReport, shareMonthlyReport, type DealershipDetails, type HattrickGroup, type MonthlyReportRow } from '@/lib/monthlyReport';
import { monthLabel, monthRange } from '@/lib/monthClose';

interface Dealership { id: string; name: string; }

interface HattrickRow {
  id: string;
  customer_name: string;
  stock_number: string | null;
  delivery_at: string;
  delivered_at: string | null;
  sold_at: string;
  status: string;
}

interface HattrickCandidate {
  soldAt: string;
  members: HattrickRow[];
  allDelivered: boolean;
  completedAt: string | null;
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

const FK_IN_USE = '23503';
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

  const onSetTheme = (t: Theme) => { setTheme(t); applyTheme(t); };

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

  const [lenders, setLenders] = useState<Lender[]>([]);
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [addressDrafts, setAddressDrafts] = useState<Record<string, string>>({});
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [newLender, setNewLender] = useState('');
  const [newLenderAddress, setNewLenderAddress] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
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

  const load = async () => {
    if (!dealershipId) { setLenders([]); setTemplates([]); return; }
    const [{ data: l, error: lErr }, { data: t, error: tErr }] = await Promise.all([
      supabase.from('lenders').select('*').eq('dealership_id', dealershipId).order('name'),
      supabase.from('requirement_templates').select('*').eq('dealership_id', dealershipId).order('sort_order'),
    ]);
    if (lErr || tErr) { setError((lErr ?? tErr)!.message); return; }
    const lenderList = (l as Lender[]) || [];
    const templateList = (t as RequirementTemplate[]) || [];
    setLenders(lenderList);
    setAddressDrafts(Object.fromEntries(lenderList.map((x) => [x.id, x.address ?? ''])));
    setNameDrafts(Object.fromEntries(lenderList.map((x) => [x.id, x.name])));
    setTemplates(templateList);
    setLabelDrafts(Object.fromEntries(templateList.map((x) => [x.id, x.label])));
  };

  useEffect(() => { load(); }, [dealershipId]);

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

  // Dealership details for the report footer. Uses dealershipId (not
  // profile.dealership_id directly) so a Master previewing as Salesperson
  // gets the dealership they're currently viewing as, since a Master's own
  // profile isn't tied to any single dealership.
  useEffect(() => {
    if (!isSalesperson || !dealershipId) return;
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
  }, [isSalesperson, dealershipId]);

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

  // Grouped by sold date — 3+ vehicles sold the same day is a hat-trick
  // candidate, complete only once every member has been delivered.
  const hattrickGroupsBySoldAt = new Map<string, HattrickRow[]>();
  hattrickRows.forEach((r) => {
    hattrickGroupsBySoldAt.set(r.sold_at, [...(hattrickGroupsBySoldAt.get(r.sold_at) ?? []), r]);
  });
  const hattrickCandidates: HattrickCandidate[] = Array.from(hattrickGroupsBySoldAt.entries())
    .filter(([, members]) => members.length >= 3)
    .map(([soldAt, members]) => {
      const allDelivered = members.every((m) => m.status === 'delivered');
      const completedAt = allDelivered
        ? members.reduce<string | null>((max, m) => (m.delivered_at && (!max || m.delivered_at > max) ? m.delivered_at : max), null)
        : null;
      return { soldAt, members, allDelivered, completedAt };
    })
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
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

  const addLender = async () => {
    const name = newLender.trim();
    if (!name) return;
    if (!dealershipId) { setError('Select a dealership first.'); return; }
    const { error } = await supabase.from('lenders').insert({ dealership_id: dealershipId, name, address: newLenderAddress.trim() || null });
    if (error) setError(error.message);
    else { setError(null); setNewLender(''); setNewLenderAddress(''); load(); }
  };

  const toggleLender = async (l: Lender) => {
    const { error } = await supabase.from('lenders').update({ active: !l.active }).eq('id', l.id);
    if (error) setError(error.message);
    else load();
  };

  const saveLenderName = async (l: Lender) => {
    const name = (nameDrafts[l.id] ?? '').trim();
    if (!name || name === l.name) { setNameDrafts((prev) => ({ ...prev, [l.id]: l.name })); return; }
    const { error } = await supabase.from('lenders').update({ name }).eq('id', l.id);
    if (error) setError(error.message);
    else load();
  };

  const saveLenderAddress = async (l: Lender) => {
    const address = (addressDrafts[l.id] ?? '').trim();
    if (address === (l.address ?? '')) return;
    const { error } = await supabase.from('lenders').update({ address: address || null }).eq('id', l.id);
    if (error) setError(error.message);
    else load();
  };

  const deleteLender = async (l: Lender) => {
    if (!window.confirm(`Delete "${l.name}"? This can't be undone.`)) return;
    const { error } = await supabase.from('lenders').delete().eq('id', l.id);
    if (error) {
      setError(error.code === FK_IN_USE
        ? `"${l.name}" is used on an existing delivery — deactivate it instead of deleting.`
        : error.message);
    } else { setError(null); load(); }
  };

  const addTemplate = async () => {
    const label = newTemplate.trim();
    if (!label) return;
    if (!dealershipId) { setError('Select a dealership first.'); return; }
    const { error } = await supabase
      .from('requirement_templates')
      .insert({ dealership_id: dealershipId, label, sort_order: templates.length });
    if (error) setError(error.message);
    else { setError(null); setNewTemplate(''); load(); }
  };

  const toggleTemplate = async (t: RequirementTemplate) => {
    const { error } = await supabase.from('requirement_templates').update({ active: !t.active }).eq('id', t.id);
    if (error) setError(error.message);
    else load();
  };

  const saveTemplateLabel = async (t: RequirementTemplate) => {
    const label = (labelDrafts[t.id] ?? '').trim();
    if (!label || label === t.label) { setLabelDrafts((prev) => ({ ...prev, [t.id]: t.label })); return; }
    const { error } = await supabase.from('requirement_templates').update({ label }).eq('id', t.id);
    if (error) setError(error.message);
    else load();
  };

  const deleteTemplate = async (t: RequirementTemplate) => {
    if (!window.confirm(`Delete "${t.label}"? This can't be undone.`)) return;
    const { error } = await supabase.from('requirement_templates').delete().eq('id', t.id);
    if (error) {
      setError(error.code === FK_IN_USE
        ? `"${t.label}" is used on an existing delivery — deactivate it instead of deleting.`
        : error.message);
    } else { setError(null); load(); }
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
    await downloadMonthlyReport(reportRows, reportSalespersonName, label, reportDealership ?? EMPTY_DEALERSHIP, reportHattrickGroups);
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
    const outcome = await shareMonthlyReport(reportRows, reportSalespersonName, label, reportDealership ?? EMPTY_DEALERSHIP, reportHattrickGroups);
    setReportBusy(null);
    if (outcome === 'downloaded') {
      setReportNotice('Your browser can\'t share files directly, so the PDF downloaded instead — attach it to an email yourself.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Settings</h1>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{profile?.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{profile?.role}</div>
          </div>
          <button
            type="button"
            className="btn secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13 }}
            onClick={() => supabase.auth.signOut()}
          >
            <LogOutIcon size={16} /> Sign out
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>APPEARANCE</div>
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
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 6 }}>MONTHLY REPORT</div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
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

          {reportLoading && <div style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 10 }}>Loading deliveries…</div>}

          {!reportLoading && completedThisMonth.length > 0 && (
            <div style={{
              marginBottom: 12, padding: 10, borderRadius: 10,
              background: 'var(--banner-ok-bg)', border: '1px solid var(--banner-ok-border)',
            }}>
              <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--banner-ok-fg)' }}>
                {completedThisMonth.length === 1 ? '1 hat-trick bonus' : `${completedThisMonth.length} hat-trick bonuses`} complete this month
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--banner-ok-fg)', marginTop: 3, opacity: 0.9 }}>
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
          {reportNotice && <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>{reportNotice}</p>}
        </div>
      )}

      {isSalesperson && pendingHattricks.length > 0 && (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 6 }}>PENDING HAT-TRICKS</div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 10 }}>
            3+ vehicles sold the same day — the bonus shows on a report once every one of them is delivered.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {pendingHattricks.map((g) => {
              const outstanding = g.members.filter((m) => m.status !== 'delivered');
              return (
                <div key={g.soldAt} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    Sold {new Date(`${g.soldAt}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {g.members.length} vehicles
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Still waiting on: {outstanding.map((m) => m.customer_name).join(', ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <InstallAppCard />

      <PushCard />

      {canManageLists && isMaster && (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>DEALERSHIP</div>
          <select value={selectedDealershipId} onChange={(e) => setSelectedDealershipId(e.target.value)}>
            {dealerships.length === 0 && <option value="">No dealerships yet</option>}
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="card" style={{ fontSize: 13, color: '#a3261b' }}>{error}</div>}

      {canManageLists && (
      <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Collection requirements</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4 }}>
          The master checklist offered when creating a delivery. Salespeople still see a free-form field
          for anything one-off. Uncheck to retire without deleting; Remove deletes it outright (blocked if
          it's already used on a delivery).
        </p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={t.active} onChange={() => toggleTemplate(t)} style={{ width: 'auto' }} />
              <input
                value={labelDrafts[t.id] ?? ''}
                onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                onBlur={() => saveTemplateLabel(t)}
                style={{
                  flex: 1, fontSize: 14, padding: '6px 10px',
                  textDecoration: t.active ? 'none' : 'line-through',
                  color: t.active ? 'var(--ink)' : 'var(--muted)',
                }}
              />
              <button type="button" className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteTemplate(t)}>Remove</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Add a requirement (e.g. Proof of insurance)" value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)} />
          <button type="button" className="btn" onClick={addTemplate}>Add</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Lenders &amp; lessors</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4 }}>
          Add each lender's address so the salesperson can direct customers there when needed.
        </p>
        <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
          {lenders.map((l) => (
            <div key={l.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input type="checkbox" checked={l.active} onChange={() => toggleLender(l)} style={{ width: 'auto' }} />
                <input
                  value={nameDrafts[l.id] ?? ''}
                  onChange={(e) => setNameDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  onBlur={() => saveLenderName(l)}
                  style={{
                    flex: 1, fontSize: 14, fontWeight: 700, padding: '6px 10px',
                    textDecoration: l.active ? 'none' : 'line-through',
                    color: l.active ? 'var(--ink)' : 'var(--muted)',
                  }}
                />
                <button type="button" className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteLender(l)}>Remove</button>
              </div>
              <input
                placeholder="Address (shown to the salesperson)"
                value={addressDrafts[l.id] ?? ''}
                onChange={(e) => setAddressDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                onBlur={() => saveLenderAddress(l)}
                style={{ fontSize: 13 }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Lender or lessor name" value={newLender} onChange={(e) => setNewLender(e.target.value)} />
          <input placeholder="Address (optional)" value={newLenderAddress} onChange={(e) => setNewLenderAddress(e.target.value)} />
          <button type="button" className="btn" onClick={addLender}>Add</button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
