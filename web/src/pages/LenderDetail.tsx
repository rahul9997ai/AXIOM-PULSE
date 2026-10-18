import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Lender, RequirementTemplate } from '@/lib/types';
import { MANAGER_ROLES } from '@/lib/types';

const FK_IN_USE = '23503';

// One lender or lessor: its name, address, whether it's offered on new
// deliveries, and the standard requirements pre-checked whenever it's picked.
export default function LenderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const canManage = profile ? MANAGER_ROLES.includes(profile.role) : false;

  const [lender, setLender] = useState<Lender | null>(null);
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('lenders').select('*').eq('id', id).maybeSingle().then(async ({ data, error: err }) => {
      if (err) setError(err.message);
      const l = data as Lender | null;
      setLender(l);
      setName(l?.name ?? '');
      setAddress(l?.address ?? '');
      if (l) {
        const { data: t } = await supabase.from('requirement_templates').select('*')
          .eq('dealership_id', l.dealership_id).eq('active', true).order('sort_order');
        setTemplates((t as RequirementTemplate[]) || []);
      }
      setLoading(false);
    });
  }, [id]);

  const update = async (patch: Partial<Lender>) => {
    if (!lender) return;
    const next = { ...lender, ...patch };
    setLender(next);
    setError(null);
    const { error: err } = await supabase.from('lenders').update(patch).eq('id', lender.id);
    if (err) { setError(err.message); setLender(lender); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (!lender || trimmed === lender.name) return;
    if (!trimmed) { setName(lender.name); return; }
    update({ name: trimmed });
  };

  const saveAddress = () => {
    if (!lender || address.trim() === (lender.address ?? '')) return;
    update({ address: address.trim() || null });
  };

  const toggleRequirement = (templateId: string) => {
    if (!lender) return;
    const current = lender.default_template_ids ?? [];
    update({ default_template_ids: current.includes(templateId) ? current.filter((t) => t !== templateId) : [...current, templateId] });
  };

  const remove = async () => {
    if (!lender || !window.confirm(`Delete "${lender.name}"? This can't be undone.`)) return;
    const { error: err } = await supabase.from('lenders').delete().eq('id', lender.id);
    if (err) {
      setError(err.code === FK_IN_USE
        ? `"${lender.name}" is used on an existing delivery — mark it inactive instead of deleting.`
        : err.message);
      return;
    }
    navigate('/lenders');
  };

  if (profile && !canManage) return <Navigate to="/" replace />;
  if (loading) return <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>Loading…</div>;
  if (!lender) {
    return (
      <div className="page-stack">
        <Link to="/lenders" className="back-link">‹ Lenders &amp; requirements</Link>
        <div className="card">This lender couldn't be found.</div>
      </div>
    );
  }

  const selected = new Set(lender.default_template_ids ?? []);

  return (
    <div className="page-stack lender-detail">
      <Link to="/lenders" className="back-link">‹ Lenders &amp; requirements</Link>

      <div className="card-3d tint-blue" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className={`pill ${lender.active ? 'pill-later' : 'pill-plain'}`}>{lender.active ? 'Active — offered on new deliveries' : 'Inactive — hidden from new deliveries'}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', minHeight: 16 }}>{saved ? '✓ Saved' : ''}</span>
        </div>
        <label className="field-label">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} style={{ fontSize: 17, fontWeight: 800 }} />
        </label>
        <label className="field-label">
          Address (shown to the salesperson)
          <input value={address} placeholder="Street, city" onChange={(e) => setAddress(e.target.value)} onBlur={saveAddress} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            <button
              type="button"
              role="switch"
              aria-checked={lender.active}
              aria-label="Offer this lender on new deliveries"
              className={`switch${lender.active ? ' is-on' : ''}`}
              onClick={() => update({ active: !lender.active })}
            >
              <span className="switch-knob" />
            </button>
            Offer on new deliveries
          </label>
          <button type="button" className="btn secondary" style={{ color: '#a3261b' }} onClick={remove}>Delete lender</button>
        </div>
      </div>

      <div className="card-3d tint-blue" style={{ display: 'grid', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Standard requirements</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0', lineHeight: 1.5 }}>
            Tap the requirements {lender.name} always needs. They're checked automatically when this lender is picked on a new delivery.
          </p>
        </div>
        {templates.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            No requirements in the checklist yet. Add them under <Link to="/lenders">Collection requirements</Link>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {templates.map((t) => {
              const on = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`req-tile ${on ? 'is-done' : 'is-open'}`}
                  aria-pressed={on}
                  onClick={() => toggleRequirement(t.id)}
                >
                  <span className="req-tile-shine" />
                  <span className="req-tile-body">
                    {on && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                    <span>{t.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
          {templates.filter((t) => selected.has(t.id)).length} of {templates.length} selected
        </div>
      </div>

      {error && <div className="card" style={{ fontSize: 13, color: '#a3261b' }}>{error}</div>}
    </div>
  );
}
