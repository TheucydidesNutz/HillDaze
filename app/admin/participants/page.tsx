'use client'

import { useState, useEffect } from 'react'
import { Participant, Group } from '@/lib/types'
import ParticipantModal from '@/components/ParticipantModal'

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [pRes, gRes] = await Promise.all([
      fetch('/api/admin/participants'),
      fetch('/api/admin/groups'),
    ])
    const [pData, gData] = await Promise.all([pRes.json(), gRes.json()])
    setParticipants(pData)
    setGroups(gData)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this participant?')) return
    await fetch(`/api/admin/participants/${id}`, { method: 'DELETE' })
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  function handleEdit(p: Participant) {
    setEditingParticipant(p)
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

  const filtered = participants.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.company?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/admin" className="text-slate-400 text-sm hover:text-white mb-1 block">
              ← Dashboard
            </a>
            <h1 className="text-3xl font-bold text-white">Participants</h1>
            <p className="text-slate-400 mt-1">{participants.length} attendees</p>
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            + Add Participant
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-4 text-slate-400 text-sm font-medium">Name</th>
                  <th className="text-left px-6 py-4 text-slate-400 text-sm font-medium">Company</th>
                  <th className="text-left px-6 py-4 text-slate-400 text-sm font-medium">Group</th>
                  <th className="text-left px-6 py-4 text-slate-400 text-sm font-medium">Hotel</th>
                  <th className="text-left px-6 py-4 text-slate-400 text-sm font-medium">Attendee Link</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/50'}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{p.name}</p>
                          <p className="text-slate-400 text-sm">{p.title || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{p.company || '—'}</td>
                    <td className="px-6 py-4">
                      {p.group ? (
                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-full border border-blue-500/20">
                          {p.group.name}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {p.hotel_name ? `${p.hotel_name}${p.hotel_room ? ` · Rm ${p.hotel_room}` : ''}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/attendee/${p.access_token}`
                          navigator.clipboard.writeText(url)
                          alert('Link copied!')
                        }}
                        className="text-slate-400 hover:text-blue-400 text-sm transition-colors"
                      >
                        Copy link
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => handleEdit(p)}
                          className="text-slate-400 hover:text-white text-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-slate-400 hover:text-red-400 text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <ParticipantModal
          participant={editingParticipant}
          groups={groups}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}