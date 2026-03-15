'use client'

import { useState, useEffect } from 'react'
import { Group, Trip } from '@/lib/types'
import GroupModal from '@/components/GroupModal'
import TripHeader from '@/components/TripHeader'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'
import { Mail, Phone } from 'lucide-react'

export default function GroupsPage() {
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/admin/trips'); return }
    setTrip(JSON.parse(tripStr))
    fetchGroups()
  }, [])

  async function fetchGroups() {
    const res = await apiFetch('/api/admin/groups')
    const data = await res.json()
    setGroups(data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this group? Participants will be unassigned.')) return
    await apiFetch(`/api/admin/groups/${id}`, { method: 'DELETE' })
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  function handleEdit(g: Group) {
    setEditingGroup(g)
    setModalOpen(true)
  }

  function handleAdd() {
    setEditingGroup(null)
    setModalOpen(true)
  }

  function handleSaved(saved: Group) {
    setGroups(prev => {
      const exists = prev.find(g => g.id === saved.id)
      if (exists) return prev.map(g => g.id === saved.id ? saved : g)
      return [saved, ...prev]
    })
    setModalOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">

        {trip && (
          <TripHeader
            trip={trip}
            pageTitle="Groups"
            pageSubtitle={`${groups.length} group${groups.length !== 1 ? 's' : ''}`}
          />
        )}

        <div className="flex justify-end mb-6">
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            + Add Group
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-20">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No groups yet</p>
            <button onClick={handleAdd} className="mt-4 text-blue-400 hover:text-blue-300">
              Create your first group →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map(g => (
              <div key={g.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {g.lead_photo_url ? (
                      <img src={g.lead_photo_url} alt={g.lead_name || ''} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-lg font-bold">
                        {g.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{g.name}</h3>
                    {g.lead_name && (
                      <p className="text-slate-400 text-sm">Lead: {g.lead_name}</p>
                    )}
                  </div>
                </div>

                {(g.lead_email || g.lead_phone) && (
                  <div className="space-y-1 mb-4 border-t border-slate-800 pt-4">
                    {g.lead_email && (
                      <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        {g.lead_email}
                      </p>
                    )}
                    {g.lead_phone && (
                      <p className="text-slate-400 text-sm flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        {g.lead_phone}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleEdit(g)}
                    className="flex-1 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="flex-1 py-1.5 text-sm text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <GroupModal
          group={editingGroup}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}