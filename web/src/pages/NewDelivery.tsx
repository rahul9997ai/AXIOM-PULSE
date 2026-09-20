import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

interface Salesperson { id: string; name: string; }

export default function NewDelivery() {
  const { profile, session } = useSession();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [lender, setLender] = useState('');
  const [deliveryAt, setDeliveryAt] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [requirements, setRequirements] = useState('');
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.dealership_id) return;
    supabase
      .from('profiles')
      .select('id,name')
      .eq('dealership_id', profile.dealership_id)
      .eq('role', 'Salesperson')
      .eq('active', true)
      .then(({ data }) => setSalespeople((data as Salesperson[]) || []));
  }, [profile?.dealership_id]);

  const save = async () => {
    if (!customer || !vehicle || !salesperson || !deliveryAt) {
      setError('Customer, vehicle, delivery time and salesperson are required.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('deliveries')
      .insert({
        dealership_id: profile!.dealership_id,
        fsm_id: session!.user.id,
        salesperson_id: salesperson,
        customer_name: customer.trim(),
        vehicle: vehicle.trim(),
        lender_name: lender.trim() || null,
        delivery_at: new Date(deliveryAt).toISOString(),
        fsm_notes: null,
      })
      .select()
      .single();

    if (error) { setBusy(false); setError(error.message); return; }

    const labels = requirements.split('\n').map((x) => x.trim()).filter(Boolean);
    if (labels.length) {
      const { error: reqError } = await supabase
        .from('delivery_requirements')
        .insert(labels.map((label) => ({ delivery_id: data.id, kind: 'custom', label })));
      if (reqError) { setBusy(false); setError(`Delivery created, but requirements failed: ${reqError.message}`); return; }
    }

    setBusy(false);
    navigate('/');
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ letterSpacing: 2, fontSize: 20 }}>NEW DELIVERY</h1>
      <input placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <input placeholder="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
      <input placeholder="Lender or lessor" value={lender} onChange={(e) => setLender(e.target.value)} />
      <input type="datetime-local" value={deliveryAt} onChange={(e) => setDeliveryAt(e.target.value)} />
      <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>ASSIGN SALESPERSON</div>
      {salespeople.map((p) => (
        <button
          key={p.id}
          type="button"
          className="card"
          style={{ textAlign: 'left', border: salesperson === p.id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }}
          onClick={() => setSalesperson(p.id)}
        >
          {p.name}
        </button>
      ))}
      <textarea
        rows={6}
        placeholder={'Collection requirements — one per line\nVoid cheque\nTrade release signed\nTrade ownership\nRefund due\nMoney to collect'}
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
      />
      {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
      <button className="btn" disabled={busy} onClick={save}>{busy ? 'Creating…' : 'Create delivery'}</button>
    </div>
  );
}
