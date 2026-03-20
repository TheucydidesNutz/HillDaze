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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const roleColors: Record<string, { badge: string; bg: string }> = {
  super_admin: { badge: 'bg-purple-500/20 text-purple-300', bg: 'bg-purple-500' },
  admin: { badge: 'bg-blue-500/20 text-blue-300', bg: 'bg-blue-500' },
  user: { badge: 'bg-green-500/20 text-green-300', bg: 'bg-green-500' },
  viewer: { badge: 'bg-gray-500/20 text-gray-300', bg: 'bg-gray-500' },
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  user: 'User',
  viewer: 'Viewer',
};

const availableRoles: IntelMemberRole[] = ['admin', 'user', 'viewer'];

export default function TeamManagement({
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
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isAdmin = currentUserRole === 'super_admin' || currentUserRole === 'admin';

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
    setMessage(null);

    const res = await fetch(`/api/intel/orgs/${orgId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });

    if (res.ok) {
      setMessage({ text: 'Member invited successfully', type: 'success' });
      setShowInvite(false);
      setInviteForm({ email: '', role: 'user', display_name: '', title: '', company: '' });
      fetchMembers();
    } else {
      const err = await res.json();
      setMessage({ text: err.error || 'Failed to invite member', type: 'error' });
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12" style={{ color: 'var(--analysis-text)' }}>
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-40" />
        <span className="text-sm opacity-60">Loading team members...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Message banner */}
      {message && (
        <div
          className={`mb-6 p-3 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          }`}
        >
          <p
            className="text-sm"
            style={{ color: message.type === 'success' ? '#4ade80' : '#f87171' }}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Header with invite button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm opacity-50" style={{ color: 'var(--analysis-text)' }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--analysis-primary, #3b82f6)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {showInvite ? 'Cancel' : 'Invite Member'}
          </button>
        )}
      </div>

      {/* Invite form modal-like section */}
      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="mb-8 p-6 rounded-xl border border-white/10 bg-white/[0.02] space-y-4"
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--analysis-text)' }}>
            Invite New Member
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Email *
              </label>
              <input
                type="email"
                required
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--analysis-primary, #3b82f6)' } as React.CSSProperties}
                placeholder="colleague@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Display Name *
              </label>
              <input
                type="text"
                required
                value={inviteForm.display_name}
                onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--analysis-primary, #3b82f6)' } as React.CSSProperties}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Role *
              </label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as IntelMemberRole })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--analysis-primary, #3b82f6)' } as React.CSSProperties}
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r} className="bg-gray-900">
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Title
              </label>
              <input
                type="text"
                value={inviteForm.title}
                onChange={(e) => setInviteForm({ ...inviteForm, title: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--analysis-primary, #3b82f6)' } as React.CSSProperties}
                placeholder="Senior Analyst"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Company
              </label>
              <input
                type="text"
                value={inviteForm.company}
                onChange={(e) => setInviteForm({ ...inviteForm, company: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--analysis-primary, #3b82f6)' } as React.CSSProperties}
                placeholder="Acme Corp"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 text-sm text-white font-medium rounded-lg transition-colors disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: 'var(--analysis-primary, #3b82f6)' }}
            >
              {inviting ? 'Sending Invite...' : 'Send Invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-white/10 hover:bg-white/[0.04] transition-colors"
              style={{ color: 'var(--analysis-text)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {members.map((m) => {
          const rc = roleColors[m.role] || roleColors.viewer;
          return (
            <div
              key={m.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              {/* Avatar initials */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--analysis-primary, #3b82f6)' }}
              >
                {getInitials(m.display_name)}
              </div>

              {/* Name & email */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--analysis-text)' }}>
                  {m.display_name}
                </div>
                {m.email && (
                  <div className="text-xs opacity-50 truncate" style={{ color: 'var(--analysis-text)' }}>
                    {m.email}
                  </div>
                )}
                {!m.email && (
                  <div className="text-xs opacity-30 truncate" style={{ color: 'var(--analysis-text)' }}>
                    {m.user_id.slice(0, 8)}...
                  </div>
                )}
              </div>

              {/* Title/Company on wider screens */}
              <div className="hidden md:block flex-shrink-0 w-40">
                <div className="text-xs opacity-50 truncate" style={{ color: 'var(--analysis-text)' }}>
                  {[m.title, m.company].filter(Boolean).join(' at ') || '\u2014'}
                </div>
              </div>

              {/* Role badge or dropdown */}
              <div className="flex-shrink-0">
                {editingRole === m.id ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as IntelMemberRole)}
                    onBlur={() => setEditingRole(null)}
                    autoFocus
                    className="px-2 py-1 bg-white/[0.06] border border-white/10 rounded text-xs text-white focus:outline-none"
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r} className="bg-gray-900">
                        {roleLabels[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => {
                      if (!isAdmin) return;
                      if (m.role === 'super_admin') return;
                      if (currentUserRole === 'admin' && m.role === 'admin') return;
                      setEditingRole(m.id);
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${rc.badge} ${
                      !isAdmin || m.role === 'super_admin' || (currentUserRole === 'admin' && m.role === 'admin')
                        ? 'cursor-default'
                        : 'cursor-pointer hover:opacity-80'
                    }`}
                  >
                    {roleLabels[m.role] || m.role}
                  </button>
                )}
              </div>

              {/* Joined date */}
              <div className="hidden sm:block flex-shrink-0 w-24 text-right">
                <span className="text-xs opacity-40" style={{ color: 'var(--analysis-text)' }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Remove button */}
              <div className="flex-shrink-0 w-16 text-right">
                {isAdmin && m.role !== 'super_admin' && (
                  <>
                    {confirmDelete === m.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 font-medium"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-[10px] opacity-50 hover:opacity-80"
                          style={{ color: 'var(--analysis-text)' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(m.id)}
                        className="text-xs text-red-400/50 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
            No team members found.
          </p>
        </div>
      )}
    </div>
  );
}
