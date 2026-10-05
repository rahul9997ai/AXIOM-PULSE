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
import { downloadMonthlyReport, shareMonthlyReport, type DealershipDetails, type MonthlyReportRow } from '@/lib/monthlyReport';
import { monthLabel, monthRange } from '@/lib/monthClose';

interface Dealership { id: string; name: string; }

const FK_IN_USE = '23503';
const EMPTY_DEALERSHIP: DealershipDetails = { name: '', address: '', city: '', phone: '', dealerCode: '' };

export default function Settings() {
  const { profile, session } = useSession();
  const { actingDealershipId, effectiveRole } = useActingRole();
  const isMaster = profile?.role === 'Master Administrator';
  const canManageLists = profile ? MANAGER_ROLES.includes(profile.role) : false;
  // A Master previewing the app as "Salesperson" (via the Viewing-as bar)
  // should see this feature too, not just a real Salesperson — effectiveRole
  // already resolves to the previewed role for a Master, or the real role
  // for everyone else.
  const isSalesperson = effectiveRole === 'Salesperson';
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
  const [bonusIds, setBonusIds] = useState<Set<string>>(new Set());
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
    if (!isSalesperson || !session) return;
    supabase
      .from('deliveries')
      .select('delivery_at')
      .eq('salesperson_id', session.user.id)
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
  }, [isSalesperson, session]);

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
    if (!session) return null;
    const [yearStr, monthStr] = reportMonthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const { start, end } = monthRange(year, month);
    const label = monthLabel(year, month);
    const { data, error } = await supabase
      .from('deliveries')
      .select('id, customer_name, stock_number, fsm_name, delivery_at')
      .eq('salesperson_id', session.user.id)
      .eq('status', 'delivered')
      .gte('delivery_at', start.toISOString())
      .lt('delivery_at', end.toISOString())
      .order('delivery_at', { ascending: true });
    if (error) { setReportNotice(error.message); return null; }
    return { rows: (data as MonthlyReportRow[]) || [], label };
  };

  // Reloads the delivery list (for the hat-trick checkboxes) whenever the
  // selected month changes — the bonus selection doesn't carry over between
  // months, since it's a per-month, hand-picked flag.
  useEffect(() => {
    if (!isSalesperson || !session) return;
    setReportLoading(true);
    setReportNotice(null);
    fetchReportForSelectedMonth().then((result) => {
      setReportRows(result?.rows ?? []);
      setBonusIds(new Set());
      setReportLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesperson, session, reportMonthKey]);

  const toggleBonus = (id: string) => {
    setBonusIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const rowsWithBonus = (): MonthlyReportRow[] =>
    reportRows.map((r) => ({ ...r, hattrick_bonus: bonusIds.has(r.id) }));

  const runDownloadReport = async () => {
    if (reportRows.length === 0) { setReportNotice('No deliveries marked complete for this month yet.'); return; }
    setReportBusy('download');
    setReportNotice(null);
    const label = (() => {
      const [y, m] = reportMonthKey.split('-').map(Number);
      return monthLabel(y, m);
    })();
    await downloadMonthlyReport(rowsWithBonus(), profile?.name ?? 'Salesperson', label, reportDealership ?? EMPTY_DEALERSHIP);
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
    const outcome = await shareMonthlyReport(rowsWithBonus(), profile?.name ?? 'Salesperson', label, reportDealership ?? EMPTY_DEALERSHIP);
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

          {!reportLoading && reportRows.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--muted)', fontSize: 11.5, marginBottom: 6 }}>
                Tick any deliveries that qualify for the hat-trick bonus — they'll be highlighted on the PDF.
              </div>
              <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto', overflowX: 'hidden' }}>
                {reportRows.map((r) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, cursor: 'pointer', width: '100%' }}>
                    <input type="checkbox" checked={bonusIds.has(r.id)} onChange={() => toggleBonus(r.id)} style={{ width: 'auto', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                      {r.customer_name}{r.stock_number ? ` · #${r.stock_number}` : ''}
                    </span>
                    <span style={{ color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {new Date(r.delivery_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </label>
                ))}
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
