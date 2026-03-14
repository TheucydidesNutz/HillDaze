'use client'

import { useState, useEffect } from 'react'
import { Participant, Group, Event } from '@/lib/types'
import AttendeeCalendar from '@/components/AttendeeCalendar'
import JournalSection from '@/components/JournalSection'

interface FactSheet {
  id: string
  label: string
  file_url: string
  is_active: boolean
}

interface PageData {
  participant: Participant & { group: Group | null }
  events: Event[]
  factSheet: FactSheet | null
}

export default function AttendeePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string>('')
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    params.then(({ token: t }) => {
      setToken(t)
      fetch(`/api/attendee/${t}`)
        .then(res => res.json())
        .then(d => {
          if (d.error) setError(d.error)
          else setData(d)
          setLoading(false)
        })
    })
  }, [params])

  async function handlePdfDownload() {
    if (!data?.factSheet) return
    const res = await fetch(`/api/admin/upload/pdf/signed-url?path=${encodeURIComponent(data.factSheet.file_url)}`)
    const { url } = await res.json()
    window.open(url, '_blank')
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Loading your information...</div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-lg mb-2">Invalid or expired link</p>
        <p className="text-slate-500 text-sm">Please contact your event coordinator for a new link.</p>
      </div>
    </div>
  )

  const { participant, events, factSheet } = data
  const p = participant

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">H</span>
            </div>
            <span className="text-white font-semibold">HillDayTracker</span>
          </div>
          {factSheet && (
            <button
              onClick={handlePdfDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              📄 Fact Sheet
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Hero Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-3xl font-bold">{p.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{p.name}</h1>
              {p.title && <p className="text-slate-300">{p.title}</p>}
              {p.company && <p className="text-slate-400 text-sm">{p.company}</p>}
              <div className="flex gap-4 mt-2">
                {p.phone && <a href={`tel:${p.phone}`} className="text-blue-400 text-sm hover:text-blue-300">📞 {p.phone}</a>}
                {p.email && <a href={`mailto:${p.email}`} className="text-blue-400 text-sm hover:text-blue-300">✉️ {p.email}</a>}
              </div>
            </div>
          </div>
        </div>

        {/* Group Info */}
        {p.group && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              🏷️ Your Group
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {p.group.lead_photo_url ? (
                  <img src={p.group.lead_photo_url} alt={p.group.lead_name || ''} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-lg font-bold">{p.group.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="text-white font-medium">{p.group.name}</p>
                {p.group.lead_name && <p className="text-slate-300 text-sm">Lead: {p.group.lead_name}</p>}
                <div className="flex gap-4 mt-1">
                  {p.group.lead_phone && <a href={`tel:${p.group.lead_phone}`} className="text-blue-400 text-sm hover:text-blue-300">📞 {p.group.lead_phone}</a>}
                  {p.group.lead_email && <a href={`mailto:${p.group.lead_email}`} className="text-blue-400 text-sm hover:text-blue-300">✉️ {p.group.lead_email}</a>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flights */}
        {(p.arrival_airline || p.departure_airline) && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">✈️ Flights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {p.arrival_airline && (
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Arrival</p>
                  <p className="text-white font-medium">{p.arrival_airline} {p.arrival_flight_no}</p>
                  {p.arrival_datetime && <p className="text-slate-300 text-sm">{new Date(p.arrival_datetime).toLocaleString()}</p>}
                  {p.arrival_airport && <p className="text-slate-400 text-sm">✈ {p.arrival_airport}</p>}
                </div>
              )}
              {p.departure_airline && (
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Departure</p>
                  <p className="text-white font-medium">{p.departure_airline} {p.departure_flight_no}</p>
                  {p.departure_datetime && <p className="text-slate-300 text-sm">{new Date(p.departure_datetime).toLocaleString()}</p>}
                  {p.departure_airport && <p className="text-slate-400 text-sm">✈ {p.departure_airport}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hotel */}
        {p.hotel_name && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-3">🏨 Hotel</h2>
            <p className="text-white text-lg">{p.hotel_name}</p>
            {p.hotel_room && <p className="text-slate-400">Room {p.hotel_room}</p>}
          </div>
        )}

        {/* Fun Diversions */}
        {p.fun_diversions && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-3">🎉 Fun Diversions</h2>
            <p className="text-slate-300 whitespace-pre-wrap">{p.fun_diversions}</p>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">📅 Your Schedule</h2>
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              <span className="text-slate-400">Mandatory</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
              <span className="text-slate-400">Optional</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="text-slate-400">⚡ Recently updated</span>
            </span>
          </div>
          <AttendeeCalendar events={events} />
        </div>

        {/* Journal */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">📝 Notes & Journal</h2>
          <JournalSection token={token} />
        </div>
      </div>
    </div>
  )
}