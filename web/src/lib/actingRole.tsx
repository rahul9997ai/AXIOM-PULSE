import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useSession } from './session';
import type { Role } from './types';

export interface Dealership { id: string; name: string; }

const ACTABLE_ROLES: Role[] = ['General Manager', 'FSM', 'Salesperson'];

interface ActingRoleContextValue {
  isMaster: boolean;
  /** Master Administrator only: which role they're currently previewing the app as. */
  actingRole: Role;
  setActingRole: (r: Role) => void;
  dealerships: Dealership[];
  actingDealershipId: string;
  setActingDealershipId: (id: string) => void;
  /** The role that should actually drive the UI — actingRole for a Master, otherwise the real role. */
  effectiveRole: Role;
  /** True when a Master is in their own admin home, not previewing any operational role. */
  isAdminMode: boolean;
}

const ActingRoleContext = createContext<ActingRoleContextValue | null>(null);

const STORAGE_ROLE = 'pulse_acting_role';
const STORAGE_DEALERSHIP = 'pulse_acting_dealership';

export function ActingRoleProvider({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const isMaster = profile?.role === 'Master Administrator';

  const [actingRole, setActingRoleState] = useState<Role>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_ROLE) as Role | null;
      return stored && ACTABLE_ROLES.includes(stored) ? stored : 'Master Administrator';
    } catch { return 'Master Administrator'; }
  });
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [actingDealershipId, setActingDealershipIdState] = useState(() => {
    try { return localStorage.getItem(STORAGE_DEALERSHIP) || ''; } catch { return ''; }
  });

  useEffect(() => {
    if (!isMaster) return;
    supabase.from('dealerships').select('id,name').order('name')
      .then(({ data }) => {
        const list = (data as Dealership[]) || [];
        setDealerships(list);
        setActingDealershipIdState((prev) => prev || list[0]?.id || '');
      });
  }, [isMaster]);

  const setActingRole = (r: Role) => {
    setActingRoleState(r);
    try { localStorage.setItem(STORAGE_ROLE, r); } catch { /* ignore */ }
  };
  const setActingDealershipId = (id: string) => {
    setActingDealershipIdState(id);
    try { localStorage.setItem(STORAGE_DEALERSHIP, id); } catch { /* ignore */ }
  };

  const effectiveRole = isMaster ? actingRole : (profile?.role ?? 'Salesperson');
  const isAdminMode = isMaster && actingRole === 'Master Administrator';

  return (
    <ActingRoleContext.Provider
      value={{ isMaster, actingRole, setActingRole, dealerships, actingDealershipId, setActingDealershipId, effectiveRole, isAdminMode }}
    >
      {children}
    </ActingRoleContext.Provider>
  );
}

export function useActingRole() {
  const ctx = useContext(ActingRoleContext);
  if (!ctx) throw new Error('useActingRole must be used within ActingRoleProvider');
  return ctx;
}

export { ACTABLE_ROLES };
