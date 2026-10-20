import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { LEGAL_KINDS, PROVINCES, legalPath, loadLegalSettings, slugify, type LegalSettings, type ProvinceCode } from '@/lib/legal';

// GM / Master: the details that make this dealership's privacy notice, terms
// and cookies pages its own. The address and phone come from the
// dealership's record in Mahanex Dealership Command.
export default function LegalSettingsPanel({ dealershipId }: { dealershipId: string }) {
  const { session } = useSession();
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [dealershipName, setDealershipName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setSettings(null);
    Promise.all([
      loadLegalSettings(dealershipId),
      supabase.from('dealerships').select('name').eq('id', dealershipId).maybeSingle(),
    ]).then(([s, { data }]) => {
      setSettings(s);
      setLegalName(s.legal_name ?? '');
      setEmail(s.privacy_email ?? '');
      setDealershipName((data as { name: string } | null)?.name ?? '');
    });
  }, [dealershipId]);

  const save = async (patch: Partial<LegalSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setError(null);
    const { error: err } = await supabase.from('dealership_legal_settings').upsert({
      dealership_id: dealershipId,
      legal_name: next.legal_name?.trim() || null,
      privacy_email: next.privacy_email?.trim() || null,
      province: next.province,
      updated_at: new Date().toISOString(),
      updated_by: session?.user.id ?? null,
    });
    if (err) { setError(err.message); return; }
    setStatus('✓ Saved');
    setTimeout(() => setStatus(null), 1800);
  };

  const saveEmail = () => {
    const v = email.trim();
    if (v === (settings?.privacy_email ?? '')) return;
    if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { setError('That doesn\'t look like a valid email address.'); return; }
    save({ privacy_email: v || null });
  };

  const origin = typeof location !== 'undefined' ? location.origin : '';
  const slug = slugify(dealershipName);
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1600); } catch { /* clipboard blocked */ }
  };

  if (!settings) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Privacy, terms &amp; cookies pages</h2>
        <div style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="card" id="legal" style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0 }}>Privacy, terms &amp; cookies pages</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', margin: '6px 0 0', lineHeight: 1.5 }}>
          Public pages for {dealershipName || 'this dealership'} that anyone can open without signing in. They use the dealership&apos;s address and phone
          from its record, name Mahanex as the software provider, and use the details below.
        </p>
      </div>

      <label className="field-label">
        Legal business name
        <input
          placeholder={dealershipName || 'e.g. ABC Motors Inc.'}
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          onBlur={() => legalName.trim() !== (settings.legal_name ?? '') && save({ legal_name: legalName })}
        />
        <span className="field-hint">Blank uses the dealership&apos;s name.</span>
      </label>

      <label className="field-label">
        Email for privacy requests
        <input
          type="email"
          inputMode="email"
          placeholder="privacy@yourdealership.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={saveEmail}
        />
        <span className="field-hint">Where people send access or correction requests. Blank shows the dealership&apos;s phone number instead.</span>
      </label>

      <label className="field-label">
        Province
        <select value={settings.province} onChange={(e) => save({ province: e.target.value as ProvinceCode })}>
          {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <span className="field-hint">Decides which privacy law and governing law the pages mention.</span>
      </label>

      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Public links</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {slug && LEGAL_KINDS.map(({ kind, label }) => {
            const url = origin + legalPath(kind, slug);
            return (
              <div key={kind} className="legal-link-row">
                <a href={legalPath(kind, slug)} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{label}</a>
                <code>{url}</code>
                <button type="button" className="btn-3d" style={{ fontSize: '0.71875rem', padding: '4px 10px' }} onClick={() => copy(url)}>
                  {copied === url ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--muted)', lineHeight: 1.5 }}>
        These pages are careful drafts, not legal advice. Have your lawyer review them, especially the Terms of use, before relying on them.
      </p>

      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: error ? '#a3261b' : 'var(--muted)', minHeight: 16 }} role="status">
        {error ?? status ?? ''}
      </div>
    </div>
  );
}
