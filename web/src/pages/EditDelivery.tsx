import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import DeliveryForm from '@/components/DeliveryForm';
import type { Delivery } from '@/lib/types';

export default function EditDelivery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('deliveries').select('*, delivery_requirements(*)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { navigate('/'); return; }
        setDelivery(data as Delivery);
        setLoading(false);
      });
  }, [id, navigate]);

  if (loading) return <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>Loading…</div>;
  if (!delivery) return null;

  return <DeliveryForm existing={delivery} onSaved={() => {}} />;
}
