import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { MANAGER_ROLES } from '@/lib/types';
import SignIn from '@/pages/SignIn';
import Layout from '@/pages/Layout';
import Deliveries from '@/pages/Deliveries';
import NewDelivery from '@/pages/NewDelivery';
import EditDelivery from '@/pages/EditDelivery';
import Settings from '@/pages/Settings';

export default function App() {
  const { session, profile, loading } = useSession();

  if (loading) return null;
  if (!session) return <SignIn />;

  const isManager = profile ? MANAGER_ROLES.includes(profile.role) : false;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Deliveries />} />
        <Route path="/new" element={isManager ? <NewDelivery /> : <Navigate to="/" replace />} />
        <Route path="/edit/:id" element={isManager ? <EditDelivery /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={isManager ? <Settings /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
