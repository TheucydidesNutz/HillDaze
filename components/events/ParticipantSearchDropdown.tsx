'use client'

import { useState, useRef, useEffect } from 'react'
import { Participant } from '@/lib/events/types'
import { X } from 'lucide-react'

interface Props {
  participants: Participant[]
  selectedId: string | null
  onSelect: (participant: Participant) => void
  onClear: () => void
  label?: string
  placeholder?: string
}

export default function ParticipantSearchDropdown({
  participants,
  selectedId,
  onSelect,
  onClear,
  label = 'Select Participant',
  placeholder = 'Search by name...',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = selectedId ? participants.find(p => p.id === selectedId) : null

  const filtered = query.trim()
    ? participants.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : participants

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (selected) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
          {selected.photo_url ? (
            <img src={selected.photo_url} alt={selected.name} className="w-8 h-8 rounded-full object-cover border border-slate-600 shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 text-xs font-medium shrink-0">
              {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{selected.name}</p>
            {(selected.title || selected.company) && (
              <p className="text-slate-400 text-xs truncate">
                {[selected.title, selected.company].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button onClick={onClear} className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p)
                setQuery('')
                setOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700 transition-colors text-left"
            >
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="w-7 h-7 rounded-full object-cover border border-slate-600 shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 text-xs font-medium shrink-0">
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white text-sm truncate">{p.name}</p>
                {(p.title || p.company) && (
                  <p className="text-slate-500 text-xs truncate">
                    {[p.title, p.company].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 text-slate-500 text-sm">
          No participants found
        </div>
      )}
    </div>
  )
}
