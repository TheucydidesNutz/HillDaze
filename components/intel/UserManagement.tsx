'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IntelMemberRole } from '@/lib/intel/types';

interface Member {
  id: string;
  user_id: string;
  role: IntelMemberRole;
  display_name: string;
  title: string | null;
  company: string | null;
  email?: string;
  created_at: string;
}

export default function UserManagement({
  orgId,
  currentUserRole,
}: {
  orgId: string;
  currentUserRole: IntelMemberRole;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user' as IntelMemberRole,
    display_name: '',
    title: '',
    company: '',
  });
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    const res = await fetch(`/api/intel/orgs/${orgId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setMessage('');

    const res = await fetch(`/api/intel/orgs/${orgId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });

    if (res.ok) {
      setMessage('Member invited successfully');
      setShowInvite(false);
      setInviteForm({ email: '', role: 'user', display_name: '', title: '', company: '' });
      fetchMembers();
    } else {
      const err = await res.json();
      setMessage(err.error || 'Failed to invite member');
    }
    setInviting(false);
  }

  async function handleRoleChange(memberId: string, newRole: IntelMemberRole) {
    const res = await fetch(`/api/intel/orgs/${orgId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      fetchMembers();
    }
    setEditingRole(null);
  }

  async function handleRemove(memberId: string) {
    const res = await fetch(`/api/intel/orgs/${orgId}/members/${memberId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchMembers();
    }
    setConfirmDelete(null);
  }

  const roleColors: Record<string, string> = {
    super_admin: 'bg-purple-500/20 text-purple-300',
    admin: 'bg-blue-500/20 text-blue-300',
    user: 'bg-green-500/20 text-green-300',
    viewer: 'bg-gray-500/20 text-gray-300',
  };

  const availableRoles: IntelMemberRole[] = ['admin', 'user', 'viewer'];

  if (loading) {
    return <div style={{ color: 'var(--intel-text)' }} className="opacity-60">Loading members...</div>;
  }

  return (
    <div>
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-white/[0.06] border border-white/10">
          <p className="text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm opacity-60" style={{ color: 'var(--intel-text)' }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="px-4 py-2 text-sm text-white font-medium rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--intel-primary)' }}
        >
          {showInvite ? 'Cancel' : 'Invite Member'}
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--intel-text)' }}>
                Email *
              </label>
              <input
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--intel-text)' }}>
                Display Name *
              </label>
              <input
                type="text"
                required
                value={inviteForm.display_name}
                onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--intel-text)' }}>
                Role *
              </label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as IntelMemberRole })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r} className="bg-gray-900">
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--intel-text)' }}>
                Title
              </label>
              <input
                type="text"
                value={inviteForm.title}
                onChange={(e) => setInviteForm({ ...inviteForm, title: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--intel-text)' }}>
                Company
              </label>
              <input
                type="text"
                value={inviteForm.company}
                onChange={(e) => setInviteForm({ ...inviteForm, company: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 text-sm text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--intel-primary)' }}
          >
            {inviting ? 'Inviting...' : 'Send Invite'}
          </button>
        </form>
      )}

      {/* Members table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--intel-text)', opacity: 0.5 }}>
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--intel-text)', opacity: 0.5 }}>
                Title / Company
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--intel-text)', opacity: 0.5 }}>
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--intel-text)', opacity: 0.5 }}>
                Joined
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>
                    {m.display_name}
                  </div>
                  {m.email && (
                    <div className="text-xs opacity-50" style={{ color: 'var(--intel-text)' }}>
                      {m.email}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="text-sm" style={{ color: 'var(--intel-text)', opacity: 0.7 }}>
                    {[m.title, m.company].filter(Boolean).join(' at ') || '\u2014'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingRole === m.id ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as IntelMemberRole)}
                      onBlur={() => setEditingRole(null)}
                      autoFocus
                      className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-white"
                    >
                      {availableRoles.map((r) => (
                        <option key={r} value={r} className="bg-gray-900">
                          {r.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => {
                        if (m.role === 'super_admin') return;
                        if (currentUserRole === 'admin' && m.role === 'admin') return;
                        setEditingRole(m.id);
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium capitalize ${roleColors[m.role] || ''} ${
                        m.role === 'super_admin' || (currentUserRole === 'admin' && m.role === 'admin')
                          ? 'cursor-default'
                          : 'cursor-pointer hover:opacity-80'
                      }`}
                    >
                      {m.role.replace('_', ' ')}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="text-xs opacity-50" style={{ color: 'var(--intel-text)' }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  {m.role !== 'super_admin' && (
                    <>
                      {confirmDelete === m.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleRemove(m.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs opacity-50 hover:opacity-80"
                            style={{ color: 'var(--intel-text)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(m.id)}
                          className="text-xs text-red-400/60 hover:text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
