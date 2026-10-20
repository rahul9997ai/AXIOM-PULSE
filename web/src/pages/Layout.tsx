import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { useActingRole, ACTABLE_ROLES } from '@/lib/actingRole';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { MahanexLockup } from '@/components/MahanexMark';
import { MANAGER_ROLES } from '@/lib/types';
import { HomeIcon, PlusCircleIcon, GearIcon, CalendarIcon, BankIcon } from '@/components/Icons';
import { initials } from '@/lib/schedule';
import MonthCloseBanner from '@/components/MonthCloseBanner';
import SoldDateBanner from '@/components/SoldDateBanner';

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const { pathname } = useLocation();
  const {
    isMaster, actingRole, setActingRole, dealerships, actingDealershipId, setActingDealershipId, isAdminMode, effectiveRole,
    salespeople, actingSalespersonId, setActingSalespersonId,
  } = useActingRole();
  const isDesktop = useIsDesktop();
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

  // Desktop: "New delivery" is a primary button above the nav rather than a
  // nav item, and Lenders & requirements gets its own place in the rail.
  const desktopNavItems = isSalespersonView
    ? navItems
    : [
        ...navItems.filter((n) => n.to !== '/new' && n.to !== '/settings'),
        ...(isManager && !isAdminMode ? [{ to: '/lenders', label: 'Lenders & requirements', icon: BankIcon, match: (p: string) => p.startsWith('/lenders') }] : []),
        ...navItems.filter((n) => n.to === '/settings'),
      ];

  const viewingAsBar = isMaster && (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
      padding: '8px 14px', background: isAdminMode ? 'transparent' : 'var(--banner-warn-bg)',
      borderBottom: isAdminMode ? 'none' : '1px solid var(--banner-warn-border)', fontSize: '0.78125rem',
      color: isAdminMode ? undefined : 'var(--banner-warn-fg)',
    }}>
      <span style={{ fontWeight: 700, color: 'var(--muted)' }}>Viewing as</span>
      <select
        value={actingRole}
        onChange={(e) => setActingRole(e.target.value as typeof actingRole)}
        style={{ padding: '3px 6px', fontSize: '0.78125rem', width: 'auto' }}
      >
        <option value="Master Administrator">Master Administrator (Admin home)</option>
        {ACTABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {!isAdminMode && dealerships.length > 0 && (
        <select
          value={actingDealershipId}
          onChange={(e) => setActingDealershipId(e.target.value)}
          style={{ padding: '3px 6px', fontSize: '0.78125rem', width: 'auto' }}
        >
          {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
      {!isAdminMode && actingRole === 'Salesperson' && (
        <select
          value={actingSalespersonId}
          onChange={(e) => setActingSalespersonId(e.target.value)}
          style={{ padding: '3px 6px', fontSize: '0.78125rem', width: 'auto' }}
        >
          {salespeople.length === 0 && <option value="">No salespeople in this dealership</option>}
          {salespeople.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {!isAdminMode && (
        <button
          type="button"
          className="btn secondary"
          style={{ padding: '3px 10px', fontSize: '0.71875rem' }}
          onClick={() => setActingRole('Master Administrator')}
        >
          Back to Admin
        </button>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div className="app-shell desktop">
        {viewingAsBar}
        <div className="desktop-body">
          <aside className="desktop-sidebar">
            <div style={{ padding: '2px 6px 0' }}><MahanexLockup size={19} /></div>
            {canCreate && (
              <Link to="/new" className="btn desktop-new-btn">
                <PlusCircleIcon size={18} />
                New delivery
              </Link>
            )}
            <nav className="desktop-nav" aria-label="Primary">
              {desktopNavItems.map(({ to, label, icon: Icon, match }) => {
                const active = match(pathname);
                return (
                  <Link key={to} to={to} className={`desktop-nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            {profile && (
              <Link to="/settings" className="desktop-user" title="Settings">
                <span className="avatar desktop-user-avatar" aria-hidden="true">{initials(profile.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="desktop-user-name">{profile.name}</span>
                  <span className="desktop-user-role">{profile.role === 'FSM' ? 'Finance Manager' : profile.role}</span>
                </span>
              </Link>
            )}
          </aside>
          <div className="desktop-main">
            <MonthCloseBanner />
            <SoldDateBanner />
            <main className="app-main">{children}</main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <MahanexLockup size={20} />
      </header>
      {viewingAsBar}
      <MonthCloseBanner />
      <SoldDateBanner />
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
