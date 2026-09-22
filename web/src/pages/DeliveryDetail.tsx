import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Delivery, DeliveryComment } from '@/lib/types';
import { STATUS_LABEL, STATUS_COLOR, MANAGER_ROLES } from '@/lib/types';
import { formatCents } from '@/lib/money';
import { capitalizeWords } from '@/lib/text';
import { downloadDeliveryIcs } from '@/lib/ics';
import {
  CalendarIcon, PinIcon, DollarIcon, CarIcon, CheckCircleIcon, AlertIcon, CircleIcon,
  EditIcon, BellIcon, TrashIcon,
} from '@/components/Icons';

export default function DeliveryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, session } = useSession();
  const { isMaster, actingRole } = useActingRole();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [comments, setComments] = useState<DeliveryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [exceptionFor, setExceptionFor] = useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'question' | 'approval'>('question');
  const [sendingComment, setSendingComment] = useState(false);
  const [denyFor, setDenyFor] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');

  const effectiveRole = isMaster ? actingRole : profile?.role;
  const isManager = effectiveRole ? MANAGER_ROLES.includes(effectiveRole) : false;

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: d, error: dErr }, { data: c }] = await Promise.all([
      supabase.from('deliveries').select('*, delivery_requirements(*), lenders(name, address)').eq('id', id).single(),
      supabase.from('delivery_comments').select('*').eq('delivery_id', id).order('created_at', { ascending: true }),
    ]);
    if (dErr || !d) { navigate('/'); return; }
    setDelivery(d as Delivery);
    setComments((c as DeliveryComment[]) || []);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`delivery-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requirements', filter: `delivery_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_comments', filter: `delivery_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  if (loading || !delivery) return <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>Loading…</div>;

  const d = delivery;
  const requirements = d.delivery_requirements || [];
  const open = requirements.filter((r) => r.status === 'outstanding');
  const canComplete = !isManager && d.status !== 'delivered' && d.status !== 'cancelled';
  const sc = STATUS_COLOR[d.status];
  const dt = new Date(d.delivery_at);
  const darkGreen = '#15803d';

  const resolveRequirement = async (reqId: string, status: 'completed' | 'exception', reason?: string) => {
    const { error } = await supabase.rpc('set_requirement_status', {
      p_requirement_id: reqId,
      p_status: status,
      p_exception_reason: reason ?? null,
    });
    if (error) setNotice(error.message);
    else { setExceptionFor(null); setExceptionReason(''); load(); }
  };

  const complete = async () => {
    const { error } = await supabase.rpc('complete_delivery', { p_delivery_id: d.id });
    if (error) setNotice(error.message);
    else load();
  };

  const deleteDelivery = async () => {
    if (!window.confirm(`Permanently delete the delivery record for ${d.customer_name}? This can't be undone.`)) return;
    const { error } = await supabase.from('deliveries').delete().eq('id', d.id);
    if (error) setNotice(error.message);
    else navigate('/');
  };

  const sendUrgentNotify = async () => {
    const body = notifyMessage.trim() || (open.length
      ? `Still needed: ${open.map((r) => r.label).join(', ')}.`
      : `Please check the ${d.customer_name} delivery.`);
    const { data, error } = await supabase.functions.invoke('send-webpush', {
      body: {
        profile_ids: [d.salesperson_id],
        title: `Urgent: ${d.customer_name}`,
        body,
        data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'urgent' },
      },
    });
    if (error) setNotice(error.message);
    else if (!data?.sent) setNotice('Sent, but the salesperson has no device enrolled for push yet.');
    else setNotice(`Notification sent to ${data.sent} device(s).`);
    setNotifyOpen(false);
    setNotifyMessage('');
  };

  const postComment = async () => {
    const body = newComment.trim();
    if (!body || !profile || !session) return;
    setSendingComment(true);
    const requiresDecision = effectiveRole === 'Salesperson' && commentType === 'approval';
    const isSalespersonComment = effectiveRole === 'Salesperson';
    const { error } = await supabase.from('delivery_comments').insert({
      delivery_id: d.id,
      author_id: session.user.id,
      author_name: profile.name,
      author_role: effectiveRole,
      body,
      requires_decision: requiresDecision,
    });
    setSendingComment(false);
    if (error) { setNotice(error.message); return; }
    setNewComment('');
    setCommentType('question');
    if (isSalespersonComment) {
      await supabase.functions.invoke('send-webpush', {
        body: {
          profile_ids: [d.fsm_id],
          delivery_id: d.id,
          title: requiresDecision ? `Approval needed — ${d.customer_name}` : `Question — ${d.customer_name}`,
          body,
          data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: requiresDecision ? 'question' : 'chat' },
        },
      }).catch(() => {});
    }
    load();
  };

  const decide = async (comment: DeliveryComment, status: 'approved' | 'denied', reason?: string) => {
    if (!profile) return;
    const { error } = await supabase.rpc('decide_delivery_comment', {
      p_comment_id: comment.id,
      p_status: status,
      p_reason: reason ?? null,
      p_decided_by_name: profile.name,
    });
    if (error) { setNotice(error.message); return; }
    setDenyFor(null);
    setDenyReason('');
    await supabase.functions.invoke('send-webpush', {
      body: {
        profile_ids: [comment.author_id],
        title: status === 'approved' ? 'Question Approved' : 'Question Denied',
        body: status === 'denied' ? `${comment.body} — ${reason}` : comment.body,
        data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'question_decided' },
      },
    }).catch(() => {});
    load();
  };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <Link to="/" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>‹ Back to Deliveries</Link>

      <div className="card" style={{ borderLeft: `4px solid ${sc.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.25 }}>{d.customer_name}</div>
            {(d.vehicle || d.vin) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', marginTop: 3, fontSize: 13 }}>
                <CarIcon size={13} />
                {[d.vehicle, d.vin ? `VIN ${d.vin}` : null].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <span style={{
            flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
            background: sc.bg, color: sc.fg, padding: '4px 9px', borderRadius: 999,
          }}>
            {STATUS_LABEL[d.status]}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginTop: 12,
          padding: '8px 12px', borderRadius: 10, background: '#eafaf0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: darkGreen, display: 'flex' }}><CalendarIcon size={16} /></span>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: darkGreen }}>
              {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: darkGreen }}>
              {dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => downloadDeliveryIcs(d)}
            style={{ border: `1px solid ${darkGreen}`, color: darkGreen, background: 'transparent', borderRadius: 7, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            + Calendar
          </button>
        </div>
        {d.status === 'delivered' && d.delivered_at && (
          <div style={{ color: '#15803d', fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>
            Delivered {new Date(d.delivered_at).toLocaleString()}
          </div>
        )}

        <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 13.5 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <span style={{ color: 'var(--muted)', marginTop: 2, flexShrink: 0 }}><PinIcon size={13} /></span>
            <div style={{ color: 'var(--text)' }}>
              {d.lenders?.name || 'Lender / lessor not selected'}
              {d.lenders?.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(d.lenders.address)}`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'block', color: 'var(--accent)', fontSize: 12.5, marginTop: 1, textDecoration: 'none' }}
                >
                  {d.lenders.address}
                </a>
              )}
            </div>
          </div>
          <InfoRow label="Approval" value={capitalizeWords(d.approval_status)} />
          {d.fsm_name && <InfoRow label="Finance Manager" value={d.fsm_name} />}
          {d.due_on_delivery && d.due_on_delivery_amount_cents != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ color: 'var(--muted)', flexShrink: 0 }}><DollarIcon size={13} /></span>
              <span style={{ color: 'var(--muted)' }}>
                {d.due_on_delivery_type === 'refund' ? 'Refund to customer' : 'Collect from customer'}:{' '}
                <strong style={{ color: 'var(--text)' }}>{formatCents(d.due_on_delivery_amount_cents)}</strong>
              </span>
            </div>
          )}
        </div>

        {d.fsm_notes && (
          <div style={{ marginTop: 10, fontSize: 13, fontStyle: 'italic', color: 'var(--muted)' }}>“{d.fsm_notes}”</div>
        )}

        {isManager && (
          <div style={{ display: 'flex', gap: 6, marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <Link to={`/edit/${d.id}`} className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', padding: '5px 11px', fontSize: 12 }}>
              <EditIcon size={14} /> Edit
            </Link>
            <button type="button" className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 12 }} onClick={() => setNotifyOpen((v) => !v)}>
              <BellIcon size={14} /> Notify
            </button>
            <button type="button" className="btn secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', fontSize: 12, borderColor: '#dc2626', color: '#dc2626', marginLeft: 'auto' }} onClick={deleteDelivery}>
              <TrashIcon size={14} /> Delete
            </button>
          </div>
        )}
        {notifyOpen && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <textarea placeholder="Urgent message to the salesperson (optional — defaults to outstanding requirements)" value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} rows={2} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={sendUrgentNotify}>Send urgent notification</button>
              <button className="btn secondary" onClick={() => { setNotifyOpen(false); setNotifyMessage(''); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {notice && <div className="card" style={{ fontSize: 13 }}>{notice}</div>}

      {requirements.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Requirements</h3>
          <div style={{ display: 'grid', gap: 9 }}>
            {requirements.map((r) => {
              const color = r.status === 'completed' ? '#15803d' : r.status === 'exception' ? '#b45309' : 'var(--muted)';
              const ReqIcon = r.status === 'completed' ? CheckCircleIcon : r.status === 'exception' ? AlertIcon : CircleIcon;
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 13.5, color: 'var(--text)' }}>
                    <span style={{ color, marginTop: 1, flexShrink: 0 }}><ReqIcon size={14} /></span>
                    <span>{r.label}{r.status === 'exception' && r.exception_reason ? ` — ${r.exception_reason}` : ''}</span>
                  </span>
                  {!isManager && r.status === 'outstanding' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => resolveRequirement(r.id, 'completed')}>Done</button>
                      <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setExceptionFor(r.id)}>Exception</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {exceptionFor && requirements.some((r) => r.id === exceptionFor) && (
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <textarea placeholder="Reason this couldn't be completed" value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} rows={2} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} disabled={!exceptionReason.trim()} onClick={() => resolveRequirement(exceptionFor, 'exception', exceptionReason.trim())}>Save exception</button>
                <button className="btn secondary" onClick={() => { setExceptionFor(null); setExceptionReason(''); }}>Cancel</button>
              </div>
            </div>
          )}
          {canComplete && open.length === 0 && (
            <button className="btn" style={{ marginTop: 14, width: '100%' }} onClick={complete}>Mark delivered</button>
          )}
        </div>
      )}
      {requirements.length === 0 && canComplete && (
        <button className="btn" onClick={complete}>Mark delivered</button>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Comments</h3>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: -6 }}>
          Approval requests need a Finance Manager decision — approve or deny (with a reason). Questions are an open chat.
        </p>
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          {comments.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No comments yet.</div>}
          {comments.map((c) => (
            <div key={c.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{c.author_name} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {c.author_role}</span></span>
                <span>{new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 13.5, marginTop: 3, color: 'var(--text)' }}>{c.body}</div>

              {c.requires_decision && (
                <div style={{ marginTop: 6 }}>
                  {c.status === 'pending' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>Awaiting decision</span>
                  )}
                  {c.status === 'approved' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>✓ Approved by {c.decided_by_name}</span>
                  )}
                  {c.status === 'denied' && (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a3261b' }}>
                      ✕ Denied by {c.decided_by_name}{c.decision_reason ? ` — ${c.decision_reason}` : ''}
                    </div>
                  )}
                </div>
              )}

              {isManager && c.requires_decision && c.status === 'pending' && (
                <div style={{ marginTop: 8 }}>
                  {denyFor === c.id ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <textarea placeholder="Reason for denial" value={denyReason} onChange={(e) => setDenyReason(e.target.value)} rows={2} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn" style={{ padding: '5px 10px', fontSize: 12, flex: 1 }} disabled={!denyReason.trim()} onClick={() => decide(c, 'denied', denyReason.trim())}>Confirm denial</button>
                        <button className="btn secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { setDenyFor(null); setDenyReason(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12, borderColor: '#15803d', color: '#15803d' }} onClick={() => decide(c, 'approved')}>Approve</button>
                      <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12, borderColor: '#dc2626', color: '#dc2626' }} onClick={() => setDenyFor(c.id)}>Deny</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {!isManager && (
            <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', borderRadius: 10, padding: 3 }}>
              {([
                { key: 'question', label: 'Ask a question' },
                { key: 'approval', label: 'Request approval' },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setCommentType(t.key)}
                  style={{
                    flex: 1, border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 12.5, fontWeight: 700,
                    cursor: 'pointer', background: commentType === t.key ? '#fff' : 'transparent',
                    color: commentType === t.key ? 'var(--ink)' : 'var(--muted)',
                    boxShadow: commentType === t.key ? '0 1px 3px rgba(20,50,100,0.12)' : 'none',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <textarea
            placeholder={!isManager
              ? (commentType === 'approval' ? 'What do you need approved? Be specific — this goes to the Finance Manager for a decision…' : 'Ask the Finance Manager a question about this delivery…')
              : 'Reply to the salesperson…'}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
          />
          <button className="btn" disabled={sendingComment || !newComment.trim()} onClick={postComment}>
            {sendingComment ? 'Sending…' : commentType === 'approval' && !isManager ? 'Send for approval' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ color: 'var(--muted)' }}>
      {label}: <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{value}</strong>
    </div>
  );
}
