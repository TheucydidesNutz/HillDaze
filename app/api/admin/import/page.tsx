'use client'

import { useState, useEffect } from 'react'
import { Group } from '@/lib/types'

type Tab = 'csv' | 'ics'

interface CSVPreview {
  count: number
  preview: any[]
  columns: string[]
}

interface ICSPreview {
  count: number
  preview: any[]
}

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('csv')
  const [groups, setGroups] = useState<Group[]>([])

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<any>(null)

  // ICS state
  const [icsFile, setIcsFile] = useState<File | null>(null)
  const [icsPreview, setIcsPreview] = useState<ICSPreview | null>(null)
  const [icsLoading, setIcsLoading] = useState(false)
  const [icsResult, setIcsResult] = useState<any>(null)
  const [icsGroupId, setIcsGroupId] = useState('')
  const [icsEventType, setIcsEventType] = useState<'mandatory' | 'optional'>('optional')

  useEffect(() => {
    apiFetch('/api/admin/groups')
      .then(res => res.json())
      .then(setGroups)
  }, [])

  // ── CSV ──────────────────────────────────────────
  async function handleCSVPreview() {
    if (!csvFile) return
    setCsvLoading(true)
    setCsvResult(null)
    const formData = new FormData()
    formData.append('file', csvFile)
    formData.append('preview', 'true')
    const res = await apiFetch('/api/admin/import/csv', { method: 'POST', body: formData })
    const data = await res.json()
    setCsvLoading(false)
    if (res.ok) setCsvPreview(data)
    else alert(data.error || 'Failed to parse CSV')
  }

  async function handleCSVImport() {
    if (!csvFile) return
    if (!confirm(`Import ${csvPreview?.count} participants?`)) return
    setCsvLoading(true)
    const formData = new FormData()
    formData.append('file', csvFile)
    const res = await apiFetch('/api/admin/import/csv', { method: 'POST', body: formData })
    const data = await res.json()
    setCsvLoading(false)
    setCsvResult(data)
    setCsvPreview(null)
    setCsvFile(null)
  }

  // ── ICS ──────────────────────────────────────────
  async function handleICSPreview() {
    if (!icsFile) return
    setIcsLoading(true)
    setIcsResult(null)
    const formData = new FormData()
    formData.append('file', icsFile)
    formData.append('preview', 'true')
    const res = await apiFetch('/api/admin/import/ics', { method: 'POST', body: formData })
    const data = await res.json()
    setIcsLoading(false)
    if (res.ok) setIcsPreview(data)
    else alert(data.error || 'Failed to parse ICS file')
  }

  async function handleICSImport() {
    if (!icsFile) return
    if (!confirm(`Import ${icsPreview?.count} events?`)) return
    setIcsLoading(true)
    const formData = new FormData()
    formData.append('file', icsFile)
    formData.append('group_id', icsGroupId)
    formData.append('event_type', icsEventType)
    const res = await apiFetch('/api/admin/import/ics', { method: 'POST', body: formData })
    const data = await res.json()
    setIcsLoading(false)
    setIcsResult(data)
    setIcsPreview(null)
    setIcsFile(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <a href="/admin" className="text-slate-400 text-sm hover:text-white mb-1 block">← Dashboard</a>
          <h1 className="text-3xl font-bold text-white">Import</h1>
          <p className="text-slate-400 mt-1">Bulk import participants or calendar events</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setTab('csv')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${tab === 'csv' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            👥 CSV — Participants
          </button>
          <button
            onClick={() => setTab('ics')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${tab === 'ics' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            📅 ICS — Calendar Events
          </button>
        </div>

        {/* ── CSV TAB ── */}
        {tab === 'csv' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-white font-semibold text-lg mb-2">Import Participants from CSV</h2>
              <p className="text-slate-400 text-sm mb-5">
                Upload a CSV file with participant info. Existing participants matched by email will be updated.
              </p>

              {/* Template download */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-5">
                <p className="text-slate-300 text-sm font-medium mb-2">📋 Expected CSV columns:</p>
                <p className="text-slate-400 text-xs font-mono leading-relaxed">
                  name, company, title, phone, email, emergency_name, emergency_phone, emergency_email,
                  arrival_airline, arrival_flight_no, arrival_datetime, arrival_airport,
                  departure_airline, departure_flight_no, departure_datetime, departure_airport,
                  hotel_name, hotel_room, fun_diversions
                </p>
                <p className="text-slate-500 text-xs mt-2">Only "name" is required. All other columns are optional.</p>
                <button
                  onClick={() => {
                    const header = 'name,company,title,phone,email,emergency_name,emergency_phone,emergency_email,arrival_airline,arrival_flight_no,arrival_datetime,arrival_airport,departure_airline,departure_flight_no,departure_datetime,departure_airport,hotel_name,hotel_room,fun_diversions'
                    const example = 'Alice Johnson,Acme Corp,VP of Policy,+15550001234,alice@acme.com,Bob Johnson,+15550005678,bob@acme.com,United,UA1234,2026-05-12T14:30:00,DCA,United,UA5678,2026-05-14T16:00:00,DCA,The Hay-Adams,412,Enjoys hiking'
                    const blob = new Blob([header + '\n' + example], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'participants_template.csv'
                    a.click()
                  }}
                  className="mt-3 text-blue-400 hover:text-blue-300 text-xs underline"
                >
                  ↓ Download template CSV
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">CSV File</label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={e => { setCsvFile(e.target.files?.[0] || null); setCsvPreview(null); setCsvResult(null) }}
                    className="text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleCSVPreview}
                  disabled={!csvFile || csvLoading}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {csvLoading ? 'Parsing...' : 'Preview Import'}
                </button>
              </div>
            </div>

            {/* CSV Preview */}
            {csvPreview && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">
                    Preview — {csvPreview.count} participant{csvPreview.count !== 1 ? 's' : ''} found
                  </h3>
                  <button
                    onClick={handleCSVImport}
                    disabled={csvLoading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg text-sm transition-colors"
                  >
                    {csvLoading ? 'Importing...' : `Import All ${csvPreview.count}`}
                  </button>
                </div>
                <div className="space-y-2">
                  {csvPreview.preview.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{p.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{p.name}</p>
                        <p className="text-slate-400 text-xs">{[p.title, p.company].filter(Boolean).join(' · ')}</p>
                      </div>
                      {p.email && <span className="ml-auto text-slate-500 text-xs">{p.email}</span>}
                    </div>
                  ))}
                  {csvPreview.count > 5 && (
                    <p className="text-slate-500 text-sm text-center py-2">
                      ...and {csvPreview.count - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* CSV Result */}
            {csvResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3">✅ Import Complete</h3>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-400">{csvResult.created}</p>
                    <p className="text-slate-400 text-sm">Created</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-400">{csvResult.updated}</p>
                    <p className="text-slate-400 text-sm">Updated</p>
                  </div>
                  {csvResult.errors?.length > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-400">{csvResult.errors.length}</p>
                      <p className="text-slate-400 text-sm">Errors</p>
                    </div>
                  )}
                </div>
                {csvResult.errors?.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {csvResult.errors.map((e: string, i: number) => (
                      <p key={i} className="text-red-400 text-xs">{e}</p>
                    ))}
                  </div>
                )}
                <a href="/admin/participants" className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm">
                  View participants →
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── ICS TAB ── */}
        {tab === 'ics' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-white font-semibold text-lg mb-2">Import Events from Google Calendar</h2>
              <p className="text-slate-400 text-sm mb-5">
                Export your Google Calendar as an ICS file and upload it here.
              </p>

              {/* How to export instructions */}
              <div className="bg-slate-800/50 rounded-lg p-4 mb-5 space-y-2">
                <p className="text-slate-300 text-sm font-medium">📤 How to export from Google Calendar:</p>
                <ol className="text-slate-400 text-sm space-y-1 list-decimal list-inside">
                  <li>Go to <span className="text-blue-400">calendar.google.com</span></li>
                  <li>Click the ⚙️ gear icon → <strong className="text-slate-300">Settings</strong></li>
                  <li>Click <strong className="text-slate-300">Import & Export</strong> in the left sidebar</li>
                  <li>Click <strong className="text-slate-300">Export</strong> — downloads a .zip</li>
                  <li>Unzip it and upload the <strong className="text-slate-300">.ics</strong> file here</li>
                </ol>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">ICS File</label>
                  <input
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={e => { setIcsFile(e.target.files?.[0] || null); setIcsPreview(null); setIcsResult(null) }}
                    className="text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Assign to Group</label>
                  <select
                    value={icsGroupId}
                    onChange={e => setIcsGroupId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">👥 All Participants</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Event Type</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIcsEventType('mandatory')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${icsEventType === 'mandatory' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      🔴 Mandatory
                    </button>
                    <button
                      onClick={() => setIcsEventType('optional')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${icsEventType === 'optional' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      🔵 Optional
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleICSPreview}
                  disabled={!icsFile || icsLoading}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  {icsLoading ? 'Parsing...' : 'Preview Events'}
                </button>
              </div>
            </div>

            {/* ICS Preview */}
            {icsPreview && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">
                    Preview — {icsPreview.count} event{icsPreview.count !== 1 ? 's' : ''} found
                  </h3>
                  <button
                    onClick={handleICSImport}
                    disabled={icsLoading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg text-sm transition-colors"
                  >
                    {icsLoading ? 'Importing...' : `Import All ${icsPreview.count}`}
                  </button>
                </div>
                <div className="space-y-2">
                  {icsPreview.preview.map((e, i) => (
                    <div key={i} className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-white text-sm font-medium">{e.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {e.start ? new Date(e.start).toLocaleString() : 'No date'}
                        {e.location ? ` · 📍 ${e.location}` : ''}
                      </p>
                    </div>
                  ))}
                  {icsPreview.count > 5 && (
                    <p className="text-slate-500 text-sm text-center py-2">
                      ...and {icsPreview.count - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ICS Result */}
            {icsResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3">✅ Import Complete</h3>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-400">{icsResult.created}</p>
                    <p className="text-slate-400 text-sm">Events Created</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-400">{icsResult.assigned}</p>
                    <p className="text-slate-400 text-sm">Assignments Made</p>
                  </div>
                  {icsResult.errors?.length > 0 && (
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-400">{icsResult.errors.length}</p>
                      <p className="text-slate-400 text-sm">Errors</p>
                    </div>
                  )}
                </div>
                <a href="/admin/events" className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm">
                  View calendar →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}