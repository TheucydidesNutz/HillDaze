'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import { Event } from '@/lib/types'
import { useState } from 'react'

interface Props {
  events: Event[]
}

export default function AttendeeCalendar({ events }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const calendarEvents = events.map(e => ({
    id: e.id,
    title: e.title,
    start: e.start_time,
    end: e.end_time,
    backgroundColor: e.type === 'mandatory' ? '#EF4444' : '#3B82F6',
    borderColor: e.type === 'mandatory' ? '#DC2626' : '#2563EB',
  }))

  function handleEventClick(info: any) {
    const event = events.find(e => e.id === info.event.id)
    if (event) setSelectedEvent(event)
  }

  return (
    <>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek'
        }}
        events={calendarEvents}
        eventClick={handleEventClick}
        height="auto"
        eventDisplay="block"
      />

      {/* Event detail popover */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEvent(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${selectedEvent.type === 'mandatory' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                <span className={`text-xs font-medium ${selectedEvent.type === 'mandatory' ? 'text-red-400' : 'text-blue-400'}`}>
                  {selectedEvent.type === 'mandatory' ? 'Mandatory' : 'Optional'}
                </span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">{selectedEvent.title}</h3>
            <p className="text-slate-300 text-sm mb-1">
              🕐 {new Date(selectedEvent.start_time).toLocaleString()} — {new Date(selectedEvent.end_time).toLocaleTimeString()}
            </p>
            {selectedEvent.location && <p className="text-slate-300 text-sm mb-1">📍 {selectedEvent.location}</p>}
            {selectedEvent.description && <p className="text-slate-400 text-sm mt-3">{selectedEvent.description}</p>}
          </div>
        </div>
      )}
    </>
  )
}