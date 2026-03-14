'use client'

import { useState, useEffect } from 'react'
import { Participant, Group, Trip } from '@/lib/types'
import ParticipantModal from '@/components/ParticipantModal'
import TripHeader from '@/components/TripHeader'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'

export default function ParticipantsPage() {
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [viewingParticipant, setViewingParticipant] = useState<Participant | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkGroupId, setBulkGroupId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/admin/trips'); return }
    setTrip(JSON.parse(tripStr))
    fetchData()
  }, [])

  async function fetchData() {
    const [pRes, gRes] = await Promise.all([
      apiFetch('/api/admin/participants'),
      apiFetch('/api/admin/groups'),
    ])
    const [pData, gData] = await Promise.all([pRes.json(), gRes.json()])
    setParticipants(pData)
    setGroups(gData)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this participant?')) return
    await apiFetch(`/api/admin/participants/${id}`, { method: 'DELETE' })
    setParticipants(prev => prev.filter(p => p.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function handleEdit(p: Participant) {
    setEditingParticipant(p)
    setViewingParticipant(null)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingParticipant(null)
    setModalOpen(true)
  }

  function handleSaved(saved: Participant) {
    setParticipants(prev => {
      const exists = prev.find(p => p.id === saved.id)
      if (exists) return prev.map(p => p.id === saved.id ? saved : p)
      return [saved, ...prev]
    })
    setModalOpen(false)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.id)))
  }

  async function handleBulkAssign() {
    if (!bulkGroupId && bulkGroupId !== 'none') return alert('Please select a group')
    if (selected.size === 0) return alert('No participants selected')
    setBulkAssigning(true)
    const groupIdToSet = bulkGroupId === 'none' ? null : bulkGroupId
    await Promise.all(
      Array.from(selected).map(id =>
        apiFetch(`/api/admin/participants/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: groupIdToSet }),
        })
      )
    )
    const res = await apiFetch('/api/admin/participants')
    const data = await res.json()
    setParticipants(data)
    setSelected(new Set())
    setBulkGroupId('')
    setBulkAssigning(false)
  }

  function copyLink(p: Participant) {
    const url = `${window.location.origin}/attendee/${p.access_token}`
    navigator.clipboard.writeText(url)
    setCopiedId(p.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = participants.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.company?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  )

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">

        {trip && (
          <TripHeader
            trip={trip}
            pageTitle="Participants"
            pageSubtitle={`${participants.length} attendees`}
          />
        )}

        {/* Search + Add */}
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            + Add Participant
          </button>
        </div>

        {/* Bulk assign bar */}
        {someSelected && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl">
            <span className="text-blue-400 text-sm font-medium">{selected.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={bulkGroupId}
                onChange={e => setBulkGroupId(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Assign to group —</option>
                <option value="none">🚫 Remove from group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={bulkAssigning || !bulkGroupId}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {bulkAssigning ? 'Applying...' : 'Apply'}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-slate-400 text-center py-20">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No participants yet</p>
            <button onClick={handleAdd} className="mt-4 text-blue-400 hover:text-blue-300">
              Add your first participant →
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-4 w-24 text-left text-slate-400 text-sm font-medium">
                      <div className="flex flex-col gap-1.5">
                        <span>Select All</span>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                    </th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Name</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium w-32">Actions</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Company</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Group</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Hotel</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Email</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Phone</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Arrival</th>
                    <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Departure</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-800 last:border-0 transition-colors ${
                        selected.has(p.id) ? 'bg-blue-600/10' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <div
                          className="flex items-center gap-3 cursor-pointer group"
                          onClick={() => setViewingParticipant(p)}
                        >
                          {p.photo_url ? (
                            <img src={p.photo_url} alt={p.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium group-hover:text-blue-400 transition-colors">{p.name}</p>
                            <p className="text-slate-400 text-sm">{p.title || '—'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyLink(p)}
                            className={`text-xs transition-colors ${copiedId === p.id ? 'text-green-400' : 'text-slate-400 hover:text-blue-400'}`}
                          >
                            {copiedId === p.id ? '✓ Copied' : 'Copy'}
                          </button>
                          <span className="text-slate-700">·</span>
                          <button
                            onClick={() => handleEdit(p)}
                            className="text-slate-400 hover:text-white text-xs transition-colors"
                          >
                            Edit
                          </button>
                          <span className="text-slate-700">·</span>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-slate-400 hover:text-red-400 text-xs transition-colors"
                          >
                            Del
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-300 text-sm">{p.company || '—'}</td>
                      <td className="px-4 py-4">
                        {p.group ? (
                          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20 whitespace-nowrap">
                            {p.group.name}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-300 text-sm whitespace-nowrap">
                        {p.hotel_name ? `${p.hotel_name}${p.hotel_room ? ` · Rm ${p.hotel_room}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-300 text-sm">{p.email || '—'}</td>
                      <td className="px-4 py-4 text-slate-300 text-sm whitespace-nowrap">{p.phone || '—'}</td>
                      <td className="px-4 py-4 text-slate-400 text-xs whitespace-nowrap">
                        {p.arrival_airline && p.arrival_flight_no
                          ? `${p.arrival_airline} ${p.arrival_flight_no}`
                          : '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-400 text-xs whitespace-nowrap">
                        {p.departure_airline && p.departure_flight_no
                          ? `${p.departure_airline} ${p.departure_flight_no}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {modalOpen && (
        <ParticipantModal
          participant={editingParticipant}
          groups={groups}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* View-only modal */}
      {viewingParticipant && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold text-lg">Participant Info</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { handleEdit(viewingParticipant); setViewingParticipant(null) }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button onClick={() => setViewingParticipant(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="flex items-center gap-4">
                {viewingParticipant.photo_url ? (
                  <img src={viewingParticipant.photo_url} alt={viewingParticipant.name} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                    {viewingParticipant.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold text-lg">{viewingParticipant.name}</p>
                  <p className="text-slate-400 text-sm">{viewingParticipant.title || '—'}</p>
                  <p className="text-slate-400 text-sm">{viewingParticipant.company || '—'}</p>
                </div>
              </div>

              {[
                { label: 'Email', value: viewingParticipant.email },
                { label: 'Phone', value: viewingParticipant.phone },
                { label: 'Group', value: groups.find(g => g.id === viewingParticipant.group_id)?.name },
                { label: 'Hotel', value: viewingParticipant.hotel_name ? `${viewingParticipant.hotel_name}${viewingParticipant.hotel_room ? ` · Rm ${viewingParticipant.hotel_room}` : ''}` : null },
                { label: 'Arrival', value: viewingParticipant.arrival_airline ? `${viewingParticipant.arrival_airline} ${viewingParticipant.arrival_flight_no || ''} — ${viewingParticipant.arrival_datetime ? new Date(viewingParticipant.arrival_datetime).toLocaleString() : ''}` : null },
                { label: 'Departure', value: viewingParticipant.departure_airline ? `${viewingParticipant.departure_airline} ${viewingParticipant.departure_flight_no || ''} — ${viewingParticipant.departure_datetime ? new Date(viewingParticipant.departure_datetime).toLocaleString() : ''}` : null },
                { label: 'Emergency Contact', value: viewingParticipant.emergency_name ? `${viewingParticipant.emergency_name}${viewingParticipant.emergency_phone ? ` · ${viewingParticipant.emergency_phone}` : ''}` : null },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
                  <p className="text-slate-300 text-sm">{value || '—'}</p>
                </div>
              ))}

              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">Attendee Link</p>
                <button
                  onClick={() => copyLink(viewingParticipant)}
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  {copiedId === viewingParticipant.id ? '✓ Copied!' : 'Copy attendee link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}