'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Palette, Folder, ChevronRight, ChevronDown, FolderPlus, MoreHorizontal, ArrowRight, Lock } from 'lucide-react';
import DocumentSummaryCard from './DocumentSummaryCard';
import { UploadFilePicker, useUploadManager } from './UploadManager';
import type { IntelDocument, IntelMemberRole } from '@/lib/intel/types';

interface DocFolder {
  id: string;
  org_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  folder_type: string;
  description: string | null;
  sort_order: number;
  doc_count: number;
}

interface FolderTreeNode extends DocFolder {
  children: FolderTreeNode[];
}

function buildTree(folders: DocFolder[]): FolderTreeNode[] {
  const map = new Map<string | null, DocFolder[]>();
  for (const f of folders) {
    const key = f.parent_id || '__root__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  function getChildren(parentId: string | null): FolderTreeNode[] {
    const items = map.get(parentId || '__root__') || [];
    return items.map(f => ({ ...f, children: getChildren(f.id) }));
  }
  return getChildren(null);
}

function getFolderIcon(folderType: string, size: number) {
  if (folderType === 'deep_dive') return <BookOpen size={size} />;
  if (folderType === 'reference') return <Palette size={size} />;
  return <Folder size={size} />;
}

function getBreadcrumb(folders: DocFolder[], folderId: string): DocFolder[] {
  const path: DocFolder[] = [];
  let current = folders.find(f => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
  }
  return path;
}

