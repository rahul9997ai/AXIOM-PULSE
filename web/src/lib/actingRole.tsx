import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useSession } from './session';
import type { Role } from './types';

export interface Dealership { id: string; name: string; }
export interface SalespersonOption { id: string; name: string; }

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
  /** Master Administrator previewing as Salesperson only: every salesperson in the acting dealership, to pick from. */
  salespeople: SalespersonOption[];
  /** Master Administrator previewing as Salesperson only: which salesperson's data is currently shown. */
  actingSalespersonId: string;
  setActingSalespersonId: (id: string) => void;
  /**
   * The salesperson id that should actually drive queries — actingSalespersonId for a Master previewing as
   * Salesperson, otherwise the real signed-in user's id. Views only: a Master browsing another salesperson's
   * data doesn't change who actions (deliveries created, comments posted) are attributed to.
   */
  effectiveSalespersonId: string;
}

const ActingRoleContext = createContext<ActingRoleContextValue | null>(null);

const STORAGE_ROLE = 'pulse_acting_role';
const STORAGE_DEALERSHIP = 'pulse_acting_dealership';
const STORAGE_SALESPERSON = 'pulse_acting_salesperson';

export function ActingRoleProvider({ children }: { children: ReactNode }) {
  const { profile, session } = useSession();
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
  const [salespeople, setSalespeople] = useState<SalespersonOption[]>([]);
  const [actingSalespersonId, setActingSalespersonIdState] = useState(() => {
    try { return localStorage.getItem(STORAGE_SALESPERSON) || ''; } catch { return ''; }
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

  // Which salespeople the "Salesperson" preview can pick from — scoped to
  // whichever dealership the Master is currently viewing, since a
  // salesperson id from a different dealership wouldn't resolve to any
  // visible data anyway.
  useEffect(() => {
    if (!isMaster || actingRole !== 'Salesperson' || !actingDealershipId) { setSalespeople([]); return; }
    supabase
      .from('profiles')
      .select('id,name')
      .eq('dealership_id', actingDealershipId)
      .eq('role', 'Salesperson')
      .order('name')
      .then(({ data }) => {
        const list = (data as SalespersonOption[]) || [];
        setSalespeople(list);
        setActingSalespersonIdState((prev) => (prev && list.some((s) => s.id === prev)) ? prev : (list[0]?.id || ''));
      });
  }, [isMaster, actingRole, actingDealershipId]);

  const setActingRole = (r: Role) => {
    setActingRoleState(r);
    try { localStorage.setItem(STORAGE_ROLE, r); } catch { /* ignore */ }
  };
  const setActingDealershipId = (id: string) => {
    setActingDealershipIdState(id);
    try { localStorage.setItem(STORAGE_DEALERSHIP, id); } catch { /* ignore */ }
  };
  const setActingSalespersonId = (id: string) => {
    setActingSalespersonIdState(id);
    try { localStorage.setItem(STORAGE_SALESPERSON, id); } catch { /* ignore */ }
  };

  const effectiveRole = isMaster ? actingRole : (profile?.role ?? 'Salesperson');
  const isAdminMode = isMaster && actingRole === 'Master Administrator';
  const effectiveSalespersonId = (isMaster && actingRole === 'Salesperson') ? actingSalespersonId : (session?.user.id ?? '');

  return (
    <ActingRoleContext.Provider
      value={{
        isMaster, actingRole, setActingRole, dealerships, actingDealershipId, setActingDealershipId,
        effectiveRole, isAdminMode, salespeople, actingSalespersonId, setActingSalespersonId, effectiveSalespersonId,
      }}
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
