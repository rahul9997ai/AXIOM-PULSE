import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { inputToCents } from '@/lib/money';
import type { ApprovalStatus } from '@/lib/types';

interface Salesperson { id: string; name: string; }

const APPROVAL_OPTIONS: ApprovalStatus[] = ['pending', 'approved', 'conditional', 'declined'];

export default function NewDelivery() {
  const { profile, session } = useSession();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [vin, setVin] = useState('');
  const [lender, setLender] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('pending');
  const [deliveryAt, setDeliveryAt] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [moneyDue, setMoneyDue] = useState('');
  const [refund, setRefund] = useState('');
  const [fsmNotes, setFsmNotes] = useState('');
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
        vin: vin.trim() || null,
        lender_name: lender.trim() || null,
        approval_status: approvalStatus,
        delivery_at: new Date(deliveryAt).toISOString(),
        money_due_cents: inputToCents(moneyDue),
        refund_cents: inputToCents(refund),
        fsm_notes: fsmNotes.trim() || null,
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

    await supabase.functions.invoke('send-webpush', {
      body: {
        profile_ids: [salesperson],
        title: 'New delivery assigned',
        body: `${customer.trim()} — ${vehicle.trim()}, ${new Date(deliveryAt).toLocaleString()}`,
        data: { url: '/', deliveryId: data.id, type: 'delivery_assigned' },
      },
    }).catch(() => {});

    setBusy(false);
    navigate('/');
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ letterSpacing: 2, fontSize: 20 }}>NEW DELIVERY</h1>
      <input placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <input placeholder="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
      <input placeholder="VIN" value={vin} onChange={(e) => setVin(e.target.value)} />
      <input placeholder="Lender or lessor" value={lender} onChange={(e) => setLender(e.target.value)} />

      <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>APPROVAL STATUS</div>
      <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}>
        {APPROVAL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <input type="datetime-local" value={deliveryAt} onChange={(e) => setDeliveryAt(e.target.value)} />

      <div style={{ display: 'flex', gap: 10 }}>
        <input placeholder="Money due ($)" inputMode="decimal" value={moneyDue} onChange={(e) => setMoneyDue(e.target.value)} />
        <input placeholder="Refund ($)" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} />
      </div>

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
        rows={5}
        placeholder={'Collection requirements — one per line\nVoid cheque\nTrade release signed\nTrade ownership'}
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
      />
      <textarea
        rows={3}
        placeholder="FSM instructions (not a requirement — free-form notes for the salesperson)"
        value={fsmNotes}
        onChange={(e) => setFsmNotes(e.target.value)}
      />

      {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
      <button className="btn" disabled={busy} onClick={save}>{busy ? 'Creating…' : 'Create delivery'}</button>
    </div>
  );
}
