import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Lender, RequirementTemplate } from '@/lib/types';
import { MANAGER_ROLES } from '@/lib/types';
import InstallAppCard from '@/components/InstallAppCard';
import { LogOutIcon } from '@/components/Icons';

interface Dealership { id: string; name: string; }

const FK_IN_USE = '23503';

export default function Settings() {
  const { profile } = useSession();
  const isMaster = profile?.role === 'Master Administrator';
  const canManageLists = profile ? MANAGER_ROLES.includes(profile.role) : false;

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState('');
  const dealershipId = isMaster ? selectedDealershipId : (profile?.dealership_id ?? '');

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
      .then(({ data }) => {
        const list = (data as Dealership[]) || [];
        setDealerships(list);
        setSelectedDealershipId((prev) => prev || list[0]?.id || '');
      });
  }, [isMaster]);

  const load = async () => {
    if (!dealershipId) { setLenders([]); setTemplates([]); return; }
    const [{ data: l }, { data: t }] = await Promise.all([
      supabase.from('lenders').select('*').eq('dealership_id', dealershipId).order('name'),
      supabase.from('requirement_templates').select('*').eq('dealership_id', dealershipId).order('sort_order'),
    ]);
    const lenderList = (l as Lender[]) || [];
    const templateList = (t as RequirementTemplate[]) || [];
    setLenders(lenderList);
    setAddressDrafts(Object.fromEntries(lenderList.map((x) => [x.id, x.address ?? ''])));
    setNameDrafts(Object.fromEntries(lenderList.map((x) => [x.id, x.name])));
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

      <InstallAppCard />

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
