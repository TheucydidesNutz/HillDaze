'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FolderInput, FolderOutput, Plus, X, ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface FocusedFolder {
  id: string;
  profile_id: string;
  org_id: string;
  folder_type: 'input' | 'output';
  name: string;
  description: string | null;
  item_count: number;
  created_at: string;
}

interface FolderItem {
  id: string;
  data_item_id: string | null;
  storage_path: string | null;
  created_at: string;
  data_item: {
    id: string;
    title: string;
    category: string;
    summary: string | null;
    source_name: string | null;
    item_date: string | null;
  } | null;
}

interface DataItem {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  source_name: string | null;
  item_date: string | null;
}

// ─── Page ───────────────────────────────────────────────────────────

export default function FocusedFoldersPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const profileId = params.profileId as string;

  // Org resolution
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  // Data
  const [folders, setFolders] = useState<FocusedFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded folder state
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [folderItems, setFolderItems] = useState<FolderItem[]>([]);
  const [folderItemsLoading, setFolderItemsLoading] = useState(false);

  // Create folder modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderType, setNewFolderType] = useState<'input' | 'output'>('input');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Data item picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFolderId, setPickerFolderId] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<DataItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // ── Fetch org ID ───────────────────────────────────────────────

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch('/api/intel/orgs', { cache: 'no-store' });
        if (!res.ok) return;
        const memberships = await res.json();
        const m = memberships.find((m: { org: { slug: string } }) => m.org.slug === orgSlug);
        if (m) setOrgId(m.org.id);
      } finally {
        setOrgLoading(false);
      }
    }
    fetchOrg();
  }, [orgSlug]);

  // ── Fetch folders ──────────────────────────────────────────────

  const fetchFolders = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis/focused-folders?profile_id=${profileId}&org_id=${orgId}`);
      if (!res.ok) throw new Error('Failed to load folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [orgId, profileId]);

  useEffect(() => {
    if (orgId) fetchFolders();
  }, [orgId, fetchFolders]);

  // ── Fetch folder items (when expanded) ─────────────────────────

  const fetchFolderItems = useCallback(async (folderId: string) => {
    setFolderItemsLoading(true);
    try {
      const res = await fetch(`/api/analysis/focused-folders/${folderId}`);
      if (!res.ok) throw new Error('Failed to load folder items');
      const data = await res.json();
      setFolderItems(data.items || []);
    } catch {
      setFolderItems([]);
    } finally {
      setFolderItemsLoading(false);
    }
  }, []);

  function toggleExpand(folderId: string) {
    if (expandedFolderId === folderId) {
      setExpandedFolderId(null);
      setFolderItems([]);
    } else {
      setExpandedFolderId(folderId);
      fetchFolderItems(folderId);
    }
  }

  // ── Create folder ──────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!orgId || !newFolderName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/analysis/focused-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          org_id: orgId,
          folder_type: newFolderType,
          name: newFolderName.trim(),
          description: newFolderDesc.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create folder');
      setShowCreateModal(false);
      setNewFolderName('');
      setNewFolderDesc('');
      fetchFolders();
    } catch {
      // stay on modal
    } finally {
      setCreating(false);
    }
  }

  // ── Delete folder ──────────────────────────────────────────────

  async function handleDeleteFolder(folderId: string) {
    if (!confirm('Delete this folder and all its items?')) return;
    try {
      await fetch(`/api/analysis/focused-folders/${folderId}`, { method: 'DELETE' });
      if (expandedFolderId === folderId) {
        setExpandedFolderId(null);
        setFolderItems([]);
      }
      fetchFolders();
    } catch {
      // silent
    }
  }

  // ── Data item picker ───────────────────────────────────────────

  async function openPicker(folderId: string) {
    setPickerFolderId(folderId);
    setShowPicker(true);
    setPickerSearch('');
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/analysis/data-items?profile_id=${profileId}&org_id=${orgId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(data.items || []);
      }
    } catch {
      setAvailableItems([]);
    } finally {
      setPickerLoading(false);
    }
  }

  async function addItemToFolder(dataItemId: string) {
    if (!pickerFolderId) return;
    setAddingItemId(dataItemId);
    try {
      const res = await fetch(`/api/analysis/focused-folders/${pickerFolderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_item_id: dataItemId }),
      });
      if (res.ok) {
        // Refresh folder items if this folder is expanded
        if (expandedFolderId === pickerFolderId) {
          fetchFolderItems(pickerFolderId);
        }
        // Refresh folder counts
        fetchFolders();
        setShowPicker(false);
      }
    } catch {
      // silent
    } finally {
      setAddingItemId(null);
    }
  }

  async function removeItemFromFolder(folderId: string, itemId: string) {
    try {
      await fetch(`/api/analysis/focused-folders/${folderId}/items?item_id=${itemId}`, { method: 'DELETE' });
      if (expandedFolderId === folderId) {
        fetchFolderItems(folderId);
      }
      fetchFolders();
    } catch {
      // silent
    }
  }

  // ── Computed ───────────────────────────────────────────────────

  const inputFolders = folders.filter(f => f.folder_type === 'input');
  const outputFolders = folders.filter(f => f.folder_type === 'output');

  const filteredPickerItems = pickerSearch
    ? availableItems.filter(i =>
        i.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (i.category && i.category.toLowerCase().includes(pickerSearch.toLowerCase()))
      )
    : availableItems;

  // ── Render ─────────────────────────────────────────────────────

  if (orgLoading) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-40" style={{ color: 'var(--analysis-text)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="text-sm opacity-60" style={{ color: 'var(--analysis-text)' }}>
        Organization not found.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--analysis-text)' }}>
            Focused Folders
          </h1>
          <p className="text-sm opacity-50 mt-1" style={{ color: 'var(--analysis-text)' }}>
            Organize data items into input and output collections for analysis
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--analysis-primary)' }}
        >
          <Plus size={16} />
          New Folder
        </button>
      </div>

      {/* Explanation card */}
      <div
        className="mb-8 p-4 rounded-xl border border-white/10 bg-white/[0.03]"
        style={{ color: 'var(--analysis-text)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <FolderInput size={20} className="shrink-0 mt-0.5 text-blue-400" />
            <div>
              <p className="text-sm font-medium">Input Folders</p>
              <p className="text-xs opacity-50 mt-0.5">
                Collections of source data items to feed into an analysis. Group related speeches, votes, filings, and documents that should be analyzed together.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FolderOutput size={20} className="shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium">Output Folders</p>
              <p className="text-xs opacity-50 mt-0.5">
                Collections of generated analysis results. Store completed reports, summaries, and findings produced from your input folder analyses.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm opacity-40"
          style={{ color: 'var(--analysis-text)' }}
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading folders...
        </div>
      )}

      {/* Empty state */}
      {!loading && folders.length === 0 && !error && (
        <div
          className="text-center py-16 border border-white/5 rounded-xl"
          style={{ color: 'var(--analysis-text)' }}
        >
          <FolderInput size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm opacity-40">No focused folders yet</p>
          <p className="text-xs opacity-25 mt-1">
            Create your first folder to start organizing data items for analysis
          </p>
        </div>
      )}

      {/* Two-column layout */}
      {!loading && folders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Folders */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FolderInput size={16} className="text-blue-400" />
              <h2 className="text-sm font-semibold opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Input Folders
              </h2>
              <span className="text-xs opacity-30" style={{ color: 'var(--analysis-text)' }}>
                ({inputFolders.length})
              </span>
            </div>
            {inputFolders.length === 0 ? (
              <div
                className="text-center py-8 border border-white/5 rounded-xl"
                style={{ color: 'var(--analysis-text)' }}
              >
                <p className="text-xs opacity-30">No input folders</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inputFolders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    isExpanded={expandedFolderId === folder.id}
                    folderItems={expandedFolderId === folder.id ? folderItems : []}
                    folderItemsLoading={expandedFolderId === folder.id && folderItemsLoading}
                    onToggle={() => toggleExpand(folder.id)}
                    onDelete={() => handleDeleteFolder(folder.id)}
                    onAddItem={() => openPicker(folder.id)}
                    onRemoveItem={(itemId) => removeItemFromFolder(folder.id, itemId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Output Folders */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FolderOutput size={16} className="text-emerald-400" />
              <h2 className="text-sm font-semibold opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Output Folders
              </h2>
              <span className="text-xs opacity-30" style={{ color: 'var(--analysis-text)' }}>
                ({outputFolders.length})
              </span>
            </div>
            {outputFolders.length === 0 ? (
              <div
                className="text-center py-8 border border-white/5 rounded-xl"
                style={{ color: 'var(--analysis-text)' }}
              >
                <p className="text-xs opacity-30">No output folders</p>
              </div>
            ) : (
              <div className="space-y-2">
                {outputFolders.map(folder => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    isExpanded={expandedFolderId === folder.id}
                    folderItems={expandedFolderId === folder.id ? folderItems : []}
                    folderItemsLoading={expandedFolderId === folder.id && folderItemsLoading}
                    onToggle={() => toggleExpand(folder.id)}
                    onDelete={() => handleDeleteFolder(folder.id)}
                    onAddItem={() => openPicker(folder.id)}
                    onRemoveItem={(itemId) => removeItemFromFolder(folder.id, itemId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Folder Modal ─────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md mx-4 rounded-xl border border-white/10 p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--analysis-bg, #111)', color: 'var(--analysis-text)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Focused Folder</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors opacity-50 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Type toggle */}
            <div className="mb-4">
              <label className="text-xs font-medium uppercase tracking-wider opacity-40 block mb-2">
                Folder Type
              </label>
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setNewFolderType('input')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    newFolderType === 'input' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <FolderInput size={16} />
                  Input
                </button>
                <button
                  onClick={() => setNewFolderType('output')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-l border-white/10 ${
                    newFolderType === 'output' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <FolderOutput size={16} />
                  Output
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="text-xs font-medium uppercase tracking-wider opacity-40 block mb-2">
                Name
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="e.g., Healthcare Votes 2025"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-30 focus:outline-none focus:ring-1 focus:border-transparent"
                style={{
                  color: 'var(--analysis-text)',
                  // @ts-expect-error CSS custom property
                  '--tw-ring-color': 'var(--analysis-primary)',
                }}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="text-xs font-medium uppercase tracking-wider opacity-40 block mb-2">
                Description
                <span className="opacity-50 normal-case tracking-normal ml-1">(optional)</span>
              </label>
              <textarea
                value={newFolderDesc}
                onChange={e => setNewFolderDesc(e.target.value)}
                placeholder="What is this folder for?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-30 focus:outline-none focus:ring-1 focus:border-transparent resize-none"
                style={{
                  color: 'var(--analysis-text)',
                  // @ts-expect-error CSS custom property
                  '--tw-ring-color': 'var(--analysis-primary)',
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creating}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: 'var(--analysis-primary)' }}
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Data Item Picker Modal ──────────────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-lg mx-4 rounded-xl border border-white/10 shadow-2xl flex flex-col"
            style={{
              backgroundColor: 'var(--analysis-bg, #111)',
              color: 'var(--analysis-text)',
              maxHeight: '80vh',
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h2 className="text-lg font-semibold">Add Data Item</h2>
              <button
                onClick={() => setShowPicker(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors opacity-50 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-white/5">
              <input
                type="text"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                placeholder="Search data items..."
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-30 focus:outline-none focus:ring-1 focus:border-transparent"
                style={{
                  color: 'var(--analysis-text)',
                  // @ts-expect-error CSS custom property
                  '--tw-ring-color': 'var(--analysis-primary)',
                }}
                autoFocus
              />
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto">
              {pickerLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm opacity-40">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading data items...
                </div>
              ) : filteredPickerItems.length === 0 ? (
                <div className="text-center py-12 text-sm opacity-30">
                  {pickerSearch ? 'No items match your search' : 'No data items available'}
                </div>
              ) : (
                <div>
                  {filteredPickerItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => addItemToFolder(item.id)}
                      disabled={addingItemId === item.id}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 border-b border-white/5 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
                    >
                      <FileText size={14} className="opacity-40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] opacity-60">
                            {item.category}
                          </span>
                          {item.item_date && (
                            <span className="text-[10px] opacity-40">
                              {new Date(item.item_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                          {item.source_name && (
                            <span className="text-[10px] opacity-30">{item.source_name}</span>
                          )}
                        </div>
                      </div>
                      {addingItemId === item.id ? (
                        <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--analysis-primary)' }} />
                      ) : (
                        <Plus size={14} className="opacity-30 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Folder Card Component ──────────────────────────────────────────

function FolderCard({
  folder,
  isExpanded,
  folderItems,
  folderItemsLoading,
  onToggle,
  onDelete,
  onAddItem,
  onRemoveItem,
}: {
  folder: FocusedFolder;
  isExpanded: boolean;
  folderItems: FolderItem[];
  folderItemsLoading: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const isInput = folder.folder_type === 'input';
  const FolderIcon = isInput ? FolderInput : FolderOutput;
  const accentColor = isInput ? 'text-blue-400' : 'text-emerald-400';

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden transition-colors hover:bg-white/[0.05]"
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        style={{ color: 'var(--analysis-text)' }}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 shrink-0 opacity-40" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 opacity-40" />
        )}
        <FolderIcon size={16} className={`shrink-0 ${accentColor}`} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{folder.name}</span>
          {folder.description && (
            <span className="text-xs opacity-40 truncate block mt-0.5">
              {folder.description}
            </span>
          )}
        </div>
        <span
          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-medium bg-white/[0.08]"
          style={{ color: 'var(--analysis-text)' }}
        >
          {folder.item_count}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="px-4 pb-4 border-t border-white/5"
          style={{ color: 'var(--analysis-text)' }}
        >
          {/* Actions bar */}
          <div className="flex items-center justify-between mt-3 mb-3">
            <button
              onClick={onAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <Plus size={12} />
              Add Data Item
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors"
            >
              <X size={12} />
              Delete Folder
            </button>
          </div>

          {/* Items list */}
          {folderItemsLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs opacity-40">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading items...
            </div>
          ) : folderItems.length === 0 ? (
            <div className="text-center py-6 text-xs opacity-30">
              No items in this folder yet
            </div>
          ) : (
            <div className="space-y-1">
              {folderItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors group"
                >
                  <FileText size={14} className="opacity-40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {item.data_item ? (
                      <>
                        <p className="text-sm truncate">{item.data_item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] opacity-60">
                            {item.data_item.category}
                          </span>
                          {item.data_item.item_date && (
                            <span className="text-[10px] opacity-40">
                              {new Date(item.data_item.item_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs opacity-40 truncate">
                        {item.storage_path || 'Unknown item'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1 rounded hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-60"
                    title="Remove from folder"
                  >
                    <X size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
