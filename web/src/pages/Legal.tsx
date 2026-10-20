import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MahanexLockup } from '@/components/MahanexMark';
import { LEGAL_KINDS, LEGAL_UPDATED, MAHANEX, fetchDealershipLegal, legalPath, type DealershipLegal, type LegalKind } from '@/lib/legal';
import { formatAddress, formatDate, legalDoc, legalTitle } from '@/lib/legalText';
import { titleCase } from '../../../supabase/functions/delivery-reminders/thankYouEmail';

// Privacy notice, terms of use and cookies/storage. Public: shown whether or
// not anyone is signed in, for a specific dealership (/<slug>/privacy) or in
// general (/privacy).
export default function LegalPage({ kind, slug }: { kind: LegalKind; slug: string | null }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing'; dealership: DealershipLegal | null }>(
    { status: slug ? 'loading' : 'ready', dealership: null },
  );

  useEffect(() => {
    if (!slug) { setState({ status: 'ready', dealership: null }); return; }
    let live = true;
    setState({ status: 'loading', dealership: null });
    fetchDealershipLegal(slug).then((d) => { if (live) setState(d ? { status: 'ready', dealership: d } : { status: 'missing', dealership: null }); });
    return () => { live = false; };
  }, [slug]);

  const { dealership } = state;
  const doc = legalDoc(kind, dealership);

  useEffect(() => {
    document.title = `${legalTitle(kind, dealership)} · Mahanex Pulse`;
    return () => { document.title = 'Mahanex Pulse'; };
  }, [kind, dealership]);

  const address = formatAddress(dealership);

  return (
    <div className="legal">
      <a href="#main" className="skip-link">Skip to main content</a>
      <header className="legal-head">
        <Link to="/" className="legal-brand" aria-label="Mahanex Pulse home">
          <MahanexLockup size={20} />
        </Link>
        <p className="legal-slogan">Machine-Augmented Human Intelligence &amp; eXecution</p>
      </header>

      <nav className="legal-tabs" aria-label="Legal pages">
        {LEGAL_KINDS.map(({ kind: k, label }) => (
          <Link key={k} to={legalPath(k, slug)} className={`legal-tab${k === kind ? ' is-active' : ''}`} aria-current={k === kind ? 'page' : undefined}>{label}</Link>
        ))}
      </nav>

      <main id="main" className="legal-main" tabIndex={-1}>
        {state.status === 'loading' ? (
          <p className="legal-muted" role="status">Loading…</p>
        ) : (
          <article>
            {state.status === 'missing' && (
              <p className="legal-note" role="status">
                We couldn&apos;t find a dealership at this address, so this is the general version. Check the link you were given, or ask your dealership.
              </p>
            )}
            <p className="legal-eyebrow">{dealership ? titleCase(dealership.name) : 'Mahanex Pulse'}</p>
            <h1 className="legal-title">{doc.title}</h1>
            <p className="legal-updated">Last updated {formatDate(LEGAL_UPDATED)}</p>
            <p className="legal-summary">{doc.summary}</p>

            <nav className="legal-toc" aria-label="On this page">
              <ul>
                {doc.sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.heading}</a></li>)}
              </ul>
            </nav>

            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="legal-section" aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`}>{s.heading}</h2>
                {s.blocks.map((b, i) => typeof b === 'string'
                  ? <p key={i}>{b}</p>
                  : <ul key={i}>{b.list.map((li, j) => <li key={j}>{li}</li>)}</ul>)}
              </section>
            ))}
          </article>
        )}
      </main>

      <footer className="legal-foot">
        {dealership && (
          <address className="legal-contact">
            <strong>{dealership.legalName}</strong>
            {address && <span>{address}</span>}
            {dealership.phone && <span>Phone: <a href={`tel:${dealership.phone.replace(/[^0-9+]/g, '')}`}>{dealership.phone}</a></span>}
            {dealership.privacyEmail && <span>Privacy contact: <a href={`mailto:${dealership.privacyEmail}`}>{dealership.privacyEmail}</a></span>}
          </address>
        )}
        <p className="legal-powered">
          Powered by Mahan-Ex Pulse, a {MAHANEX.name} service
          <span className="legal-slogan-small">Machine-Augmented Human Intelligence &amp; eXecution</span>
        </p>
        <Link to="/" className="legal-back">← Back to Mahanex Pulse</Link>
      </footer>
    </div>
  );
}
