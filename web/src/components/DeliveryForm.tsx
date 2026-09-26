import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { inputToCents, centsToInput, formatCents } from '@/lib/money';
import { capitalizeWords } from '@/lib/text';
import { useActingRole } from '@/lib/actingRole';
import type { ApprovalStatus, Delivery, DueOnDeliveryType, Lender, RequirementTemplate } from '@/lib/types';

interface Salesperson { id: string; name: string; }
interface FinanceManager { id: string; name: string; }
interface CustomRequirement { id?: string; label: string; }
interface Dealership { id: string; name: string; }

const APPROVAL_OPTIONS: ApprovalStatus[] = ['pending', 'approved', 'conditional', 'declined'];

// Delivery slots only ever need quarter-hour granularity — build the full
// list once instead of relying on a native time picker's step behavior,
// which mobile browsers apply inconsistently.
const QUARTER_HOUR_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hour24 = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  const value = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const label = `${hour12}:${String(minute).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
  return { value, label };
});

export default function DeliveryForm({ existing, onSaved }: { existing?: Delivery; onSaved: () => void }) {
  const { profile, session } = useSession();
  const { actingDealershipId } = useActingRole();
  const navigate = useNavigate();
  const isEdit = !!existing;
  const isMaster = profile?.role === 'Master Administrator';
  // A General Manager (or Master) can hand a delivery to a different
  // Finance Manager — an FSM editing their own delivery can't reassign it
  // away from themselves through this form.
  const canAssignFsm = isMaster || profile?.role === 'General Manager';

  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [selectedDealershipId, setSelectedDealershipId] = useState(existing?.dealership_id ?? actingDealershipId ?? '');
  // Master Administrator has no dealership_id of their own (oversees every
  // dealership), so they pick one explicitly; everyone else is locked to theirs.
  const effectiveDealershipId = isMaster ? selectedDealershipId : (profile?.dealership_id ?? '');

  const [customer, setCustomer] = useState(existing?.customer_name ?? '');
  const [stockNumber, setStockNumber] = useState(existing?.stock_number ?? '');
  const [lenderId, setLenderId] = useState(existing?.lender_id ?? '');
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(existing?.approval_status ?? 'pending');
  const existingLocal = existing ? toLocalInput(existing.delivery_at) : null;
  const [deliveryDate, setDeliveryDate] = useState(existingLocal?.slice(0, 10) ?? '');
  // Time is restricted to quarter-hour increments (:00/:15/:30/:45) — a
  // finance manager picking a delivery slot doesn't need arbitrary minutes.
  const [deliveryTime, setDeliveryTime] = useState(existingLocal?.slice(11, 16) ?? '');
  const deliveryAt = deliveryDate && deliveryTime ? `${deliveryDate}T${deliveryTime}` : '';
  const [salesperson, setSalesperson] = useState(existing?.salesperson_id ?? '');
  // Everyone who creates a delivery defaults to themselves as the Finance
  // Manager, Master Administrator included — the Finance Manager dropdown
  // below (GM/Master only) is there for reassigning it to someone else,
  // not to force an explicit pick every time.
  const [fsmId, setFsmId] = useState(existing?.fsm_id ?? (profile?.id ?? ''));
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
  const [financeManagers, setFinanceManagers] = useState<FinanceManager[]>([]);

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
    if (!effectiveDealershipId) { setLenders([]); setTemplates([]); setSalespeople([]); setFinanceManagers([]); return; }
    supabase.from('lenders').select('*').eq('dealership_id', effectiveDealershipId).eq('active', true).order('name')
      .then(({ data }) => setLenders((data as Lender[]) || []));
    supabase.from('requirement_templates').select('*').eq('dealership_id', effectiveDealershipId).eq('active', true).order('sort_order')
      .then(({ data }) => setTemplates((data as RequirementTemplate[]) || []));
    // Editing a delivery whose assigned salesperson/FSM has since been
    // deactivated must still show them in the dropdown (selected), so the
    // form doesn't silently drop or reassign that field on save — fetch
    // them by id alongside the active list if they're not already in it.
    supabase.from('profiles').select('id,name').eq('dealership_id', effectiveDealershipId).eq('role', 'Salesperson').eq('active', true)
      .then(async ({ data }) => {
        const list = (data as Salesperson[]) || [];
        const assignedId = existing?.salesperson_id;
        if (assignedId && !list.some((p) => p.id === assignedId)) {
          const { data: assigned } = await supabase.from('profiles').select('id,name').eq('id', assignedId).eq('dealership_id', effectiveDealershipId).maybeSingle();
          if (assigned) list.push(assigned as Salesperson);
        }
        setSalespeople(list);
      });
    if (canAssignFsm) {
      supabase.from('profiles').select('id,name').eq('dealership_id', effectiveDealershipId).eq('role', 'FSM').eq('active', true)
        .then(async ({ data }) => {
          const list = (data as FinanceManager[]) || [];
          const assignedId = existing?.fsm_id;
          if (assignedId && !list.some((p) => p.id === assignedId)) {
            const { data: assigned } = await supabase.from('profiles').select('id,name').eq('id', assignedId).eq('dealership_id', effectiveDealershipId).maybeSingle();
            if (assigned) list.push(assigned as FinanceManager);
          }
          setFinanceManagers(list);
        });
    }
  }, [effectiveDealershipId, canAssignFsm, existing?.salesperson_id, existing?.fsm_id]);

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
    if (!customer || !salesperson || !deliveryAt || !fsmId) {
      setError('Customer, delivery time, salesperson and Finance Manager are required.');
      return;
    }
    if (dueOnDelivery && (!dueAmount || inputToCents(dueAmount) <= 0)) {
      setError('Enter an amount for the due-on-delivery collection or refund.');
      return;
    }
    setBusy(true);
    setError(null);

    const customerName = capitalizeWords(customer.trim());
    const fsmName = fsmId === session?.user.id ? (profile?.name ?? null) : (financeManagers.find((f) => f.id === fsmId)?.name ?? existing?.fsm_name ?? null);
    const salespersonName = salespeople.find((p) => p.id === salesperson)?.name ?? existing?.salesperson_name ?? null;
    const payload = {
      dealership_id: effectiveDealershipId,
      salesperson_id: salesperson,
      salesperson_name: salespersonName,
      fsm_id: fsmId,
      fsm_name: fsmName,
      customer_name: customerName,
      stock_number: stockNumber.trim() || null,
      lender_id: lenderId || null,
      approval_status: approvalStatus,
      delivery_at: new Date(deliveryAt).toISOString(),
      due_on_delivery: dueOnDelivery,
      due_on_delivery_type: dueOnDelivery ? dueType : null,
      due_on_delivery_amount_cents: dueOnDelivery ? inputToCents(dueAmount) : null,
      fsm_notes: fsmNotes.trim() || null,
    };

    // Compare against the original so the salesperson's push names what
    // actually changed, not just "something did" — computed before the
    // update lands so `existing` still reflects the prior values.
    const changedFields: string[] = [];
    if (isEdit && existing) {
      if (customerName !== existing.customer_name) changedFields.push('customer name');
      if ((stockNumber.trim() || null) !== existing.stock_number) changedFields.push('stock number');
      if ((lenderId || null) !== existing.lender_id) changedFields.push('lender/lessor');
      if (approvalStatus !== existing.approval_status) changedFields.push('approval status');
      if (payload.delivery_at !== existing.delivery_at) changedFields.push('delivery time');
      if ((fsmNotes.trim() || null) !== existing.fsm_notes) changedFields.push('notes');
      if (salesperson !== existing.salesperson_id) changedFields.push('assigned salesperson');
      if (fsmId !== existing.fsm_id) changedFields.push('assigned finance manager');
    }
    const fsmReassigned = isEdit && !!existing && fsmId !== existing.fsm_id;

    let deliveryId = existing?.id;
    if (isEdit) {
      const { error } = await supabase.from('deliveries').update(payload).eq('id', existing!.id);
      if (error) { setBusy(false); setError(error.message); return; }
    } else {
      const { data, error } = await supabase.from('deliveries').insert(payload).select().single();
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

    // Due-on-delivery is itself a requirement — the salesperson clears it
    // from the same requirements grid instead of it sitting as a separate
    // info line, so it's reconciled the same way as templates/custom items.
    const dueLabel = dueOnDelivery ? `${dueType === 'refund' ? 'Refund' : 'Collect'} ${formatCents(inputToCents(dueAmount))}` : null;
    const existingDueReq = existingReqs.find((r) => r.kind === 'due_on_delivery');
    const dueLabelChanged = !!(dueOnDelivery && existingDueReq && existingDueReq.label !== dueLabel);

    const inserts = [
      ...toAddTemplates.map((t) => ({ delivery_id: deliveryId, kind: 'template', template_id: t.id, label: t.label })),
      ...toAddCustom.map((c) => ({ delivery_id: deliveryId, kind: 'custom', label: c.label })),
      ...(dueOnDelivery && !existingDueReq ? [{ delivery_id: deliveryId, kind: 'due_on_delivery', label: dueLabel }] : []),
    ];
    if (inserts.length) {
      const { error: reqError } = await supabase.from('delivery_requirements').insert(inserts);
      if (reqError) { setBusy(false); setError(`Saved, but requirements failed: ${reqError.message}`); return; }
    }
    const toRemove = [
      ...toRemoveTemplateReqIds,
      ...toRemoveCustomReqIds,
      ...(!dueOnDelivery && existingDueReq && existingDueReq.status === 'outstanding' ? [existingDueReq.id] : []),
    ];
    if (toRemove.length) {
      await supabase.from('delivery_requirements').delete().in('id', toRemove);
    }
    if (dueLabelChanged) {
      await supabase.from('delivery_requirements').update({ label: dueLabel }).eq('id', existingDueReq!.id);
    }

    const requirementLabels = [
      ...templates.filter((t) => checkedTemplates.has(t.id)).map((t) => t.label),
      ...customReqs.map((c) => c.label),
      ...(dueLabel ? [dueLabel] : []),
    ];
    const todo = requirementLabels.length ? ` Needed: ${requirementLabels.join(', ')}.` : '';

    if (!isEdit) {
      await supabase.functions.invoke('send-webpush', {
        body: {
          profile_ids: [salesperson],
          title: 'New Delivery Created',
          body: `${customerName} — ${new Date(deliveryAt).toLocaleString()}.${todo}`,
          data: { url: `/delivery/${deliveryId}`, deliveryId, type: 'delivery_assigned' },
        },
      }).catch(() => {});
    } else if (changedFields.length || inserts.length || toRemove.length || dueLabelChanged) {
      // Any real edit to an already-assigned delivery reaches the
      // salesperson right away instead of waiting for the next reminder —
      // requirement changes and field changes (approval, lender, timing,
      // notes, reassignment) alike.
      const requirementsChanged = inserts.length || toRemove.length || dueLabelChanged;
      const fieldSummary = changedFields.length ? `Updated: ${changedFields.join(', ')}.` : '';
      await supabase.functions.invoke('send-webpush', {
        body: {
          profile_ids: [salesperson],
          title: 'Delivery Updated',
          body: `${customerName}. ${fieldSummary}${requirementsChanged ? todo : ''}`.trim(),
          data: { url: `/delivery/${deliveryId}`, deliveryId, type: 'delivery_updated' },
        },
      }).catch(() => {});
    }
    if (fsmReassigned) {
      // Reassignment is a separate notice to the newly assigned FSM, not
      // just a line in the salesperson's "updated" push above.
      await supabase.functions.invoke('send-webpush', {
        body: {
          profile_ids: [fsmId],
          title: 'Delivery Assigned to You',
          body: `${customerName} — ${new Date(deliveryAt).toLocaleString()}.`,
          data: { url: `/delivery/${deliveryId}`, deliveryId, type: 'fsm_assigned' },
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

      <input
        placeholder="Customer name"
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
        style={{ textTransform: 'capitalize' }}
      />

      <input
        placeholder="Stock # (so the salesperson can pull the right key)"
        value={stockNumber}
        onChange={(e) => setStockNumber(e.target.value)}
        autoCapitalize="characters"
      />

      <div style={fieldLabel}>LENDER / LESSOR</div>
      <select value={lenderId} onChange={(e) => setLenderId(e.target.value)}>
        <option value="">Not selected</option>
        {lenders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>

      <div style={fieldLabel}>APPROVAL STATUS</div>
      <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}>
        {APPROVAL_OPTIONS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
      </select>

      <div style={fieldLabel}>DELIVERY DATE &amp; TIME</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} style={{ flex: 1.2 }} />
        <select
          value={deliveryTime}
          onChange={(e) => setDeliveryTime(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">Time</option>
          {QUARTER_HOUR_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

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
      <select value={salesperson} onChange={(e) => setSalesperson(e.target.value)}>
        <option value="">Select a salesperson</option>
        {salespeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {canAssignFsm && (
        <>
          <div style={fieldLabel}>FINANCE MANAGER</div>
          <select value={fsmId} onChange={(e) => setFsmId(e.target.value)}>
            <option value="">Select a Finance Manager</option>
            {financeManagers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </>
      )}

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
