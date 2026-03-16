'use client'

import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { Participant, Group, Trip } from '@/lib/types'
import EventModal from '@/components/EventModal'
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
}

export default function EventsPage() {
  const router = useRouter()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [useEventTimezone, setUseEventTimezone] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const tripTimezone = (trip as any)?.timezone || null
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const activeTimezone = useEventTimezone && tripTimezone ? tripTimezone : undefined

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/admin/trips'); return }
    setTrip(JSON.parse(tripStr))
    fetchData()
  }, [])

  async function fetchData() {
    const [eRes, pRes, gRes] = await Promise.all([
      apiFetch('/api/admin/events'),
      apiFetch('/api/admin/participants'),
      apiFetch('/api/admin/groups'),
    ])
    const [eData, pData, gData] = await Promise.all([
      eRes.json(), pRes.json(), gRes.json()
    ])
    setEvents(eData)
    setParticipants(pData)
    setGroups(gData)
  }

  function handleEventClick(info: any) {
    const event = events.find(e => e.id === info.event.id)
    if (event) {
      setEditingEvent(event)
      setModalOpen(true)
    }
  }

  function handleSaved(saved: CalendarEvent) {
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

  const calendarEvents = events.map(e => ({
    id: e.id,
    title: e.title,
    start: e.start_time,
    end: e.end_time,
    backgroundColor: e.type === 'mandatory' ? '#EF4444' : '#3B82F6',
    borderColor: e.type === 'mandatory' ? '#DC2626' : '#2563EB',
    extendedProps: { location: e.location, description: e.description, type: e.type }
  }))

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
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
            </div>

            {/* Desktop only — mobile gets FAB below */}
            <button
              onClick={openCreate}
              className="hidden sm:block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
            >
              + Create Event
            </button>
          </div>

          {/* Row 2: Timezone toggle (only if trip has timezone) */}
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
                {useEventTimezone && tripTimezone ? tripTimezone : browserTimezone}
              </p>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-6 calendar-container">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            // FIX: list view on mobile, month grid on desktop
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
            timeZone={activeTimezone || 'local'}
            // Make list view labels friendlier
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