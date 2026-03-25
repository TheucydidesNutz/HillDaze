'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wifi, WifiOff, Check, Clock, MapPin, X } from 'lucide-react'

interface Note {
  id: string
  content: string
  created_at: string
  status: 'synced' | 'pending'
}

interface EventContext {
  id: string
  title: string
  start_time: string
  end_time: string
  location: string | null
  type: string
  description: string | null
}

interface Props {
  token: string
  eventContext?: EventContext | null
  onNoteSubmitted?: () => void
}

const STORAGE_KEY = (token: string) => `covaled_notes_${token}`

function loadLocalNotes(token: string): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(token))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalNotes(token: string, notes: Note[]) {
  try {
    localStorage.setItem(STORAGE_KEY(token), JSON.stringify(notes))
  } catch {}
}

export default function JournalSection({ token, eventContext, onNoteSubmitted }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // ── Load notes: merge server + local pending ──────────────────────────────
  useEffect(() => {
    if (!token) return

    const local = loadLocalNotes(token)
    const pending = local.filter(n => n.status === 'pending')

    // Show pending notes immediately while we fetch from server
    if (pending.length > 0) setNotes(pending)

    fetch(`/api/events/attendee/notes?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return
        const serverNotes: Note[] = data.map((n: any) => ({ ...n, status: 'synced' as const }))
        // Merge: server notes + any pending not yet in server
        const serverIds = new Set(serverNotes.map(n => n.id))
        const stillPending = pending.filter(n => !serverIds.has(n.id))
        const merged = [...stillPending, ...serverNotes]
        setNotes(merged)
        saveLocalNotes(token, merged)
      })
      .catch(() => {
        // Offline on load — just show whatever is local
        setNotes(local)
      })
  }, [token])

  // ── Online/offline detection ──────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // ── Flush pending notes when connection restored ───────────────────────────
  const flushPending = useCallback(async () => {
    if (!token) return
    const local = loadLocalNotes(token)
    const pending = local.filter(n => n.status === 'pending')
    if (pending.length === 0) return

    for (const note of pending) {
      try {
        const res = await fetch('/api/events/attendee/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, content: note.content }),
        })
        if (res.ok) {
          const saved = await res.json()
          // Replace pending note with synced version from server
          setNotes(prev => {
            const updated = prev.map(n =>
              n.id === note.id
                ? { ...saved, status: 'synced' as const }
                : n
            )
            saveLocalNotes(token, updated)
            return updated
          })
        }
      } catch {
        // Still offline — leave as pending
      }
    }
  }, [token])

  useEffect(() => {
    if (isOnline) flushPending()
  }, [isOnline, flushPending])

  // ── Submit note ───────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!content.trim()) return
    setSaving(true)

    // Build the final content — prepend event title if context is set
    const finalContent = eventContext
      ? `Note about ${eventContext.title}: ${content.trim()}`
      : content.trim()

    // Build event_metadata if context is set
    const eventMetadata = eventContext
      ? {
          event_id: eventContext.id,
          event_title: eventContext.title,
          start_time: eventContext.start_time,
          end_time: eventContext.end_time,
          location: eventContext.location || '',
          type: eventContext.type,
          description: eventContext.description || '',
        }
      : undefined

    const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const pendingNote: Note = {
      id: tempId,
      content: finalContent,
      created_at: new Date().toISOString(),
      status: 'pending',
    }

    // Optimistically add to UI and localStorage immediately
    setNotes(prev => {
      const updated = [pendingNote, ...prev]
      saveLocalNotes(token, updated)
      return updated
    })
    setContent('')
    setSaving(false)

    // Clear event context after submission
    onNoteSubmitted?.()

    // Attempt server sync
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/events/attendee/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            content: finalContent,
            ...(eventMetadata ? { event_metadata: eventMetadata } : {}),
          }),
        })
        if (res.ok) {
          const saved = await res.json()
          setNotes(prev => {
            const updated = prev.map(n =>
              n.id === tempId ? { ...saved, status: 'synced' as const } : n
            )
            saveLocalNotes(token, updated)
            return updated
          })
        }
      } catch {
        // Leave as pending — will flush when online
      }
    }
  }

  const pendingCount = notes.filter(n => n.status === 'pending').length

  return (
    <div className="space-y-4">

      {/* Online/offline + pending status bar */}
      <div className="flex items-center gap-2 text-xs">
        {isOnline ? (
          <span className="flex items-center gap-1 text-green-400">
            <Wifi className="w-3 h-3" />
            Online
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-400">
            <WifiOff className="w-3 h-3" />
            Offline
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-amber-400 flex items-center gap-1">
            · <Clock className="w-3 h-3" /> {pendingCount} note{pendingCount > 1 ? 's' : ''} waiting to sync
          </span>
        )}
      </div>

      {/* Event context label */}
      {eventContext && (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
          <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-blue-300 text-sm font-medium flex-1">
            Note about: {eventContext.title}
          </span>
          <button
            onClick={() => onNoteSubmitted?.()}
            className="text-slate-400 hover:text-white flex-shrink-0"
            title="Clear event context"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input */}
      <div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={eventContext
            ? `Write your note about ${eventContext.title}...`
            : 'Write your thoughts, notes, or reflections here...'
          }
          rows={4}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
        />
        <div className="flex items-center justify-end mt-2">
          <button
            onClick={handleSubmit}
            disabled={saving || !content.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Submit Note'}
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length > 0 && (
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-slate-400 text-sm font-medium">Your previous notes</p>
          {notes.map(note => (
            <div key={note.id} className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-slate-500 text-xs">{new Date(note.created_at).toLocaleString()}</p>
                {/* Sync status indicator */}
                {note.status === 'synced' ? (
                  <span className="flex items-center gap-1 text-green-400 text-xs">
                    <Check className="w-3 h-3" />
                    Synced
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 text-xs">
                    <Clock className="w-3 h-3" />
                    Saved locally
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
