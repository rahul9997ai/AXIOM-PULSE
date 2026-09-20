import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { inputToCents, centsToInput } from '@/lib/money';
import type { ApprovalStatus, Delivery, DueOnDeliveryType, Lender, RequirementTemplate } from '@/lib/types';

interface Salesperson { id: string; name: string; }
interface CustomRequirement { id?: string; label: string; }
interface Dealership { id: string; name: string; }

const APPROVAL_OPTIONS: ApprovalStatus[] = ['pending', 'approved', 'conditional', 'declined'];

export default function DeliveryForm({ existing, onSaved }: { existing?: Delivery; onSaved: () => void }) {
  const { profile, session } = useSession();
  const navigate = useNavigate();
  const isEdit = !!existing;
  const isMaster = profile?.role === 'Master Administrator';

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState(existing?.dealership_id ?? '');
  // Master Administrator has no dealership_id of their own (oversees every
  // dealership), so they pick one explicitly; everyone else is locked to theirs.
  const effectiveDealershipId = isMaster ? selectedDealershipId : (profile?.dealership_id ?? '');

  const [customer, setCustomer] = useState(existing?.customer_name ?? '');
  const [vehicle, setVehicle] = useState(existing?.vehicle ?? '');
  const [vin, setVin] = useState(existing?.vin ?? '');
  const [lenderId, setLenderId] = useState(existing?.lender_id ?? '');
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(existing?.approval_status ?? 'pending');
  const [deliveryAt, setDeliveryAt] = useState(existing ? toLocalInput(existing.delivery_at) : '');
  const [salesperson, setSalesperson] = useState(existing?.salesperson_id ?? '');
  const [dueOnDelivery, setDueOnDelivery] = useState(existing?.due_on_delivery ?? false);
  const [dueType, setDueType] = useState<DueOnDeliveryType>(existing?.due_on_delivery_type ?? 'collection');
  const [dueAmount, setDueAmount] = useState(existing?.due_on_delivery_amount_cents ? centsToInput(existing.due_on_delivery_amount_cents) : '');
  const [fsmNotes, setFsmNotes] = useState(existing?.fsm_notes ?? '');

  const [lenders, setLenders] = useState<Lender[]>([]);
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [checkedTemplates, setCheckedTemplates] = useState<Set<string>>(new Set());
  const [customReqs, setCustomReqs] = useState<CustomRequirement[]>([]);
  const [newCustomReq, setNewCustomReq] = useState('');
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMaster) return;
    supabase.from('dealerships').select('id,name').order('name')
      .then(({ data }) => {
        const list = (data as Dealership[]) || [];
        setDealerships(list);
        setSelectedDealershipId((prev) => prev || list[0]?.id || '');
      });
  }, [isMaster]);

  useEffect(() => {
    if (!effectiveDealershipId) { setLenders([]); setTemplates([]); setSalespeople([]); return; }
    supabase.from('lenders').select('*').eq('dealership_id', effectiveDealershipId).eq('active', true).order('name')
      .then(({ data }) => setLenders((data as Lender[]) || []));
    supabase.from('requirement_templates').select('*').eq('dealership_id', effectiveDealershipId).eq('active', true).order('sort_order')
      .then(({ data }) => setTemplates((data as RequirementTemplate[]) || []));
    supabase.from('profiles').select('id,name').eq('dealership_id', effectiveDealershipId).eq('role', 'Salesperson').eq('active', true)
      .then(({ data }) => setSalespeople((data as Salesperson[]) || []));
  }, [effectiveDealershipId]);

  useEffect(() => {
    if (!existing) return;
    const reqs = existing.delivery_requirements || [];
    setCheckedTemplates(new Set(reqs.filter((r) => r.template_id).map((r) => r.template_id!)));
    setCustomReqs(reqs.filter((r) => !r.template_id).map((r) => ({ id: r.id, label: r.label })));
  }, [existing]);

  const toggleTemplate = (id: string) => {
    setCheckedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addCustomReq = () => {
    const label = newCustomReq.trim();
    if (!label) return;
    setCustomReqs((prev) => [...prev, { label }]);
    setNewCustomReq('');
  };

  const removeCustomReq = (index: number) => {
    setCustomReqs((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!effectiveDealershipId) {
      setError(isMaster ? 'Select a dealership first.' : 'Your account has no dealership assigned.');
      return;
    }
    if (!customer || !vehicle || !salesperson || !deliveryAt) {
      setError('Customer, vehicle, delivery time and salesperson are required.');
      return;
    }
    if (dueOnDelivery && (!dueAmount || inputToCents(dueAmount) <= 0)) {
      setError('Enter an amount for the due-on-delivery collection or refund.');
      return;
    }
    setBusy(true);
    setError(null);

    const payload = {
      dealership_id: effectiveDealershipId,
      salesperson_id: salesperson,
      customer_name: customer.trim(),
      vehicle: vehicle.trim(),
      vin: vin.trim() || null,
      lender_id: lenderId || null,
      approval_status: approvalStatus,
      delivery_at: new Date(deliveryAt).toISOString(),
      due_on_delivery: dueOnDelivery,
      due_on_delivery_type: dueOnDelivery ? dueType : null,
      due_on_delivery_amount_cents: dueOnDelivery ? inputToCents(dueAmount) : null,
      fsm_notes: fsmNotes.trim() || null,
    };

    let deliveryId = existing?.id;
    if (isEdit) {
      const { error } = await supabase.from('deliveries').update(payload).eq('id', existing!.id);
      if (error) { setBusy(false); setError(error.message); return; }
    } else {
      const { data, error } = await supabase.from('deliveries').insert({ ...payload, fsm_id: session!.user.id }).select().single();
      if (error) { setBusy(false); setError(error.message); return; }
      deliveryId = data.id;
    }

    // Reconcile requirements: template checkboxes + custom chips vs what's currently saved.
    const existingReqs = existing?.delivery_requirements || [];
    const existingTemplateIds = new Set(existingReqs.filter((r) => r.template_id).map((r) => r.template_id!));
    const toAddTemplates = templates.filter((t) => checkedTemplates.has(t.id) && !existingTemplateIds.has(t.id));
    const toRemoveTemplateReqIds = existingReqs.filter((r) => r.template_id && !checkedTemplates.has(r.template_id) && r.status === 'outstanding').map((r) => r.id);
    const toAddCustom = customReqs.filter((c) => !c.id);
    const keptCustomIds = new Set(customReqs.filter((c) => c.id).map((c) => c.id));
    const toRemoveCustomReqIds = existingReqs.filter((r) => !r.template_id && !keptCustomIds.has(r.id) && r.status === 'outstanding').map((r) => r.id);

    const inserts = [
      ...toAddTemplates.map((t) => ({ delivery_id: deliveryId, kind: 'template', template_id: t.id, label: t.label })),
      ...toAddCustom.map((c) => ({ delivery_id: deliveryId, kind: 'custom', label: c.label })),
    ];
    if (inserts.length) {
      const { error: reqError } = await supabase.from('delivery_requirements').insert(inserts);
      if (reqError) { setBusy(false); setError(`Saved, but requirements failed: ${reqError.message}`); return; }
    }
    const toRemove = [...toRemoveTemplateReqIds, ...toRemoveCustomReqIds];
    if (toRemove.length) {
      await supabase.from('delivery_requirements').delete().in('id', toRemove);
    }

    if (!isEdit) {
      await supabase.functions.invoke('send-webpush', {
        body: {
          profile_ids: [salesperson],
          title: 'New delivery assigned',
          body: `${customer.trim()} — ${vehicle.trim()}, ${new Date(deliveryAt).toLocaleString()}`,
          data: { url: '/', deliveryId, type: 'delivery_assigned' },
        },
      }).catch(() => {});
    }

    setBusy(false);
    onSaved();
    navigate('/');
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{isEdit ? 'Edit Delivery' : 'New Delivery'}</h1>

      {isMaster && !isEdit && (
        <>
          <div style={fieldLabel}>DEALERSHIP</div>
          <select value={selectedDealershipId} onChange={(e) => setSelectedDealershipId(e.target.value)}>
            {dealerships.length === 0 && <option value="">No dealerships yet</option>}
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </>
      )}

      <input placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <input placeholder="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
      <input placeholder="VIN" value={vin} onChange={(e) => setVin(e.target.value)} />

      <div style={fieldLabel}>LENDER / LESSOR</div>
      <select value={lenderId} onChange={(e) => setLenderId(e.target.value)}>
        <option value="">Not selected</option>
        {lenders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>

      <div style={fieldLabel}>APPROVAL STATUS</div>
      <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}>
        {APPROVAL_OPTIONS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
      </select>

      <input type="datetime-local" value={deliveryAt} onChange={(e) => setDeliveryAt(e.target.value)} />

      <div className="card" style={{ padding: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 14 }}>
          <input type="checkbox" checked={dueOnDelivery} onChange={(e) => setDueOnDelivery(e.target.checked)} style={{ width: 'auto' }} />
          Due on delivery
        </label>
        {dueOnDelivery && (
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="radio" name="dueType" checked={dueType === 'collection'} onChange={() => setDueType('collection')} style={{ width: 'auto' }} />
                Collection from customer
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="radio" name="dueType" checked={dueType === 'refund'} onChange={() => setDueType('refund')} style={{ width: 'auto' }} />
                Refund to customer
              </label>
            </div>
            <input placeholder="Amount ($)" inputMode="decimal" value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} />
          </div>
        )}
      </div>

      <div style={fieldLabel}>ASSIGN SALESPERSON</div>
      {salespeople.map((p) => (
        <button
          key={p.id}
          type="button"
          className="card"
          style={{ textAlign: 'left', border: salesperson === p.id ? '2px solid var(--blue)' : '2px solid transparent', cursor: 'pointer' }}
          onClick={() => setSalesperson(p.id)}
        >
          {p.name}
        </button>
      ))}

      <div style={fieldLabel}>COLLECTION REQUIREMENTS</div>
      <div className="card" style={{ display: 'grid', gap: 8, padding: 14 }}>
        {templates.map((t) => (
          <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <input type="checkbox" checked={checkedTemplates.has(t.id)} onChange={() => toggleTemplate(t.id)} style={{ width: 'auto' }} />
            {t.label}
          </label>
        ))}
        {customReqs.map((c, i) => (
          <div key={c.id ?? `new-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
            <span>• {c.label}</span>
            <button type="button" className="btn secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => removeCustomReq(i)}>Remove</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input placeholder="Add a custom requirement" value={newCustomReq} onChange={(e) => setNewCustomReq(e.target.value)} />
          <button type="button" className="btn secondary" onClick={addCustomReq}>Add</button>
        </div>
      </div>

      <textarea
        rows={3}
        placeholder="FSM instructions (not a requirement — free-form notes for the salesperson)"
        value={fsmNotes}
        onChange={(e) => setFsmNotes(e.target.value)}
      />

      {error && <div style={{ color: '#a3261b', fontSize: 13 }}>{error}</div>}
      <button className="btn" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create delivery'}
      </button>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { color: 'var(--muted)', fontWeight: 800, fontSize: 12, letterSpacing: 1 };

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
