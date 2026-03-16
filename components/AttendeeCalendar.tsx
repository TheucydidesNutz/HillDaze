'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import { Event } from '@/lib/types'
import { useState } from 'react'
import { Clock, MapPin } from 'lucide-react'

interface Props {
  events: Event[]
  timezone?: string
}

export default function AttendeeCalendar({ events, timezone }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000)

  const calendarEvents = events.map(e => {
    const recentlyUpdated = e.updated_at && new Date(e.updated_at) > ONE_HOUR_AGO &&
      new Date(e.updated_at) > new Date(e.created_at)
    return {
      id: e.id,
      title: recentlyUpdated ? `⚡ ${e.title}` : e.title,
      start: e.start_time,
      end: e.end_time,
      backgroundColor: recentlyUpdated ? '#D97706' : e.type === 'mandatory' ? '#EF4444' : '#3B82F6',
      borderColor: recentlyUpdated ? '#B45309' : e.type === 'mandatory' ? '#DC2626' : '#2563EB',
    }
  })

  function handleEventClick(info: any) {
    const event = events.find(e => e.id === info.event.id)
    if (event) setSelectedEvent(event)
  }

  function formatTime(utcStr: string, opts: Intl.DateTimeFormatOptions) {
    return new Date(utcStr).toLocaleString('en-US', {
      ...opts,
      timeZone: timezone || undefined,
    })
  }

  return (
    <>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
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
        timeZone={timezone || 'local'}
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
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">{selectedEvent.title}</h3>
            <p className="text-slate-300 text-sm mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {formatTime(selectedEvent.start_time, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              {' — '}
              {formatTime(selectedEvent.end_time, { hour: 'numeric', minute: '2-digit' })}
            </p>
            {timezone && (
              <p className="text-slate-600 text-xs mb-1 ml-5">{timezone}</p>
            )}
            {selectedEvent.location && (
              <p className="text-slate-300 text-sm mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {selectedEvent.location}
              </p>
            )}
            {selectedEvent.description && (
              <p className="text-slate-400 text-sm mt-3">{selectedEvent.description}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}