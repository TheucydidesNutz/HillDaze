'use client'

import { useState, useEffect } from 'react'

interface Note {
  id: string
  content: string
  created_at: string
}

interface Props {
  token: string
}

export default function JournalSection({ token }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/attendee/notes?token=${token}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setNotes(data) })
  }, [token])

  async function handleSubmit() {
    if (!content.trim()) return
    setSaving(true)

    const res = await fetch('/api/attendee/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, content }),
    })

    if (res.ok) {
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setContent('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }

    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your thoughts, notes, or reflections here..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          {saved && <p className="text-green-400 text-sm">✓ Note saved!</p>}
          {!saved && <span />}
          <button
            onClick={handleSubmit}
            disabled={saving || !content.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Submit Note'}
          </button>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <p className="text-slate-400 text-sm font-medium">Your previous notes</p>
          {notes.map(note => (
            <div key={note.id} className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="text-slate-500 text-xs mt-2">{new Date(note.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}