'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

interface Props {
  orgSlug: string;
  orgId: string;
  workspaceSlug: string;
  workspaceName: string;
  workspaceDescription: string;
  memberRole: string;
}

export default function SettingsView({
  orgSlug,
  orgId,
  workspaceSlug,
  workspaceName: initialName,
  workspaceDescription: initialDesc,
  memberRole,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const isAdmin = ['super_admin', 'admin'].includes(memberRole);

  const loadApiKeys = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceSlug}/api-keys?org_id=${orgId}`);
    if (res.ok) {
      const data = await res.json();
      setApiKeys(data.api_keys || []);
    }
  }, [workspaceSlug, orgId]);

  useEffect(() => { loadApiKeys(); }, [loadApiKeys]);

  async function saveSettings() {
    setSaving(true);
    await fetch(`/api/workspaces/${workspaceSlug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, name, description }),
    });
    setSaving(false);
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return;
    const res = await fetch(`/api/workspaces/${workspaceSlug}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, name: newKeyName }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.key);
      setNewKeyName('');
      loadApiKeys();
    }
  }

  async function revokeApiKey(keyId: string) {
    await fetch(`/api/workspaces/${workspaceSlug}/api-keys/${keyId}?org_id=${orgId}`, {
      method: 'DELETE',
    });
    loadApiKeys();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--analysis-text)' }}>Settings</h1>

      {/* General */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3 opacity-60" style={{ color: 'var(--analysis-text)' }}>General</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs opacity-50 block mb-1" style={{ color: 'var(--analysis-text)' }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ color: 'var(--analysis-text)' }}
            />
          </div>
          <div>
            <label className="text-xs opacity-50 block mb-1" style={{ color: 'var(--analysis-text)' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
              style={{ color: 'var(--analysis-text)' }}
            />
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: 'var(--analysis-primary)' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </section>

      {/* API Keys */}
      {isAdmin && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 opacity-60" style={{ color: 'var(--analysis-text)' }}>
            API Keys (ButterRobot)
          </h2>

          {newKey && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-3">
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--analysis-text)' }}>
                Copy this key now — it won&apos;t be shown again:
              </p>
              <code className="text-xs break-all" style={{ color: 'var(--analysis-text)' }}>{newKey}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(newKey); setNewKey(null); }}
                className="mt-2 px-2 py-1 rounded text-xs border border-white/10 hover:bg-white/[0.05]"
                style={{ color: 'var(--analysis-text)' }}
              >
                Copy & Dismiss
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., ButterRobot)"
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ color: 'var(--analysis-text)' }}
            />
            <button
              onClick={createApiKey}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--analysis-primary)' }}
            >
              Create Key
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <p className="text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>No API keys</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10">
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--analysis-text)' }}>{key.name}</span>
                    <span className="text-xs opacity-40 ml-2" style={{ color: 'var(--analysis-text)' }}>
                      {key.key_prefix}...
                    </span>
                    {key.last_used_at && (
                      <span className="text-xs opacity-30 ml-2" style={{ color: 'var(--analysis-text)' }}>
                        Last used {new Date(key.last_used_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => revokeApiKey(key.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Danger Zone */}
      {isAdmin && (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-red-400">Danger Zone</h2>
          <div className="p-4 rounded-lg border border-red-500/20">
            <p className="text-sm opacity-60 mb-3" style={{ color: 'var(--analysis-text)' }}>
              Deleting a workspace removes all documents, conversations, reports, and research items permanently.
            </p>
            <button
              onClick={() => {
                if (confirm(`Delete workspace "${initialName}"? This cannot be undone.`)) {
                  fetch(`/api/workspaces/${workspaceSlug}?org_id=${orgId}`, { method: 'DELETE' })
                    .then(() => { window.location.href = `/analysis/${orgSlug}/w`; });
                }
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10"
            >
              Delete Workspace
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
