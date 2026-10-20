import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LEGAL_KINDS, legalPath, slugify } from '@/lib/legal';

// Links to the privacy notice, terms and cookies page for a dealership (or the
// general versions when there isn't one).
export default function LegalLinks({ dealershipId }: { dealershipId?: string | null }) {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!dealershipId) { setSlug(null); return; }
    supabase.from('dealerships').select('name').eq('id', dealershipId).maybeSingle()
      .then(({ data }) => setSlug((data as { name: string } | null)?.name ? slugify((data as { name: string }).name) : null));
  }, [dealershipId]);
  return (
    <nav className="card legal-links" aria-label="Legal">
      {LEGAL_KINDS.map(({ kind, label }) => <Link key={kind} to={legalPath(kind, slug)}>{label}</Link>)}
    </nav>
  );
}
