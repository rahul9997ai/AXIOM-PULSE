import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Delivery, DeliveryComment } from '@/lib/types';
import { STATUS_LABEL, STATUS_COLOR, MANAGER_ROLES } from '@/lib/types';
import { capitalizeWords } from '@/lib/text';
import { downloadDeliveryIcs } from '@/lib/ics';
import {
  CalendarIcon, PinIcon, CarIcon,
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

  const resolveRequirement = async (reqId: string, status: 'completed' | 'exception' | 'outstanding', reason?: string) => {
    const { error } = await supabase.rpc('set_requirement_status', {
      p_requirement_id: reqId,
      p_status: status,
      p_exception_reason: reason ?? null,
    });
    if (error) { setNotice(error.message); return; }
    setExceptionFor(null);
    setExceptionReason('');
    // The FSM hears about it the moment the salesperson resolves a
    // requirement — completed or flagged as an exception — not just when
    // the whole delivery is marked done. Undoing back to outstanding stays
    // quiet so toggling a mistake off doesn't spam a push.
    if (!isManager && status !== 'outstanding') {
      const req = requirements.find((r) => r.id === reqId);
      if (req) {
        await supabase.functions.invoke('send-webpush', {
          body: {
            profile_ids: [d.fsm_id],
            delivery_id: d.id,
            title: `${status === 'completed' ? 'Completed' : 'Exception'} — ${d.customer_name}`,
            body: status === 'completed' ? `${req.label} marked complete.` : `${req.label}: ${reason}`,
            data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'requirement_update' },
          },
        }).catch(() => {});
      }
    }
    load();
  };

  const complete = async () => {
    const { error } = await supabase.rpc('complete_delivery', { p_delivery_id: d.id });
    if (error) { setNotice(error.message); return; }
    const exceptions = requirements.filter((r) => r.status === 'exception');
    const exceptionsBody = exceptions.length
      ? `Delivery Complete for ${d.customer_name} — with exceptions: ${exceptions.map((r) => `${r.label}${r.exception_reason ? ` (${r.exception_reason})` : ''}`).join('; ')}.`
      : `Delivery Complete for ${d.customer_name} — with no exceptions.`;
    await supabase.functions.invoke('send-webpush', {
      body: {
        profile_ids: [d.fsm_id],
        delivery_id: d.id,
        title: `Delivery Complete — ${d.customer_name}`,
        body: exceptionsBody,
        data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'delivery_complete' },
      },
    }).catch(() => {});
    load();
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
    const requiresDecision = effectiveRole === 'Salesperson';
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
    if (requiresDecision) {
      await supabase.functions.invoke('send-webpush', {
        body: {
          profile_ids: [d.fsm_id],
          delivery_id: d.id,
          title: `Approval needed — ${d.customer_name}`,
          body,
          data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'question' },
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.25 }}>{d.customer_name}</span>
              {d.stock_number && (
                <span style={{
                  fontSize: 12, fontWeight: 800, letterSpacing: 0.3, color: 'var(--accent)',
                  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 7, padding: '3px 8px',
                }}>
                  Stock #{d.stock_number}
                </span>
              )}
            </div>
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
          {isManager && d.salesperson_name && <InfoRow label="Salesperson" value={d.salesperson_name} />}
          {d.fsm_name && <InfoRow label="Finance Manager" value={d.fsm_name} />}
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
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -6, marginBottom: 10 }}>
            Tap to mark complete, tap again to undo. Tap the ! badge to flag an exception instead.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {requirements.map((r) => {
              const canEdit = !isManager && canComplete;
              const tone = r.status === 'completed' ? { bg: '#eafaf0', fg: '#15803d', border: '#bfe8cf' }
                : r.status === 'exception' ? { bg: '#fef3e2', fg: '#b45309', border: '#f6dba6' }
                : { bg: 'var(--blue)', fg: '#fff', border: 'var(--blue)' };
              const onTap = !canEdit ? undefined
                : r.status === 'outstanding' ? () => resolveRequirement(r.id, 'completed')
                : () => resolveRequirement(r.id, 'outstanding');
              return (
                <div key={r.id} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    disabled={!onTap}
                    onClick={onTap}
                    title={r.status === 'exception' && r.exception_reason ? r.exception_reason : undefined}
                    style={{
                      width: '100%', minHeight: 58, background: tone.bg, border: `1px solid ${tone.border}`,
                      borderRadius: 12, color: tone.fg, fontSize: 11.5, fontWeight: 700, lineHeight: 1.2,
                      padding: '8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', cursor: onTap ? 'pointer' : 'default',
                    }}
                  >
                    {r.status === 'completed' && '✓ '}{r.status === 'exception' && '⚠ '}{r.label}
                  </button>
                  {r.status === 'outstanding' && canEdit && (
                    <button
                      type="button"
                      aria-label={`Flag exception for ${r.label}`}
                      onClick={(e) => { e.stopPropagation(); setExceptionFor(r.id); }}
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                        background: '#fff', border: '1px solid #f6dba6', color: '#b45309', fontSize: 12, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(20,50,100,0.15)',
                      }}
                    >
                      !
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {requirements.some((r) => r.status === 'exception' && r.exception_reason) && (
            <div style={{ display: 'grid', gap: 3, marginTop: 10 }}>
              {requirements.filter((r) => r.status === 'exception' && r.exception_reason).map((r) => (
                <div key={r.id} style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  <strong style={{ color: '#b45309' }}>{r.label}:</strong> {r.exception_reason}
                </div>
              ))}
            </div>
          )}
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
          A salesperson's request here needs a Finance Manager decision — approve or deny (with a reason).
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
          <textarea
            placeholder={!isManager
              ? 'What do you need approved? Be specific — this goes to the Finance Manager for a decision…'
              : 'Reply to the salesperson…'}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
          />
          <button className="btn" disabled={sendingComment || !newComment.trim()} onClick={postComment}>
            {sendingComment ? 'Sending…' : !isManager ? 'Send for approval' : 'Send'}
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
