'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/events/types'
import TripHeader from '@/components/TripHeader'
import {
  FileText,
  FolderOpen,
  Map,
  Globe,
  Users,
  CheckCircle,
  Image,
} from 'lucide-react'

interface FactSheet {
  id: string
  label: string
  file_url: string
  is_active: boolean
  uploaded_at: string
}

interface Document {
  id: string
  label: string
  file_url: string
  file_type: string
  doc_type: string
  group_id: string | null
  uploaded_at: string
  group?: { id: string; name: string } | null
}

interface Group {
  id: string
  name: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [factSheets, setFactSheets] = useState<FactSheet[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const [fsUploading, setFsUploading] = useState(false)
  const [fsLabel, setFsLabel] = useState('')
  const [fsFile, setFsFile] = useState<File | null>(null)

  const [docUploading, setDocUploading] = useState(false)
  const [docLabel, setDocLabel] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docGroupId, setDocGroupId] = useState('')
  const [docType, setDocType] = useState<'document' | 'map'>('document')

  // Trip Photos state
  const [photoCount, setPhotoCount] = useState<number | null>(null)
  const [photosLoading, setPhotosLoading] = useState(true)
  const [downloadingZip, setDownloadingZip] = useState(false)

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/events/admin/trips'); return }
    setTrip(JSON.parse(tripStr))
    fetchAll()
    fetchPhotoCount()
  }, [])

  async function fetchAll() {
    const [fsRes, docsRes, gRes] = await Promise.all([
      apiFetch('/api/events/admin/factsheets'),
      apiFetch('/api/events/admin/documents'),
      apiFetch('/api/events/admin/groups'),
    ])
    const [fsData, docsData, gData] = await Promise.all([
      fsRes.json(), docsRes.json(), gRes.json()
    ])
    setFactSheets(fsData)
    setDocuments(docsData)
    setGroups(gData)
    setLoading(false)
  }

  async function fetchPhotoCount() {
    setPhotosLoading(true)
    try {
      const res = await apiFetch('/api/events/admin/photos')
      if (res.ok) {
        const data = await res.json()
        setPhotoCount(data.count || 0)
      } else {
        setPhotoCount(0)
      }
    } catch {
      setPhotoCount(0)
    }
    setPhotosLoading(false)
  }

  async function handleDownloadZip() {
    setDownloadingZip(true)
    try {
      const res = await apiFetch('/api/events/admin/photos/zip')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.error || 'Download failed')
        setDownloadingZip(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^"]+)"?/)
      a.download = match ? match[1] : 'trip-photos.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed. Please try again.')
    }
    setDownloadingZip(false)
  }

  async function handleFsUpload() {
    if (!fsFile || !fsLabel.trim()) return alert('Please provide a label and PDF')
    setFsUploading(true)
    const formData = new FormData()
    formData.append('file', fsFile)
    formData.append('label', fsLabel)
    const res = await apiFetch('/api/events/admin/upload/pdf', { method: 'POST', body: formData })
    const data = await res.json()
    setFsUploading(false)
    if (res.ok) {
      setFactSheets(prev => [data, ...prev.map(f => ({ ...f, is_active: false }))])
      setFsLabel('')
      setFsFile(null)
    } else alert(data.error || 'Upload failed')
  }

  async function handleActivate(id: string) {
    const res = await apiFetch(`/api/events/admin/factsheets/${id}/activate`, { method: 'PATCH' })
    if (res.ok) setFactSheets(prev => prev.map(f => ({ ...f, is_active: f.id === id })))
  }

  async function handleDeleteFactSheet(id: string) {
    if (!confirm('Delete this fact sheet?')) return
    await apiFetch(`/api/events/admin/factsheets?id=${id}`, { method: 'DELETE' })
    setFactSheets(prev => prev.filter(f => f.id !== id))
  }

  async function handleDocUpload() {
    if (!docFile || !docLabel.trim()) return alert('Please provide a label and file')
    setDocUploading(true)
    const formData = new FormData()
    formData.append('file', docFile)
    formData.append('label', docLabel)
    formData.append('doc_type', docType)
    formData.append('group_id', docGroupId)
    const res = await apiFetch('/api/events/admin/upload/document', { method: 'POST', body: formData })
    const data = await res.json()
    setDocUploading(false)
    if (res.ok) {
      const group = groups.find(g => g.id === docGroupId) || null
      setDocuments(prev => [{ ...data, group: group ? { id: group.id, name: group.name } : null }, ...prev])
      setDocLabel('')
      setDocFile(null)
      setDocGroupId('')
    } else alert(data.error || 'Upload failed')
  }

  async function handleDeleteDoc(id: string) {
    if (!confirm('Delete this document?')) return
    await apiFetch(`/api/events/admin/documents?id=${id}`, { method: 'DELETE' })
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  const maps = documents.filter(d => d.doc_type === 'map')
  const docs = documents.filter(d => d.doc_type === 'document')

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {trip && (
          <TripHeader
            trip={trip}
            pageTitle="File Management"
            pageSubtitle="Manage documents, maps, and fact sheets"
          />
        )}

        {/* ── FACT SHEET ─────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Fact Sheet PDF
          </h2>
          <p className="text-slate-400 text-sm mb-5">The active fact sheet appears as a download button on every attendee micro-site.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Label</label>
              <input type="text" value={fsLabel} onChange={e => setFsLabel(e.target.value)}
                placeholder="e.g. Hill Day 2026 — Final"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">PDF File</label>
              <input id="fs-upload" type="file" accept="application/pdf"
                onChange={e => setFsFile(e.target.files?.[0] || null)}
                className="text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer" />
              <p className="text-xs text-slate-500 mt-1">PDF only, max 20MB</p>
            </div>
            <button onClick={handleFsUpload} disabled={fsUploading || !fsFile || !fsLabel.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg text-sm transition-colors">
              {fsUploading ? 'Uploading...' : 'Upload Fact Sheet'}
            </button>
          </div>

          {factSheets.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-slate-400 text-sm font-medium">Uploaded Fact Sheets</p>
              {factSheets.map(f => (
                <div key={f.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{f.label}</p>
                      <p className="text-slate-500 text-xs">{new Date(f.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.is_active ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full border border-green-500/20">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <button onClick={() => handleActivate(f.id)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors">
                        Set Active
                      </button>
                    )}
                    <button onClick={() => handleDeleteFactSheet(f.id)}
                      className="text-slate-500 hover:text-red-400 text-xs transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── DOCUMENTS & MAP UPLOAD ──────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-1 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-orange-400" />
            Documents & Maps
          </h2>
          <p className="text-slate-400 text-sm mb-5">Upload PDFs or images. Documents appear in the attendee's "Your Documents" section. Maps appear via the Map button in the header.</p>

          <div className="flex gap-3 mb-5">
            <button onClick={() => setDocType('document')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${docType === 'document' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              <FolderOpen className="w-4 h-4" />
              Document
            </button>
            <button onClick={() => setDocType('map')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${docType === 'map' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              <Map className="w-4 h-4" />
              Map
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Label</label>
              <input type="text" value={docLabel} onChange={e => setDocLabel(e.target.value)}
                placeholder={docType === 'map' ? 'e.g. Capitol Building Map' : 'e.g. Meeting Agenda'}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>

            {docType === 'document' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Visible To</label>
                <select value={docGroupId} onChange={e => setDocGroupId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="">All Groups</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} only</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">File</label>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={e => setDocFile(e.target.files?.[0] || null)}
                className="text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer" />
              <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG or WebP — max 20MB</p>
            </div>

            <button onClick={handleDocUpload} disabled={docUploading || !docFile || !docLabel.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg text-sm transition-colors">
              {docUploading ? 'Uploading...' : `Upload ${docType === 'map' ? 'Map' : 'Document'}`}
            </button>
          </div>

          {maps.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <Map className="w-3.5 h-3.5 text-slate-500" />
                Maps
              </p>
              {maps.map(d => (
                <div key={d.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Map className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{d.label}</p>
                      <p className="text-slate-500 text-xs">{new Date(d.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteDoc(d.id)}
                    className="text-slate-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                </div>
              ))}
            </div>
          )}

          {docs.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                Documents
              </p>
              {docs.map(d => (
                <div key={d.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      {d.file_type === 'pdf'
                        ? <FileText className="w-4 h-4 text-orange-400" />
                        : <Image className="w-4 h-4 text-orange-400" />
                      }
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{d.label}</p>
                      <p className="text-slate-500 text-xs flex items-center gap-1">
                        {d.group
                          ? <><Users className="w-3 h-3" /> {d.group.name} only</>
                          : <><Globe className="w-3 h-3" /> All groups</>
                        }
                        {' · '}{new Date(d.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteDoc(d.id)}
                    className="text-slate-500 hover:text-red-400 text-xs transition-colors">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TRIP PHOTOS ──────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-white font-semibold text-lg mb-1 flex items-center gap-2">
            <Image className="w-4 h-4 text-pink-400" />
            Trip Photos
          </h2>
          <p className="text-slate-400 text-sm mb-5">Photos uploaded by participants from their microsites.</p>

          {photosLoading ? (
            <div className="text-slate-500 text-sm">Loading photo count...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                  <Image className="w-5 h-5 text-pink-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    {photoCount === 0
                      ? 'No photos uploaded yet'
                      : `${photoCount} photo${photoCount !== 1 ? 's' : ''} uploaded`
                    }
                  </p>
                  <p className="text-slate-500 text-xs">
                    {photoCount === 0
                      ? 'Photos will appear here when participants upload them'
                      : 'Uploaded by participants from their microsites'
                    }
                  </p>
                </div>
              </div>

              {photoCount !== null && photoCount > 0 && (
                <button
                  onClick={handleDownloadZip}
                  disabled={downloadingZip}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {downloadingZip ? (
                    <>
                      Preparing download...
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-4 h-4" />
                      Download All Photos (zip)
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}