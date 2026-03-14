'use client'

import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { Participant, Group } from '@/lib/types'
import EventModal from '@/components/EventModal'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'

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
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/admin/trips'); return }
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
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/admin" className="text-slate-400 text-sm hover:text-white mb-1 block">
              ← Dashboard
            </a>
            <h1 className="text-3xl font-bold text-white">Schedule</h1>
            <p className="text-slate-400 mt-1">{events.length} events scheduled</p>
          </div>
          <div className="flex items-center gap-4">
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
            <button
              onClick={() => { setEditingEvent(null); setModalOpen(true) }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              + Create Event
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 calendar-container">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={calendarEvents}
            eventClick={handleEventClick}
            height="auto"
            eventDisplay="block"
          />
        </div>
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