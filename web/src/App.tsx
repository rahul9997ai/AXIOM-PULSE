import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { ActingRoleProvider, useActingRole } from '@/lib/actingRole';
import { MANAGER_ROLES } from '@/lib/types';
import SignIn from '@/pages/SignIn';
import ForcePasswordChange from '@/pages/ForcePasswordChange';
import Welcome from '@/pages/Welcome';
import Layout from '@/pages/Layout';
import Deliveries from '@/pages/Deliveries';
import CalendarPage from '@/pages/Calendar';
import DeliveryDetail from '@/pages/DeliveryDetail';
import NewDelivery from '@/pages/NewDelivery';
import EditDelivery from '@/pages/EditDelivery';
import Settings from '@/pages/Settings';
import MonthClose from '@/pages/MonthClose';
import InstallPrompt from '@/components/InstallPrompt';

export default function App() {
  const { session, profile, loading } = useSession();

  if (loading) return null;

  return (
    <>
      <AppBody session={session} profile={profile} />
      <InstallPrompt />
    </>
  );
}

function AppBody({ session, profile }: { session: ReturnType<typeof useSession>['session']; profile: ReturnType<typeof useSession>['profile'] }) {
  if (!session) return <SignIn />;
  if (profile && !profile.pulse_enabled) return <NoPulseAccess />;
  if (profile?.must_change_password) return <ForcePasswordChange />;
  if (profile && !profile.has_seen_welcome) return <Welcome />;

  return (
    <ActingRoleProvider>
      <AppRoutes />
    </ActingRoleProvider>
  );
}

// Removing someone from Pulse who still uses Command Center only turns
// pulse_enabled off (sign-in stays allowed for the other app), so Pulse has
// to refuse them itself.
function NoPulseAccess() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <div className="card" style={{ maxWidth: 380, textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>No Axiom Pulse access</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Your account doesn't have access to Axiom Pulse. Contact your administrator if you think this is a mistake.
        </p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAdminMode } = useActingRole();
  const { profile } = useSession();
  const isManager = profile ? MANAGER_ROLES.includes(profile.role) : false;
  const canCreate = isManager && !isAdminMode;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Deliveries />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/delivery/:id" element={<DeliveryDetail />} />
        <Route path="/new" element={canCreate ? <NewDelivery /> : <Navigate to="/" replace />} />
        <Route path="/edit/:id" element={canCreate ? <EditDelivery /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/month-close" element={<MonthClose />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
