import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { AxiomLockup } from '@/components/AxiomMark';
import { MANAGER_ROLES } from '@/lib/types';
import { HomeIcon, PlusCircleIcon, GearIcon } from '@/components/Icons';

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const { pathname } = useLocation();
  const isManager = profile ? MANAGER_ROLES.includes(profile.role) : false;

  const navItems = [
    { to: '/', label: 'Deliveries', icon: HomeIcon, match: (p: string) => p === '/' || p.startsWith('/edit') },
    ...(isManager ? [{ to: '/new', label: 'New', icon: PlusCircleIcon, match: (p: string) => p === '/new' }] : []),
    { to: '/settings', label: 'Settings', icon: GearIcon, match: (p: string) => p === '/settings' },
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <AxiomLockup size={24} />
      </header>
      <main className="app-main">{children}</main>
      <nav className="app-tabbar" aria-label="Primary">
        {navItems.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link key={to} to={to} className={`app-tab ${active ? 'active' : ''}`}>
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
