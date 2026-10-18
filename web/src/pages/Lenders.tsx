import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Lender, RequirementTemplate } from '@/lib/types';
import { MANAGER_ROLES } from '@/lib/types';

interface Dealership { id: string; name: string; }

const FK_IN_USE = '23503';

// Lenders & lessors, plus the requirement checklist offered on new
// deliveries — kept together because each lender's "always required"
// picks come from that checklist. Managers only; a desktop nav item, and
// linked from Settings on mobile.
export default function LendersPage() {
  const { profile } = useSession();
  const { actingDealershipId } = useActingRole();
  const isMaster = profile?.role === 'Master Administrator';
  const canManageLists = profile ? MANAGER_ROLES.includes(profile.role) : false;

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState(actingDealershipId);
  const dealershipId = isMaster ? selectedDealershipId : (profile?.dealership_id ?? '');

  useEffect(() => {
    if (isMaster && actingDealershipId) setSelectedDealershipId(actingDealershipId);
  }, [isMaster, actingDealershipId]);

  const [lenders, setLenders] = useState<Lender[]>([]);
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
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
    setTemplates(templateList);
    setLabelDrafts(Object.fromEntries(templateList.map((x) => [x.id, x.label])));
  };

  useEffect(() => { load(); }, [dealershipId]);

  const addLender = async () => {
    const name = newLender.trim();
    if (!name) return;
    if (!dealershipId) { setError('Select a dealership first.'); return; }
    const { error } = await supabase.from('lenders').insert({ dealership_id: dealershipId, name, address: newLenderAddress.trim() || null });
    if (error) setError(error.message);
    else { setError(null); setNewLender(''); setNewLenderAddress(''); load(); }
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

  if (profile && !canManageLists) return <Navigate to="/" replace />;

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1 className="page-title">Lenders &amp; requirements</h1>
        <p className="page-sub">Lenders and lessors offered on a delivery, the requirements each one always needs, and the master requirement checklist.</p>
      </div>

      {isMaster && (
        <div className="card">
          <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>DEALERSHIP</div>
          <select value={selectedDealershipId} onChange={(e) => setSelectedDealershipId(e.target.value)}>
            {dealerships.length === 0 && <option value="">No dealerships yet</option>}
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {error && <div className="card" style={{ fontSize: 13, color: '#a3261b' }}>{error}</div>}

      <div className="lenders-grid">
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

      <section className="lender-section" aria-label="Lenders and lessors">
        <div className="lender-section-head">
          <div>
            <h3 style={{ margin: 0 }}>Lenders &amp; lessors</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>Open a lender to edit its address and the requirements it always needs.</p>
          </div>
        </div>
        <div className="lender-grid">
          {lenders.map((l) => (
            <Link
              key={l.id}
              to={`/lenders/${l.id}`}
              className={`card-3d tint-blue lender-card${l.active ? '' : ' is-inactive'}`}
              title={l.active ? undefined : 'Inactive — hidden from new deliveries'}
            >
              <span className="lender-card-name">{l.name}</span>
              <span aria-hidden="true" className="lender-card-chevron">›</span>
            </Link>
          ))}
          <div className="card-3d lender-card lender-add">
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>Add a lender or lessor</div>
            <input placeholder="Name" value={newLender} onChange={(e) => setNewLender(e.target.value)} />
            <input placeholder="Address (optional)" value={newLenderAddress} onChange={(e) => setNewLenderAddress(e.target.value)} />
            <button type="button" className="btn" disabled={!newLender.trim()} onClick={addLender}>Add lender</button>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
