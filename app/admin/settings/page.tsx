'use client'

import { useState, useEffect } from 'react'

interface FactSheet {
  id: string
  label: string
  file_url: string
  is_active: boolean
  uploaded_at: string
}

export default function SettingsPage() {
  const [factSheets, setFactSheets] = useState<FactSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => { fetchFactSheets() }, [])

  async function fetchFactSheets() {
    const res = await fetch('/api/admin/factsheets')
    const data = await res.json()
    setFactSheets(data)
    setLoading(false)
  }

  async function handleUpload() {
    if (!file || !label.trim()) return alert('Please provide a label and select a PDF file')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('label', label)

    const res = await fetch('/api/admin/upload/pdf', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    setUploading(false)

    if (res.ok) {
      setFactSheets(prev => [data, ...prev.map(f => ({ ...f, is_active: false }))])
      setLabel('')
      setFile(null)
      // Reset file input
      const input = document.getElementById('pdf-upload') as HTMLInputElement
      if (input) input.value = ''
    } else {
      alert(data.error || 'Upload failed')
    }
  }

  async function handleActivate(id: string) {
    const res = await fetch(`/api/admin/factsheets/${id}/activate`, { method: 'PATCH' })
    if (res.ok) {
      setFactSheets(prev => prev.map(f => ({ ...f, is_active: f.id === id })))
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a href="/admin" className="text-slate-400 text-sm hover:text-white mb-1 block">
            ← Dashboard
          </a>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Manage fact sheets and app settings</p>
        </div>

        {/* PDF Upload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-white font-semibold text-lg mb-4">📄 Fact Sheet PDF</h2>
          <p className="text-slate-400 text-sm mb-6">
            Upload a PDF fact sheet that participants can download from their micro-site.
            The active fact sheet is shown to all participants.
          </p>

          {/* Upload form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Label</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Hill Day 2026 — Final"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">PDF File</label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-1">PDF only, max 20MB</p>
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !label.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </div>
        </div>

        {/* Fact sheet list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-white font-medium mb-4">Uploaded Fact Sheets</h3>

          {loading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : factSheets.length === 0 ? (
            <p className="text-slate-500 text-sm">No fact sheets uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {factSheets.map(f => (
                <div key={f.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="text-white text-sm font-medium">{f.label}</p>
                      <p className="text-slate-500 text-xs">
                        {new Date(f.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.is_active ? (
                      <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full border border-green-500/20">
                        ✓ Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivate(f.id)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}