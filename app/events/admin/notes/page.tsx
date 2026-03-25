'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/events/types'
import TripHeader from '@/components/TripHeader'
import { ChevronDown, ChevronUp, CalendarDays, MapPin, Clock, Tag } from 'lucide-react'

interface Group {
  id: string
  name: string
}

interface EventMetadata {
  event_id?: string
  event_title?: string
  start_time?: string
  end_time?: string
  location?: string
  type?: string
  description?: string
}

interface Note {
  id: string
  content: string
  created_at: string
  event_metadata?: EventMetadata | null
  participant: {
    id: string
    name: string
    photo_url: string | null
    company: string | null
    title: string | null
    group_id: string | null
  }
}

export default function NotesFeedPage() {
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [filterParticipant, setFilterParticipant] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedMetadata, setExpandedMetadata] = useState<Set<string>>(new Set())

  const participants = Array.from(
    new Map(notes.map(n => [n.participant.id, n.participant])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch('/api/events/admin/notes?limit=200')
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/events/admin/trips'); return }
    setTrip(JSON.parse(tripStr))
    apiFetch('/api/events/admin/groups')
      .then(res => res.json())
      .then(data => setGroups(Array.isArray(data) ? data : []))
    fetchNotes()
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remove this note from the feed? It will be permanently stored but hidden.')) return
    setDeletingId(id)
    await apiFetch(`/api/events/admin/notes?id=${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  function toggleMetadata(noteId: string) {
    setExpandedMetadata(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  function formatEventTime(startTime?: string, endTime?: string) {
    if (!startTime) return ''
    const start = new Date(startTime).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    if (!endTime) return start
    const end = new Date(endTime).toLocaleString('en-US', {
      hour: 'numeric', minute: '2-digit',
    })
    return `${start} – ${end}`
  }

  function exportCSV(notesToExport: Note[], filename: string) {
    const rows = notesToExport.map(n => ({
      participant: n.participant.name,
      company: n.participant.company || '',
      title: n.participant.title || '',
      group: groups.find(g => g.id === n.participant.group_id)?.name || '',
      note: n.content.replace(/"/g, '""'),
      submitted_at: new Date(n.created_at).toLocaleString(),
      event_title: n.event_metadata?.event_title || '',
      event_time: n.event_metadata?.start_time
        ? formatEventTime(n.event_metadata.start_time, n.event_metadata.end_time)
        : '',
      event_location: n.event_metadata?.location || '',
      event_type: n.event_metadata?.type || '',
      event_description: (n.event_metadata?.description || '').replace(/"/g, '""'),
    }))

    const header = 'Participant,Company,Title,Group,Note,Submitted At,Event Title,Event Time,Event Location,Event Type,Event Description'
    const csv = [
      header,
      ...rows.map(r =>
        `"${r.participant}","${r.company}","${r.title}","${r.group}","${r.note}","${r.submitted_at}","${r.event_title}","${r.event_time}","${r.event_location}","${r.event_type}","${r.event_description}"`
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredNotes = notes
    .filter(n => {
      if (filterParticipant && n.participant.id !== filterParticipant) return false
      if (filterGroup && n.participant.group_id !== filterGroup) return false
      return true
    })
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortOrder === 'newest' ? -diff : diff
    })

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">

        {trip && (
          <TripHeader
            trip={trip}
            pageTitle="Notes Feed"
            pageSubtitle={`${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}${(filterGroup || filterParticipant) ? ' (filtered)' : ' submitted'}`}
          />
        )}

        {/* Export + Refresh buttons */}
        <div className="flex items-center justify-end gap-2 mb-6">
          <button
            onClick={() => exportCSV(filteredNotes, 'notes-filtered')}
            disabled={filteredNotes.length === 0}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            Download Visible Notes
          </button>
          <button
            onClick={() => exportCSV(notes, 'notes-all')}
            disabled={notes.length === 0}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            Download All Notes
          </button>
          <button
            onClick={fetchNotes}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filterGroup}
            onChange={e => { setFilterGroup(e.target.value); setFilterParticipant('') }}
            className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All groups</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          <select
            value={filterParticipant}
            onChange={e => { setFilterParticipant(e.target.value); setFilterGroup('') }}
            className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All participants</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>

          {(filterGroup || filterParticipant) && (
            <button
              onClick={() => { setFilterGroup(''); setFilterParticipant('') }}
              className="px-4 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Notes */}
        {loading ? (
          <div className="text-slate-400 text-center py-20">Loading...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No notes</p>
            <p className="text-slate-500 text-sm mt-2">
              {filterGroup || filterParticipant
                ? 'No notes match the current filters.'
                : 'Notes will appear here when participants submit them.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map(note => {
              const groupName = groups.find(g => g.id === note.participant.group_id)?.name
              const hasEventMeta = note.event_metadata && note.event_metadata.event_title
              const isExpanded = expandedMetadata.has(note.id)
              return (
                <div key={note.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {note.participant.photo_url ? (
                        <img src={note.participant.photo_url} alt={note.participant.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {note.participant.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">{note.participant.name}</p>
                      <p className="text-slate-400 text-xs">
                        {note.participant.title && `${note.participant.title} · `}
                        {note.participant.company}
                        {groupName && <span className="text-slate-500"> · {groupName}</span>}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <span className="text-slate-500 text-xs">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={deletingId === note.id}
                        className="text-slate-600 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                        title="Hide note"
                      >
                        {deletingId === note.id ? '...' : 'Hide'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                  </div>

                  {/* Event metadata block */}
                  {hasEventMeta && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleMetadata(note.id)}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>Linked event: {note.event_metadata!.event_title}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 space-y-1.5 text-xs">
                          <p className="text-slate-300 flex items-center gap-1.5">
                            <CalendarDays className="w-3 h-3 text-slate-500" />
                            {note.event_metadata!.event_title}
                          </p>
                          {(note.event_metadata!.start_time || note.event_metadata!.end_time) && (
                            <p className="text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {formatEventTime(note.event_metadata!.start_time, note.event_metadata!.end_time)}
                            </p>
                          )}
                          {note.event_metadata!.location && (
                            <p className="text-slate-400 flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {note.event_metadata!.location}
                            </p>
                          )}
                          {note.event_metadata!.type && (
                            <p className="text-slate-400 flex items-center gap-1.5">
                              <Tag className="w-3 h-3 text-slate-500" />
                              {note.event_metadata!.type === 'mandatory' ? 'Mandatory' : 'Optional'}
                            </p>
                          )}
                          {note.event_metadata!.description && (
                            <p className="text-slate-500 mt-1">{note.event_metadata!.description}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