export default function DocumentList({
  orgId,
  userRole,
}: {
  orgId: string;
  userRole: IntelMemberRole;
}) {
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<IntelDocument[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [movingDocId, setMovingDocId] = useState<string | null>(null);

  const canUpload = userRole !== 'viewer';
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';
  const { onUploadComplete } = useUploadManager();

  // Auto-refresh when background uploads complete
  useEffect(() => {
    return onUploadComplete(() => {
      fetchDocs();
      fetchFolders();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUploadComplete, selectedFolderId, orgId]);

  const fetchFolders = useCallback(async () => {
    const res = await fetch(`/api/intel/document-folders?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setFolders(data);
      // Auto-select first folder if none selected
      setSelectedFolderId(prev => {
        if (!prev && data.length > 0) return data[0].id;
        return prev;
      });
      // Auto-expand root folders on first load
      setExpandedFolders(prev => {
        if (prev.size > 0) return prev;
        const roots = data.filter((f: DocFolder) => !f.parent_id).map((f: DocFolder) => f.id);
        return new Set(roots);
      });
    }
    setLoadingFolders(false);
  }, [orgId]);

  const fetchDocs = useCallback(async () => {
    if (!selectedFolderId) return;
    setLoadingDocs(true);
    const url = `/api/intel/documents?orgId=${orgId}&folderId=${selectedFolderId}`;
    console.log('[DocumentList] fetching docs:', url);
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      console.log('[DocumentList] docs response:', data.length, 'documents', data.map((d: { id: string; filename: string; folder_id: string }) => ({ id: d.id, filename: d.filename, folder_id: d.folder_id })));
      setDocuments(data);
    } else {
      console.error('[DocumentList] docs fetch failed:', res.status, await res.text().catch(() => ''));
    }
    setLoadingDocs(false);
  }, [orgId, selectedFolderId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);
  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const breadcrumb = selectedFolderId ? getBreadcrumb(folders, selectedFolderId) : [];
  const tree = buildTree(folders);

  function toggleExpand(folderId: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    if (!newFolderParent) return; // Must have a parent
    const res = await fetch('/api/intel/document-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: orgId,
        name: newFolderName.trim(),
        parent_id: newFolderParent,
        description: newFolderDesc.trim() || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setFolders(prev => [...prev, { ...created, doc_count: 0 }]);
      if (newFolderParent) setExpandedFolders(prev => new Set([...prev, newFolderParent!]));
      setShowNewFolder(false);
      setNewFolderName('');
      setNewFolderParent(null);
      setNewFolderDesc('');
      setSelectedFolderId(created.id);
    }
  }

  async function handleRename(folderId: string) {
    if (!renameValue.trim()) return;
    const res = await fetch(`/api/intel/document-folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, ...updated } : f));
    }
    setRenamingId(null);
  }

  async function handleDeleteFolder(folderId: string) {
    const res = await fetch(`/api/intel/document-folders/${folderId}`, { method: 'DELETE' });
    if (res.ok) {
      setFolders(prev => prev.filter(f => f.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId(folders.find(f => f.id !== folderId)?.id || null);
      }
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Cannot delete folder');
    }
    setFolderMenuId(null);
  }

  async function handleDeleteDoc(docId: string) {
    const res = await fetch(`/api/intel/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setFolders(prev => prev.map(f =>
        f.id === selectedFolderId ? { ...f, doc_count: Math.max(0, f.doc_count - 1) } : f
      ));
    }
  }

  async function handleMoveDoc(docId: string, targetFolderId: string) {
    const res = await fetch(`/api/intel/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: targetFolderId }),
    });
    if (res.ok) {
      setDocuments(prev => prev.filter(d => d.id !== docId));
      fetchFolders(); // Refresh counts
    }
    setMovingDocId(null);
  }

  // Determine the effective folder type for uploads
  const uploadFolderType = selectedFolder?.folder_type === 'reference' ? 'reference' as const : 'deep_dive' as const;

  if (loadingFolders) {
    return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;
  }

  return (
    <div className="flex gap-0 -mx-4 lg:-mx-8" style={{ minHeight: 'calc(100vh - 14rem)' }}>
      {/* Left panel: folder tree */}
      <div className="w-[260px] shrink-0 border-r border-white/10 px-3 py-2 overflow-y-auto">
        {tree.map(folder => (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            depth={0}
            selectedId={selectedFolderId}
            expandedSet={expandedFolders}
            onSelect={setSelectedFolderId}
            onToggleExpand={toggleExpand}
            menuId={folderMenuId}
            onMenuToggle={id => setFolderMenuId(folderMenuId === id ? null : id)}
            renamingId={renamingId}
            renameValue={renameValue}
            onStartRename={(id, name) => { setRenamingId(id); setRenameValue(name); setFolderMenuId(null); }}
            onRenameChange={setRenameValue}
            onRenameSubmit={handleRename}
            onRenameCancel={() => setRenamingId(null)}
            onDelete={handleDeleteFolder}
            onNewSubfolder={(parentId) => { setNewFolderParent(parentId); setShowNewFolder(true); setFolderMenuId(null); }}
            isAdmin={isAdmin}
          />
        ))}

        {/* New folder button */}
        <button
          onClick={() => {
            // Default parent to the currently selected folder, or first root folder
            const defaultParent = selectedFolderId || (folders.find(f => !f.parent_id)?.id ?? null);
            setNewFolderParent(defaultParent);
            setShowNewFolder(true);
          }}
          className="flex items-center gap-2 w-full px-3 py-2 mt-2 text-xs rounded-lg hover:bg-white/[0.05] opacity-50 hover:opacity-80"
          style={{ color: 'var(--intel-text)' }}
        >
          <FolderPlus size={14} /> New Folder
        </button>
      </div>

      {/* Right panel: folder contents */}
      <div className="flex-1 px-4 lg:px-8 py-2 overflow-y-auto">
        {selectedFolder ? (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 mb-3 text-xs opacity-50 flex-wrap" style={{ color: 'var(--intel-text)' }}>
              <span>Documents</span>
              {breadcrumb.map(f => (
                <span key={f.id} className="flex items-center gap-1.5">
                  <ChevronRight size={12} />
                  <button onClick={() => setSelectedFolderId(f.id)} className="hover:opacity-100">{f.name}</button>
                </span>
              ))}
            </div>

            {/* Folder header */}
            <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {getFolderIcon(selectedFolder.folder_type, 20)}
                <h2 className="text-lg font-semibold" style={{ color: 'var(--intel-text)' }}>{selectedFolder.name}</h2>
                {selectedFolder.folder_type === 'reference' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Reference only</span>
                )}
              </div>
              {canUpload && (
                <button
                  onClick={() => setShowUploader(true)}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                  style={{ backgroundColor: 'var(--intel-primary)' }}
                >
                  Upload Documents
                </button>
              )}
            </div>

            {/* Folder description */}
            {selectedFolder.description && (
              <p className="text-sm italic opacity-60 mb-4" style={{ color: 'var(--intel-text)' }}>
                {selectedFolder.description}
              </p>
            )}

            {/* Documents */}
            {loadingDocs ? (
              <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
                No documents in this folder yet. Upload documents or move files here.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="relative">
                    <DocumentSummaryCard
                      document={doc}
                      userRole={userRole}
                      onDelete={handleDeleteDoc}
                      expanded={expandedId === doc.id}
                      onToggle={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                    />
                    {/* Move button */}
                    {canUpload && (
                      <button
                        onClick={() => setMovingDocId(doc.id)}
                        className="absolute top-4 right-16 p-1 rounded opacity-0 hover:opacity-100 group-hover:opacity-40 hover:bg-white/[0.06]"
                        style={{ color: 'var(--intel-text)' }}
                        title="Move to folder..."
                      >
                        <ArrowRight size={14} className="opacity-40 hover:opacity-100" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>
            Select a folder from the left to view documents.
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUploader && selectedFolderId && (
        <UploadFilePicker
          orgId={orgId}
          folder={uploadFolderType}
          folderId={selectedFolderId}
          onClose={() => setShowUploader(false)}
        />
      )}

      {/* New folder dialog */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNewFolder(false)}>
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-sm p-6 rounded-xl border border-white/10 space-y-4"
            style={{ backgroundColor: 'var(--intel-bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--intel-text)' }}>New Folder</h3>
            <div>
              <label className="block text-xs opacity-60 mb-1" style={{ color: 'var(--intel-text)' }}>Name *</label>
              <input
                required
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
                placeholder="Folder name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs opacity-60 mb-1" style={{ color: 'var(--intel-text)' }}>Parent folder *</label>
              <select
                required
                value={newFolderParent || ''}
                onChange={e => setNewFolderParent(e.target.value || null)}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
              >
                <option value="" disabled>Select a parent folder</option>
                {folders.map(f => {
                  const depth = f.parent_id ? (folders.find(p => p.id === f.parent_id)?.parent_id ? 2 : 1) : 0;
                  const indent = '\u00A0\u00A0'.repeat(depth);
                  return (
                    <option key={f.id} value={f.id}>
                      {indent}{f.name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs opacity-60 mb-1" style={{ color: 'var(--intel-text)' }}>Description (optional)</label>
              <input
                value={newFolderDesc}
                onChange={e => setNewFolderDesc(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--intel-primary)]"
                placeholder="Brief description"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Create</button>
              <button type="button" onClick={() => setShowNewFolder(false)} className="px-4 py-2 text-sm rounded-lg border border-white/10" style={{ color: 'var(--intel-text)' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Move document modal */}
      {movingDocId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setMovingDocId(null)}>
          <div
            className="w-full max-w-sm max-h-[60vh] rounded-xl border border-white/10 overflow-hidden flex flex-col"
            style={{ backgroundColor: 'var(--intel-bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--intel-text)' }}>Move to folder</span>
              <button onClick={() => setMovingDocId(null)} className="text-white/40 hover:text-white/80">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {folders
                .filter(f => f.id !== selectedFolderId)
                .map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleMoveDoc(movingDocId, f.id)}
                    className="w-full px-4 py-3 text-left hover:bg-white/[0.05] border-b border-white/5 flex items-center gap-2"
                  >
                    {getFolderIcon(f.folder_type, 14)}
                    <span className="text-sm" style={{ color: 'var(--intel-text)' }}>
                      {f.parent_id ? '\u2514 ' : ''}{f.name}
                    </span>
                    <span className="text-[10px] opacity-30 ml-auto" style={{ color: 'var(--intel-text)' }}>{f.doc_count} docs</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Folder tree item (recursive) ────────────────────────────── */
function FolderTreeItem({
  folder,
  depth,
  selectedId,
  expandedSet,
  onSelect,
  onToggleExpand,
  menuId,
  onMenuToggle,
  renamingId,
  renameValue,
  onStartRename,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  onNewSubfolder,
  isAdmin,
}: {
  folder: FolderTreeNode;
  depth: number;
  selectedId: string | null;
  expandedSet: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  menuId: string | null;
  onMenuToggle: (id: string) => void;
  renamingId: string | null;
  renameValue: string;
  onStartRename: (id: string, name: string) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
  onDelete: (id: string) => void;
  onNewSubfolder: (parentId: string) => void;
  isAdmin: boolean;
}) {
  const isSelected = selectedId === folder.id;
  const isExpanded = expandedSet.has(folder.id);
  const hasChildren = folder.children.length > 0;
  const isRootDefault = !folder.parent_id;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-colors relative ${
          isSelected ? 'bg-white/10' : 'hover:bg-white/[0.04]'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); onToggleExpand(folder.id); }}
          className="w-4 h-4 flex items-center justify-center shrink-0"
          style={{ color: 'var(--intel-text)', visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Folder icon + name */}
        <button
          onClick={() => onSelect(folder.id)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
          style={{ color: isSelected ? 'var(--intel-primary)' : 'var(--intel-text)' }}
        >
          <span className="shrink-0 opacity-60">{getFolderIcon(folder.folder_type, 14)}</span>
          {renamingId === folder.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              onBlur={() => onRenameSubmit(folder.id)}
              onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(folder.id); if (e.key === 'Escape') onRenameCancel(); }}
              className="text-xs bg-white/[0.06] border border-white/10 rounded px-1 py-0.5 text-white w-full"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className={`text-xs truncate ${isRootDefault ? 'font-medium' : ''}`}>{folder.name}</span>
          )}
        </button>

        {/* Lock icon for root defaults */}
        {isRootDefault && (
          <Lock size={10} className="shrink-0 opacity-20" style={{ color: 'var(--intel-text)' }} />
        )}

        {/* Doc count */}
        <span className="text-[10px] opacity-30 shrink-0" style={{ color: 'var(--intel-text)' }}>
          {folder.doc_count || ''}
        </span>

        {/* Context menu trigger — root defaults only get "New Subfolder" */}
        {isAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onMenuToggle(folder.id); }}
            className="opacity-0 group-hover:opacity-40 hover:!opacity-100 shrink-0"
            style={{ color: 'var(--intel-text)' }}
          >
            <MoreHorizontal size={14} />
          </button>
        )}

        {/* Context menu */}
        {menuId === folder.id && (
          <div
            className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-white/10 shadow-xl z-50 py-1 text-xs"
            style={{ backgroundColor: 'var(--intel-bg)' }}
          >
            {!isRootDefault && (
              <button onClick={() => onStartRename(folder.id, folder.name)} className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>Rename</button>
            )}
            <button onClick={() => onNewSubfolder(folder.id)} className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>New Subfolder</button>
            {!isRootDefault && (
              <button onClick={() => onDelete(folder.id)} className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-white/[0.06]">Delete</button>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && folder.children.map(child => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          selectedId={selectedId}
          expandedSet={expandedSet}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          menuId={menuId}
          onMenuToggle={onMenuToggle}
          renamingId={renamingId}
          renameValue={renameValue}
          onStartRename={onStartRename}
          onRenameChange={onRenameChange}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
          onDelete={onDelete}
          onNewSubfolder={onNewSubfolder}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
