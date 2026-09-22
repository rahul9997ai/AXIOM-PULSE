import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { useActingRole, ACTABLE_ROLES } from '@/lib/actingRole';
import { AxiomLockup } from '@/components/AxiomMark';
import { MANAGER_ROLES } from '@/lib/types';
import { HomeIcon, PlusCircleIcon, GearIcon, CalendarIcon } from '@/components/Icons';

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const { pathname } = useLocation();
  const { isMaster, actingRole, setActingRole, dealerships, actingDealershipId, setActingDealershipId, isAdminMode, effectiveRole } = useActingRole();
  const isManager = profile ? MANAGER_ROLES.includes(profile.role) : false;
  const canCreate = isManager && !isAdminMode;
  // A salesperson works off "what's on today" + a calendar to look ahead,
  // instead of the manager's flat list + create/edit tools. FSM/GM keep
  // their full-list oversight (stat tiles, customer filter) on Deliveries,
  // but get a Calendar tab too so browsing by date doesn't mean scrolling
  // past every delivery in the dealership.
  const isSalespersonView = effectiveRole === 'Salesperson';
  const showCalendarTab = !isAdminMode && !!effectiveRole;

  const navItems = isSalespersonView
    ? [
        { to: '/calendar', label: 'Calendar', icon: CalendarIcon, match: (p: string) => p === '/calendar' },
        { to: '/', label: 'Deliveries', icon: HomeIcon, match: (p: string) => p === '/' || p.startsWith('/delivery') },
        { to: '/settings', label: 'Settings', icon: GearIcon, match: (p: string) => p === '/settings' },
      ]
    : [
        { to: '/', label: isAdminMode ? 'Admin' : 'Deliveries', icon: HomeIcon, match: (p: string) => p === '/' || p.startsWith('/edit') || p.startsWith('/delivery') },
        ...(showCalendarTab ? [{ to: '/calendar', label: 'Calendar', icon: CalendarIcon, match: (p: string) => p === '/calendar' }] : []),
        ...(canCreate ? [{ to: '/new', label: 'New', icon: PlusCircleIcon, match: (p: string) => p === '/new' }] : []),
        { to: '/settings', label: 'Settings', icon: GearIcon, match: (p: string) => p === '/settings' },
      ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <AxiomLockup size={24} />
      </header>
      {isMaster && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
          padding: '8px 14px', background: isAdminMode ? 'transparent' : '#fef3e2',
          borderBottom: isAdminMode ? 'none' : '1px solid #f5d59a', fontSize: 12.5,
        }}>
          <span style={{ fontWeight: 700, color: 'var(--muted)' }}>Viewing as</span>
          <select
            value={actingRole}
            onChange={(e) => setActingRole(e.target.value as typeof actingRole)}
            style={{ padding: '3px 6px', fontSize: 12.5, width: 'auto' }}
          >
            <option value="Master Administrator">Master Administrator (Admin home)</option>
            {ACTABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {!isAdminMode && dealerships.length > 0 && (
            <select
              value={actingDealershipId}
              onChange={(e) => setActingDealershipId(e.target.value)}
              style={{ padding: '3px 6px', fontSize: 12.5, width: 'auto' }}
            >
              {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {!isAdminMode && (
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '3px 10px', fontSize: 11.5 }}
              onClick={() => setActingRole('Master Administrator')}
            >
              Back to Admin
            </button>
          )}
        </div>
      )}
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
