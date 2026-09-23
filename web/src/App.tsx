import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from '@/lib/session';
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

export default function App() {
  const { session, profile, loading } = useSession();

  if (loading) return null;
  if (!session) return <SignIn />;
  if (profile?.must_change_password) return <ForcePasswordChange />;
  if (profile && !profile.has_seen_welcome) return <Welcome />;

  return (
    <ActingRoleProvider>
      <AppRoutes />
    </ActingRoleProvider>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
