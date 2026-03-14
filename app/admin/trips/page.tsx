'use client'

import { useState, useEffect } from 'react'
import { Trip } from '@/lib/types'
import { useRouter } from 'next/navigation'

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => { fetchTrips() }, [])

  async function fetchTrips() {
    const res = await apiFetch('/api/admin/trips')
    const data = await res.json()
    setTrips(data)
    setLoading(false)
  }

  async function handleCreate() {
    if (!newTitle.trim()) return alert('Title required')
    setCreating(true)
    const res = await apiFetch('/api/admin/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, start_date: newStart, end_date: newEnd }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setTrips(prev => [...prev, data])
      setShowNew(false)
      setNewTitle('')
      setNewStart('')
      setNewEnd('')
    } else alert(data.error)
  }

  async function handleSaveEdit() {
    if (!editingTrip || !editTitle.trim()) return
    setSaving(true)
    const res = await fetch(`/api/admin/trips/${editingTrip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        start_date: editStart || null,
        end_date: editEnd || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setTrips(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t))
      setEditingTrip(null)
    } else alert(data.error)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this trip and ALL its data? This cannot be undone.')) return
    await fetch(`/api/admin/trips/${id}`, { method: 'DELETE' })
    setTrips(prev => prev.filter(t => t.id !== id))
  }

  function formatDateRange(trip: Trip) {
    if (!trip.start_date) return null
    const start = new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white">HillDayTracker</h1>
            <p className="text-slate-400 mt-1">Select a Trip to manage</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors">
            + New Trip
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-20">Loading...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg mb-4">No trips yet</p>
            <button onClick={() => setShowNew(true)} className="text-blue-400 hover:text-blue-300">
              Create your first trip →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trips.map(trip => (
              <div key={trip.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-colors">
                <div className="flex items-start gap-4 mb-4">
                  {trip.logo_url ? (
                    <img src={trip.logo_url} alt={trip.title} className="w-14 h-14 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-2xl font-bold">{trip.title.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-white font-semibold text-xl truncate">{trip.title}</h2>
                    {formatDateRange(trip) && (
                      <p className="text-slate-400 text-sm mt-0.5">{formatDateRange(trip)}</p>
                    )}
                    <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      trip.role === 'super'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}>
                      {trip.role === 'super' ? '⭐ Super Admin' : '👤 Admin'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('current_trip', JSON.stringify(trip))
                      router.push('/admin')
                    }}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
                    Open →
                  </button>
                  <button
                    onClick={() => {
                      setEditingTrip(trip)
                      setEditTitle(trip.title)
                      setEditStart(trip.start_date || '')
                      setEditEnd(trip.end_date || '')
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors">
                    Edit
                  </button>
                  {trip.role === 'super' && (
                    <button onClick={() => handleDelete(trip.id)}
                      className="px-4 py-2 bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 text-sm font-medium rounded-lg transition-colors">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Trip Modal */}
        {showNew && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white font-semibold text-lg">Create New Trip</h2>
                <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Trip Title *</label>
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. ACME Corp Hill Day 2026"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                    <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                    <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button onClick={() => setShowNew(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                <button onClick={handleCreate} disabled={creating || !newTitle.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg text-sm transition-colors">
                  {creating ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Trip Modal */}
        {editingTrip && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white font-semibold text-lg">Edit Trip</h2>
                <button onClick={() => setEditingTrip(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Trip Title *</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                    <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                    <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Logo</label>
                  <div className="flex items-center gap-3">
                    {editingTrip.logo_url && (
                      <img src={editingTrip.logo_url} alt="logo" className="w-12 h-12 rounded-lg object-contain bg-slate-700 p-1" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const fd = new FormData()
                        fd.append('file', file)
                        const res = await fetch(`/api/admin/trips/${editingTrip.id}/logo`, { method: 'POST', body: fd })
                        const data = await res.json()
                        if (res.ok) {
                          setEditingTrip(prev => prev ? { ...prev, logo_url: data.url } : prev)
                          setTrips(prev => prev.map(t => t.id === editingTrip.id ? { ...t, logo_url: data.url } : t))
                        }
                      }}
                      className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button onClick={() => setEditingTrip(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg text-sm transition-colors">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}