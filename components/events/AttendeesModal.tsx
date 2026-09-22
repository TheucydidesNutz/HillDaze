'use client'

import { useState, useEffect } from 'react'
import { X, Users, Phone, Mail } from 'lucide-react'

interface Attendee {
  name: string
  photo_url: string | null
  // Present only when the viewer is permitted to see contacts.
  title?: string | null
  email?: string | null
  phone?: string | null
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

function hasContact(a: Attendee) {
  return !!(a.email || a.phone)
}

export default function AttendeesModal({ token, onClose }: Props) {
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const [error, setError] = useState('')
  const [contactPerson, setContactPerson] = useState<Attendee | null>(null)

  useEffect(() => {
    fetch(`/api/events/attendee/${token}/attendees`)
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
                {attendees.map((a, i) => {
                  const tappable = hasContact(a)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={tappable ? () => setContactPerson(a) : undefined}
                      disabled={!tappable}
                      className={`flex flex-col items-center gap-2 rounded-xl p-1 transition-colors ${tappable ? 'cursor-pointer hover:bg-slate-800' : 'cursor-default'}`}
                    >
                      <div className={`relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${!a.photo_url ? getAvatarColor(a.name) : ''}`}>
                        {a.photo_url ? (
                          <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-lg font-bold">{a.name.charAt(0)}</span>
                        )}
                        {tappable && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center">
                            <Phone className="w-2.5 h-2.5 text-white" />
                          </span>
                        )}
                      </div>
                      <p className="text-white text-xs text-center leading-tight">{a.name}</p>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contact window — permitted viewers only */}
      {contactPerson && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
          onClick={e => { e.stopPropagation(); setContactPerson(null) }}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-xs w-full relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close — top left */}
            <button
              onClick={() => setContactPerson(null)}
              aria-label="Close"
              className="absolute top-3 left-3 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center pt-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center overflow-hidden mb-3 ${!contactPerson.photo_url ? getAvatarColor(contactPerson.name) : ''}`}>
                {contactPerson.photo_url ? (
                  <img src={contactPerson.photo_url} alt={contactPerson.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xl font-bold">{contactPerson.name.charAt(0)}</span>
                )}
              </div>
              <p className="text-white font-semibold text-lg">{contactPerson.name}</p>
              {contactPerson.title && (
                <p className="text-slate-400 text-sm">{contactPerson.title}</p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {contactPerson.phone && (
                <a
                  href={`tel:${contactPerson.phone.replace(/[^\d+]/g, '')}`}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                >
                  <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm">{contactPerson.phone}</span>
                </a>
              )}
              {contactPerson.email && (
                <a
                  href={`mailto:${contactPerson.email}`}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                >
                  <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm break-all">{contactPerson.email}</span>
                </a>
              )}
              {!contactPerson.phone && !contactPerson.email && (
                <p className="text-slate-500 text-sm text-center">No contact info on file.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
