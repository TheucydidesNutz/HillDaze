'use client'

import { useState, useEffect } from 'react'
import { X, Users } from 'lucide-react'

interface Attendee {
  name: string
  photo_url: string | null
}

interface Props {
  token: string
  onClose: () => void
}

const avatarColors = [
  'bg-blue-600',
  'bg-purple-600',
  'bg-green-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-teal-600',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export default function AttendeesModal({ token, onClose }: Props) {
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/attendee/${token}/attendees`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setAttendees(data.attendees)
      })
      .catch(() => setError('Failed to load attendees'))
  }, [token])

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Attendees
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {!attendees && !error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-slate-400 text-sm">Loading attendees...</div>
            </div>
          )}

          {attendees && (
            <>
              <p className="text-slate-500 text-xs mb-4">{attendees.length} attendee{attendees.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {attendees.map((a, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${!a.photo_url ? getAvatarColor(a.name) : ''}`}>
                      {a.photo_url ? (
                        <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-lg font-bold">{a.name.charAt(0)}</span>
                      )}
                    </div>
                    <p className="text-white text-xs text-center leading-tight">{a.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
