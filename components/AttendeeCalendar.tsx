'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import { Event } from '@/lib/types'
import { useState, useMemo, useCallback } from 'react'
import { Clock, MapPin, X, NotebookPen } from 'lucide-react'

interface EventContext {
  id: string
  title: string
  start_time: string
  end_time: string
  location: string | null
  type: string
  description: string | null
}

interface Props {
  events: Event[]
  timezone?: string
  onNoteAboutEvent?: (eventContext: EventContext) => void
}

export default function AttendeeCalendar({ events, timezone, onNoteAboutEvent }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(null)

  const timeBounds = useMemo(() => {
    if (!viewRange) return { slotMinTime: '08:00:00', slotMaxTime: '18:00:00' }
    const visibleEvents = events.filter(e => {
      const start = new Date(e.start_time)
      return start >= viewRange.start && start < viewRange.end
    })
    if (visibleEvents.length === 0) {
      return { slotMinTime: '08:00:00', slotMaxTime: '18:00:00' }
    }
    const earliestHour = Math.min(...visibleEvents.map(e => new Date(e.start_time).getHours()))
    const latestHour = Math.max(...visibleEvents.map(e => {
      const end = new Date(e.end_time)
      return end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours()
    }))
    return {
      slotMinTime: `${String(Math.max(earliestHour - 1, 6)).padStart(2, '0')}:00:00`,
      slotMaxTime: `${String(Math.min(latestHour + 1, 23)).padStart(2, '0')}:00:00`,
    }
  }, [events, viewRange])

  const handleDatesSet = useCallback((dateInfo: any) => {
    setViewRange({ start: dateInfo.start, end: dateInfo.end })
  }, [])

  const calendarEvents = events.map(e => {
    // Show orange if event was ever modified after creation (2s threshold for trigger timing)
    const recentlyUpdated = e.updated_at && e.created_at &&
      new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 2000
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

  function handleNoteAboutEvent() {
    if (!selectedEvent || !onNoteAboutEvent) return
    const context: EventContext = {
      id: selectedEvent.id,
      title: selectedEvent.title,
      start_time: selectedEvent.start_time,
      end_time: selectedEvent.end_time,
      location: selectedEvent.location || null,
      type: selectedEvent.type || 'optional',
      description: selectedEvent.description || null,
    }
    setSelectedEvent(null)
    onNoteAboutEvent(context)
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
        initialView="dayGridDay"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        events={calendarEvents}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        slotMinTime={timeBounds.slotMinTime}
        slotMaxTime={timeBounds.slotMaxTime}
        height={events.length === 0 ? 300 : 'auto'}
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

            {/* Make a note about this event */}
            {onNoteAboutEvent && (
              <button
                onClick={handleNoteAboutEvent}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
              >
                <NotebookPen className="w-4 h-4" />
                Make a note about this event
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
