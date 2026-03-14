'use client'

import { useState, useEffect } from 'react'
import { Participant, Group } from '@/lib/types'
import ParticipantModal from '@/components/ParticipantModal'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'

export default function ParticipantsPage() {
  const router = useRouter()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkGroupId, setBulkGroupId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) {
      router.push('/admin/trips')
      return
    }
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
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(p => p.id)))
    }
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

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {someSelected && (
          <div className="mb-4 flex items-center gap-3 p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl">
            <span className="text-blue-400 text-sm font-medium">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={bulkGroupId}
                onChange={e => setBulkGroupId(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Assign to group —</option>
                <option value="none">🚫 Remove from group</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="accent-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Name</th>
                  <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Company</th>
                  <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Group</th>
                  <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Hotel</th>
                  <th className="text-left px-4 py-4 text-slate-400 text-sm font-medium">Attendee Link</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
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
                      <div className="flex items-center gap-3">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{p.name}</p>
                          <p className="text-slate-400 text-sm">{p.title || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{p.company || '—'}</td>
                    <td className="px-4 py-4">
                      {p.group ? (
                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-full border border-blue-500/20">
                          {p.group.name}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {p.hotel_name ? `${p.hotel_name}${p.hotel_room ? ` · Rm ${p.hotel_room}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4">
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