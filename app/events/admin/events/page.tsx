'use client'

import { useState, useEffect, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { Participant, Group, Trip } from '@/lib/events/types'
import EventModal from '@/components/events/EventModal'
import TripHeader from '@/components/TripHeader'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  description: string
  start_time: string
  end_time: string
  location: string
  type: 'mandatory' | 'optional'
  talking_points: string | null
  meeting_with: { name: string; title: string; photo_url: string | null; sort_order: number }[] | null
  created_at: string
  updated_at: string
}


export default function EventsPage() {
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [useEventTimezone, setUseEventTimezone] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const tripTimezone = (trip as any)?.timezone || 'America/New_York'
  const tripTheme = (trip as any)?.theme || null
  const primaryColor = tripTheme?.primary || '#3B82F6'
  const alertColor = tripTheme?.alert || '#D97706'
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/events/admin/trips'); return }
    setTrip(JSON.parse(tripStr))
    fetchData()
  }, [])

  async function fetchData() {
    const [eRes, pRes, gRes] = await Promise.all([
      apiFetch('/api/events/admin/events'),
      apiFetch('/api/events/admin/participants'),
      apiFetch('/api/events/admin/groups'),
    ])
    const [eData, pData, gData] = await Promise.all([
      eRes.json(), pRes.json(), gRes.json()
    ])
    setEvents(Array.isArray(eData) ? eData : [])
    setParticipants(Array.isArray(pData) ? pData : [])
    setGroups(Array.isArray(gData) ? gData : [])
  }

  function handleEventClick(info: any) {
    const event = events.find(e => e.id === info.event.id)
    if (event) {
      setEditingEvent(event)
      setModalOpen(true)
    }
  }

  function handleSaved(saved: any) {
    setEvents(prev => {
      const exists = prev.find(e => e.id === saved.id)
      if (exists) return prev.map(e => e.id === saved.id ? saved : e)
      return [...prev, saved]
    })
    setModalOpen(false)
  }

  function handleDeleted(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id))
    setModalOpen(false)
  }

  function openCreate() {
    setEditingEvent(null)
    setModalOpen(true)
  }

  // Calculate offset between trip timezone and browser timezone
  const showMyTime = !useEventTimezone
  const tzOffsetMs = useMemo(() => {
    if (!showMyTime) return 0
    const now = new Date()
    const tripLocal = new Date(now.toLocaleString('en-US', { timeZone: tripTimezone }))
    const browserLocal = new Date(now.toLocaleString('en-US', { timeZone: browserTimezone }))
    return browserLocal.getTime() - tripLocal.getTime()
  }, [showMyTime, tripTimezone, browserTimezone])

  // Strip fake +00 offset and optionally shift by timezone difference
  function shiftTime(dateStr: string): string {
    const naive = dateStr?.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
    if (tzOffsetMs === 0) return naive
    const shifted = new Date(new Date(naive).getTime() + tzOffsetMs)
    const y = shifted.getFullYear()
    const mo = String(shifted.getMonth() + 1).padStart(2, '0')
    const d = String(shifted.getDate()).padStart(2, '0')
    const h = String(shifted.getHours()).padStart(2, '0')
    const mi = String(shifted.getMinutes()).padStart(2, '0')
    const s = String(shifted.getSeconds()).padStart(2, '0')
    return `${y}-${mo}-${d}T${h}:${mi}:${s}`
  }

  const calendarEvents = events.map(e => {
    const start = shiftTime(e.start_time)
    const end = shiftTime(e.end_time || e.start_time)

    const threeHoursMs = 3 * 60 * 60 * 1000
    const wasUpdated = e.updated_at && e.created_at &&
      new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 2000 &&
      Date.now() - new Date(e.updated_at).getTime() < threeHoursMs

    return {
      id: e.id,
      title: wasUpdated ? `⚡ ${e.title}` : e.title,
      start,
      end,
      backgroundColor: wasUpdated ? alertColor : e.type === 'mandatory' ? '#EF4444' : primaryColor,
      borderColor: wasUpdated ? alertColor : e.type === 'mandatory' ? '#DC2626' : primaryColor,
      extendedProps: { location: e.location, description: e.description, type: e.type }
    }
  })

  const displayTimezone = useEventTimezone ? tripTimezone : browserTimezone

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {trip && (
          <TripHeader
            trip={trip}
            pageTitle="Schedule"
            pageSubtitle={`${events.length} events scheduled`}
          />
        )}

        {/* ── Toolbar ── */}
        <div className="mb-6 space-y-3">

          {/* Row 1: Legend + desktop Create button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                <span className="text-slate-400">Mandatory</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                <span className="text-slate-400">Optional</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-600 inline-block"></span>
                <span className="text-slate-400">⚡ Updated</span>
              </span>
            </div>

            {/* Desktop only — mobile gets FAB below */}
            <button
              onClick={openCreate}
              className="hidden sm:block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
            >
              + Create Event
            </button>
          </div>

          {/* Row 2: Timezone toggle */}
          {tripTimezone && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setUseEventTimezone(false)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    !useEventTimezone ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Time
                  <span className="ml-1 text-slate-500 hidden sm:inline">
                    ({browserTimezone.split('/').pop()?.replace('_', ' ')})
                  </span>
                </button>
                <button
                  onClick={() => setUseEventTimezone(true)}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    useEventTimezone ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Event Time
                  <span className="ml-1 text-slate-500 hidden sm:inline">
                    ({tripTimezone.split('/').pop()?.replace('_', ' ')})
                  </span>
                </button>
              </div>
              <p className="text-slate-600 text-xs">
                {displayTimezone}
              </p>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="rounded-xl p-3 md:p-6 calendar-container border" style={{ backgroundColor: "var(--theme-surface)", borderColor: "var(--theme-border)" }}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
            headerToolbar={isMobile ? {
              left: 'prev,next',
              center: 'title',
              right: 'listWeek,listMonth',
            } : {
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={calendarEvents}
            eventClick={handleEventClick}
            height="auto"
            eventDisplay="block"
            timeZone="local"
            views={{
              listWeek: { buttonText: 'Week' },
              listMonth: { buttonText: 'Month' },
            }}
          />
        </div>

        {!tripTimezone && (
          <p className="text-slate-600 text-xs mt-2 text-right">
            Showing times in: {browserTimezone}
          </p>
        )}

        {/* FAB — mobile only */}
        <button
          onClick={openCreate}
          className="sm:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-colors"
          aria-label="Create event"
        >
          <Plus className="w-6 h-6" />
        </button>

      </div>

      {modalOpen && (
        <EventModal
          event={editingEvent}
          participants={participants}
          groups={groups}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}