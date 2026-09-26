import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';

interface Dealership { id: string; name: string; active: boolean; }
interface AppUser { id: string; name: string; role: Role; dealership_id: string | null; active: boolean; }

const INVITE_ROLES: Role[] = ['General Manager', 'FSM', 'Salesperson'];

function newDealershipId(): string {
  return 'd-' + Math.random().toString(36).slice(2, 8);
}

export default function AdminHome() {
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [loadingDealerships, setLoadingDealerships] = useState(true);
  const [newDealershipName, setNewDealershipName] = useState('');
  const [creatingDealership, setCreatingDealership] = useState(false);

  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Salesperson');
  const [inviteDealershipId, setInviteDealershipId] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviting, setInviting] = useState(false);

  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadDealerships = async () => {
    setLoadingDealerships(true);
    const { data } = await supabase.from('dealerships').select('id,name,active').order('name');
    const list = (data as Dealership[]) || [];
    setDealerships(list);
    setInviteDealershipId((prev) => prev || list[0]?.id || '');
    setLoadingDealerships(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('id,name,role,dealership_id,active')
      .neq('role', 'Master Administrator')
      .order('name');
    setUsers((data as AppUser[]) || []);
    setLoadingUsers(false);
  };

  useEffect(() => { loadDealerships(); loadUsers(); }, []);

  const deleteUser = async (u: AppUser) => {
    if (!window.confirm(`Remove ${u.name} (${u.role})? This can't be undone.`)) return;
    setDeletingId(u.id);
    const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'delete', id: u.id } });
    setDeletingId(null);
    if (error) { setNotice({ text: error.message, tone: 'err' }); return; }
    setNotice({
      text: data?.deactivated
        ? `${u.name} has records tied to their account, so they were deactivated instead of removed — they can no longer sign in.`
        : `${u.name} removed.`,
      tone: 'ok',
    });
    loadUsers();
  };

  const resetUserPassword = async (u: AppUser) => {
    const password = resetPassword.trim();
    if (password.length < 8) { setNotice({ text: 'Temporary password needs at least 8 characters.', tone: 'err' }); return; }
    setResetting(true);
    const { error } = await supabase.functions.invoke('admin-users', { body: { action: 'reset_password', id: u.id, password } });
    setResetting(false);
    if (error) { setNotice({ text: error.message, tone: 'err' }); return; }
    setNotice({ text: `${u.name}'s password reset — share the new temporary password with them. They'll be asked to change it on next sign-in.`, tone: 'ok' });
    setResetId(null);
    setResetPassword('');
  };

  const createDealership = async () => {
    const name = newDealershipName.trim();
    if (!name) { setNotice({ text: 'Give the dealership a name.', tone: 'err' }); return; }
    setCreatingDealership(true);
    const data = {
      id: newDealershipId(),
      name,
      brandKey: 'ford',
      logoMark: name.slice(0, 3).toUpperCase(),
      dealerCode: 'DLR-' + Math.floor(1000 + Math.random() * 8999),
      active: true,
      address: '', city: '', phone: '', email: '',
      finance: { defaultApr: 7.49, defaultTerm: 72, defaultFrequency: 'biweekly', adminFee: 699, licensing: 120 },
      tax: { standard: 13, vrc: 8 },
    };
    const { error } = await supabase.from('dealerships').insert({ id: data.id, name, active: true, data });
    setCreatingDealership(false);
    if (error) { setNotice({ text: error.message, tone: 'err' }); return; }
    setNewDealershipName('');
    setNotice({ text: `${name} created. Fine-tune brand, tax and finance defaults for it in Axiom Command Center.`, tone: 'ok' });
    loadDealerships();
  };

  const invite = async () => {
    const name = inviteName.trim();
    const password = invitePassword.trim();
    if (!name) { setNotice({ text: "Enter the user's name.", tone: 'err' }); return; }
    if (!inviteDealershipId) { setNotice({ text: 'Select a dealership first.', tone: 'err' }); return; }
    if (password.length < 8) { setNotice({ text: 'Temporary password needs at least 8 characters.', tone: 'err' }); return; }

    const payload: Record<string, unknown> = {
      action: 'create',
      name,
      role: inviteRole,
      dealership_id: inviteDealershipId,
      password,
      access_type: 'full',
    };
    const identifier = inviteIdentifier.trim();
    if (inviteRole === 'Salesperson') {
      const username = identifier.toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        setNotice({ text: 'Username must be 3-30 characters: letters, numbers, dots, underscores or hyphens only.', tone: 'err' });
        return;
      }
      payload.username = username;
    } else {
      if (!/^\S+@\S+\.\S+$/.test(identifier)) { setNotice({ text: 'Enter a valid email address.', tone: 'err' }); return; }
      payload.email = identifier;
    }

    setInviting(true);
    const { error } = await supabase.functions.invoke('admin-users', { body: payload });
    setInviting(false);
    if (error) { setNotice({ text: error.message, tone: 'err' }); return; }
    setNotice({
      text: `${name} created — share the temporary ${inviteRole === 'Salesperson' ? 'username and ' : ''}password with them.`,
      tone: 'ok',
    });
    setInviteName('');
    setInviteIdentifier('');
    setInvitePassword('');
    loadUsers();
  };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Admin</h1>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
          Master Administrator
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
        Create dealerships and invite General Managers, FSMs and Salespeople. To preview or test any
        of it as a delivery, use the "Viewing as" switcher at the top of the screen.
      </p>

      <Link to="/month-close" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Closed Months</div>
        <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>
          See which Finance Managers have closed which months, and reopen one if needed.
        </div>
      </Link>

      {notice && (
        <div className="card" style={{ fontSize: 13, color: notice.tone === 'err' ? '#a3261b' : '#15803d' }}>
          {notice.text}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Dealerships</h3>
        {loadingDealerships && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
        {!loadingDealerships && dealerships.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>No dealerships yet.</div>
        )}
        {dealerships.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
            {dealerships.map((d) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{d.name}</span>
                <span style={{ color: d.active ? '#15803d' : '#a3261b', fontWeight: 700, fontSize: 11 }}>
                  {d.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="New dealership name" value={newDealershipName} onChange={(e) => setNewDealershipName(e.target.value)} />
          <button className="btn" disabled={creatingDealership} onClick={createDealership}>
            {creatingDealership ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Invite a user</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />

          <select value={inviteRole} onChange={(e) => { setInviteRole(e.target.value as Role); setInviteIdentifier(''); }}>
            {INVITE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <select value={inviteDealershipId} onChange={(e) => setInviteDealershipId(e.target.value)}>
            {dealerships.length === 0 && <option value="">No dealerships yet</option>}
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <input
            placeholder={inviteRole === 'Salesperson' ? 'Username (e.g. alexis.n)' : 'Email'}
            value={inviteIdentifier}
            onChange={(e) => setInviteIdentifier(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
          />

          <input placeholder="Temporary password (min 8 characters)" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} />

          <button className="btn" disabled={inviting} onClick={invite}>
            {inviting ? 'Inviting…' : 'Send invite'}
          </button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          No email verification needed — share the temporary password directly. A Salesperson signs in
          with their username and password right here in Pulse. Everyone chooses their own password on
          first sign-in.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Users</h3>
        {loadingUsers && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
        {!loadingUsers && users.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No General Managers, FSMs or Salespeople yet.</div>
        )}
        {users.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {users.map((u) => {
              const dealership = dealerships.find((d) => d.id === u.dealership_id);
              return (
                <div key={u.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {u.name} {!u.active && <span style={{ color: '#a3261b', fontSize: 11, fontWeight: 700 }}>· Inactive</span>}
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{u.role} · {dealership?.name ?? 'No dealership'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => { setResetId(resetId === u.id ? null : u.id); setResetPassword(''); }}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ padding: '4px 10px', fontSize: 12, borderColor: '#dc2626', color: '#dc2626' }}
                        disabled={deletingId === u.id}
                        onClick={() => deleteUser(u)}
                      >
                        {deletingId === u.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                  {resetId === u.id && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        placeholder="New temporary password (min 8 characters)"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                      />
                      <button className="btn" style={{ flexShrink: 0 }} disabled={resetting} onClick={() => resetUserPassword(u)}>
                        {resetting ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
        For full dealership settings (brand, tax, finance defaults), use Axiom Command Center.
      </p>
    </div>
  );
}
