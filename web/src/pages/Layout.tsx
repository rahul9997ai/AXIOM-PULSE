import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { AxiomLockup } from '@/components/AxiomMark';
import { MANAGER_ROLES } from '@/lib/types';

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const isManager = profile ? MANAGER_ROLES.includes(profile.role) : false;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: '#fff',
          borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <AxiomLockup size={26} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isManager && (
            <>
              <Link to="/settings" className="btn secondary" style={{ textDecoration: 'none', padding: '8px 12px', fontSize: 13 }}>
                Settings
              </Link>
              <Link to="/new" className="btn secondary" style={{ textDecoration: 'none', padding: '8px 12px', fontSize: 13 }}>
                + New
              </Link>
            </>
          )}
          <button
            className="btn secondary"
            style={{ padding: '8px 12px', fontSize: 13 }}
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: '18px 18px 24px' }}>{children}</main>
    </div>
  );
}
