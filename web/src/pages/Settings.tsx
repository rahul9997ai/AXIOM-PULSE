import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Lender, RequirementTemplate } from '@/lib/types';

export default function Settings() {
  const { profile } = useSession();
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [newLender, setNewLender] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!profile?.dealership_id) return;
    const [{ data: l }, { data: t }] = await Promise.all([
      supabase.from('lenders').select('*').eq('dealership_id', profile.dealership_id).order('name'),
      supabase.from('requirement_templates').select('*').eq('dealership_id', profile.dealership_id).order('sort_order'),
    ]);
    setLenders((l as Lender[]) || []);
    setTemplates((t as RequirementTemplate[]) || []);
  };

  useEffect(() => { load(); }, [profile?.dealership_id]);

  const addLender = async () => {
    const name = newLender.trim();
    if (!name || !profile?.dealership_id) return;
    const { error } = await supabase.from('lenders').insert({ dealership_id: profile.dealership_id, name });
    if (error) setError(error.message);
    else { setNewLender(''); load(); }
  };

  const toggleLender = async (l: Lender) => {
    await supabase.from('lenders').update({ active: !l.active }).eq('id', l.id);
    load();
  };

  const addTemplate = async () => {
    const label = newTemplate.trim();
    if (!label || !profile?.dealership_id) return;
    const { error } = await supabase
      .from('requirement_templates')
      .insert({ dealership_id: profile.dealership_id, label, sort_order: templates.length });
    if (error) setError(error.message);
    else { setNewTemplate(''); load(); }
  };

  const toggleTemplate = async (t: RequirementTemplate) => {
    await supabase.from('requirement_templates').update({ active: !t.active }).eq('id', t.id);
    load();
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Settings</h1>
      {error && <div className="card" style={{ fontSize: 13, color: '#a3261b' }}>{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Collection requirements</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4 }}>
          The master checklist offered when creating a delivery. Salespeople still see a free-form field
          for anything one-off.
        </p>
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {templates.map((t) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={t.active} onChange={() => toggleTemplate(t)} style={{ width: 'auto' }} />
              <span style={{ textDecoration: t.active ? 'none' : 'line-through', color: t.active ? 'var(--ink)' : 'var(--muted)' }}>
                {t.label}
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Add a requirement (e.g. Proof of insurance)" value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)} />
          <button className="btn" onClick={addTemplate}>Add</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Lenders &amp; lessors</h3>
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {lenders.map((l) => (
            <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={l.active} onChange={() => toggleLender(l)} style={{ width: 'auto' }} />
              <span style={{ textDecoration: l.active ? 'none' : 'line-through', color: l.active ? 'var(--ink)' : 'var(--muted)' }}>
                {l.name}
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Add a lender or lessor" value={newLender} onChange={(e) => setNewLender(e.target.value)} />
          <button className="btn" onClick={addLender}>Add</button>
        </div>
      </div>
    </div>
  );
}
