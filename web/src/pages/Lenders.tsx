import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Lender, RequirementTemplate } from '@/lib/types';
import { MANAGER_ROLES } from '@/lib/types';
import { TrashIcon } from '@/components/Icons';

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
  // The checklist row being renamed — names show as plain (wrapping) text until tapped.
  const [editingId, setEditingId] = useState<string | null>(null);
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
        <p className="page-sub">The requirement checklist used on every delivery, and the lenders and lessors you work with.</p>
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

      <section className="lr-section" aria-labelledby="req-title">
        <div className="lr-head">
          <div>
            <h2 id="req-title" className="lr-title">Collection requirements</h2>
            <p className="lr-sub">The checklist offered on every new delivery. Switch one off to retire it; delete removes it for good (blocked if it's on a delivery).</p>
          </div>
          <span className="lr-count">{templates.filter((t) => t.active).length} active</span>
        </div>
        <div className="lr-panel">
          <div className="lr-req-list">
            {templates.map((t) => (
              <div key={t.id} className={`lr-req${t.active ? '' : ' is-off'}`}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={t.active}
                  aria-label={`${t.label} ${t.active ? 'offered' : 'retired'}`}
                  className={`switch switch-sm${t.active ? ' is-on' : ''}`}
                  onClick={() => toggleTemplate(t)}
                >
                  <span className="switch-knob" />
                </button>
                {editingId === t.id ? (
                  <input
                    className="lr-req-input"
                    aria-label="Requirement name"
                    autoFocus
                    value={labelDrafts[t.id] ?? ''}
                    onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setLabelDrafts((prev) => ({ ...prev, [t.id]: t.label })); setEditingId(null); } }}
                    onBlur={() => { saveTemplateLabel(t); setEditingId(null); }}
                  />
                ) : (
                  <button type="button" className="lr-req-label" title="Rename" onClick={() => setEditingId(t.id)}>
                    {labelDrafts[t.id] ?? t.label}
                  </button>
                )}
                <button type="button" className="lr-icon-btn" aria-label={`Delete ${t.label}`} title="Delete" onClick={() => deleteTemplate(t)}>
                  <TrashIcon size={15} />
                </button>
              </div>
            ))}
          </div>
          <form className="lr-inline-add" onSubmit={(e) => { e.preventDefault(); addTemplate(); }}>
            <input placeholder="Add a requirement, e.g. Proof of insurance" value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)} />
            <button type="submit" className="btn" disabled={!newTemplate.trim()}>Add</button>
          </form>
        </div>
      </section>

      <section className="lr-section" aria-labelledby="lender-title">
        <div className="lr-head">
          <div>
            <h2 id="lender-title" className="lr-title">Lenders &amp; lessors</h2>
            <p className="lr-sub">Open a lender to edit its address and the requirements it always needs.</p>
          </div>
          <span className="lr-count">{lenders.length} total</span>
        </div>
        <form className="lr-addbar" onSubmit={(e) => { e.preventDefault(); addLender(); }}>
          <input placeholder="New lender or lessor name" value={newLender} onChange={(e) => setNewLender(e.target.value)} />
          <input placeholder="Address (optional)" value={newLenderAddress} onChange={(e) => setNewLenderAddress(e.target.value)} />
          <button type="submit" className="btn" disabled={!newLender.trim()}>Add lender</button>
        </form>
        <div className="lender-grid">
          {lenders.map((l) => (
            <Link
              key={l.id}
              to={`/lenders/${l.id}`}
              className={`lender-tile${l.active ? '' : ' is-inactive'}`}
              title={l.active ? undefined : 'Inactive — hidden from new deliveries'}
            >
              <span className="lender-tile-name">{l.name}</span>
              {!l.active && <span className="lender-tile-tag">Inactive</span>}
              <span aria-hidden="true" className="lender-tile-chevron">›</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
