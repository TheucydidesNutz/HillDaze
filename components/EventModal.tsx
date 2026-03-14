'use client'

import { useState, useEffect } from 'react'
import { Participant, Group } from '@/lib/types'

interface Event {
    id: string
    title: string
    description: string
    start_time: string
    end_time: string
    location: string
    type: 'mandatory' | 'optional'
  }

  interface Props {
    event: Partial<Event> | null
    participants: Participant[]
    groups: Group[]
    onClose: () => void
    onSaved: (e: Event) => void
    onDeleted?: (id: string) => void
  }

export default function EventModal({ event, participants, groups, onClose, onSaved, onDeleted }: Props) {
  const [saving, setSaving] = useState(false)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start_time: event?.start_time?.slice(0, 16) || '',
    end_time: event?.end_time?.slice(0, 16) || '',
    location: event?.location || '',
    type: event?.type || 'optional' as 'mandatory' | 'optional',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleParticipant(id: string) {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function toggleGroup(id: string) {
    setSelectedGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  function selectAll() {
    setSelectedParticipants(participants.map(p => p.id))
  }

  function selectNone() {
    setSelectedParticipants([])
    setSelectedGroups([])
  }

  async function handleSave() {
    if (!form.title.trim()) return alert('Title is required')
    if (!form.start_time) return alert('Start time is required')
    if (!form.end_time) return alert('End time is required')
    setSaving(true)

    const payload = {
      ...form,
      participant_ids: selectedParticipants,
      group_ids: selectedGroups,
    }

    const isNew = !event?.id || event.id === ''
    const url = isNew ? '/api/admin/events' : `/api/admin/events/${event.id}`
    const method = isNew ? 'POST' : 'PATCH'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setSaving(false)
    if (res.ok) onSaved(data)
    else alert(data.error || 'Something went wrong')
  }

  async function handleDelete() {
    if (!event?.id) return
    if (!confirm('Delete this event?')) return
    await fetch(`/api/admin/events/${event.id}`, { method: 'DELETE' })
    onDeleted?.(event.id)
  }

  const label = (text: string) => (
    <label className="block text-xs font-medium text-slate-400 mb-1">{text}</label>
  )

  const input = (field: string, placeholder: string, type = 'text') => (
    <input
      type={type}
      placeholder={placeholder}
      value={(form as any)[field]}
      onChange={e => set(field, e.target.value)}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    />
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-lg">
            {event?.id ? 'Edit Event' : 'Create Event'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            {label('Event Title *')}
            {input('title', 'Opening Reception')}
          </div>

          {/* Type */}
          <div>
            {label('Event Type')}
            <div className="flex gap-3">
              <button
                onClick={() => set('type', 'mandatory')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  form.type === 'mandatory'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                🔴 Mandatory
              </button>
              <button
                onClick={() => set('type', 'optional')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  form.type === 'optional'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                🔵 Optional
              </button>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              {label('Start Time *')}
              {input('start_time', '', 'datetime-local')}
            </div>
            <div>
              {label('End Time *')}
              {input('end_time', '', 'datetime-local')}
            </div>
          </div>

          {/* Location */}
          <div>
            {label('Location')}
            {input('location', 'Grand Ballroom, Floor 3')}
          </div>

          {/* Description */}
          <div>
            {label('Description')}
            <textarea
              placeholder="Event details..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          {/* Assign — only for new events */}
          {!event?.id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                {label('Assign To')}
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">All</button>
                  <span className="text-slate-600">·</span>
                  <button onClick={selectNone} className="text-xs text-slate-400 hover:text-white">None</button>
                </div>
              </div>

              {/* Groups */}
              {groups.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-2">Groups</p>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(g => (
                      <button
                        key={g.id}
                        onClick={() => toggleGroup(g.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                          selectedGroups.includes(g.id)
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual participants */}
              <p className="text-xs text-slate-500 mb-2">Individual Participants</p>
              <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-800/50 rounded-lg p-2">
                {participants.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.includes(p.id)}
                      onChange={() => toggleParticipant(p.id)}
                      className="accent-blue-500"
                    />
                    <span className="text-white text-sm">{p.name}</span>
                    {p.company && <span className="text-slate-400 text-xs">{p.company}</span>}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <div>
            {event?.id && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-400 hover:text-red-300 text-sm transition-colors"
              >
                Delete Event
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {saving ? 'Saving...' : event?.id ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}