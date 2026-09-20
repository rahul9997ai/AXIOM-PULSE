import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from '@/lib/session';
import SignIn from '@/pages/SignIn';
import Layout from '@/pages/Layout';
import Deliveries from '@/pages/Deliveries';
import NewDelivery from '@/pages/NewDelivery';

const MANAGER_ROLES = ['FSM', 'General Manager', 'Master Administrator'];

export default function App() {
  const { session, profile, loading } = useSession();

  if (loading) return null;
  if (!session) return <SignIn />;

  const canCreate = profile ? MANAGER_ROLES.includes(profile.role) : false;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Deliveries />} />
        <Route
          path="/new"
          element={canCreate ? <NewDelivery /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
