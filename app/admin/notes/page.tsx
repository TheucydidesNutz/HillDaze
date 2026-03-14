'use client'

import { useState, useEffect, useCallback } from 'react'
import { Participant } from '@/lib/types'
import { apiFetch } from '@/lib/apiFetch'

interface Note {
  id: string
  content: string
  created_at: string
  participant: {
    id: string
    name: string
    photo_url: string | null
    company: string | null
    title: string | null
  }
}

export default function NotesFeedPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [filterParticipant, setFilterParticipant] = useState('')

  const fetchNotes = useCallback(async () => {
    const url = filterParticipant
      ? `/api/admin/notes?participant_id=${filterParticipant}`
      : '/api/admin/notes'
    const res = await fetch(url)
    const data = await res.json()
    setNotes(data)
    setLoading(false)
  }, [filterParticipant])

  useEffect(() => {
    apiFetch('/api/admin/participants')
      .then(res => res.json())
      .then(data => setParticipants(data))
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchNotes()
  }, [fetchNotes])

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/admin" className="text-slate-400 text-sm hover:text-white mb-1 block">
              ← Dashboard
            </a>
            <h1 className="text-3xl font-bold text-white">Notes Feed</h1>
            <p className="text-slate-400 mt-1">{notes.length} notes submitted</p>
          </div>
          <button
            onClick={fetchNotes}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <select
            value={filterParticipant}
            onChange={e => setFilterParticipant(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-w-48"
          >
            <option value="">All participants</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        {loading ? (
          <div className="text-slate-400 text-center py-20">Loading...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">No notes yet</p>
            <p className="text-slate-500 text-sm mt-2">
              Notes will appear here when participants submit them from their micro-site.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <div key={note.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
                {/* Participant info */}
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
                    </p>
                  </div>
                  <div className="ml-auto text-slate-500 text-xs">
                    {new Date(note.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Note content */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}