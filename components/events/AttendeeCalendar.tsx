'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import { Event, MeetingContact } from '@/lib/events/types'
import { useState, useMemo, useCallback } from 'react'
import { Clock, MapPin, X, NotebookPen, Users, ChevronDown, ChevronUp } from 'lucide-react'

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
  alertColor?: string
  onNoteAboutEvent?: (eventContext: EventContext) => void
}

export default function AttendeeCalendar({ events, timezone, alertColor = '#D97706', onNoteAboutEvent }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(null)
  const [meetingWithOpen, setMeetingWithOpen] = useState(false)

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

  // Convert an IANA timezone to an offset string at the moment of a given date
  function getTimezoneOffset(dateStr: string, tz: string): string {
    try {
      const date = new Date(dateStr)
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }))
      const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / 60000
      const sign = offsetMinutes >= 0 ? '+' : '-'
      const absMinutes = Math.abs(offsetMinutes)
      const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0')
      const mins = String(absMinutes % 60).padStart(2, '0')
      return `${sign}${hours}:${mins}`
    } catch {
      return '+00:00'
    }
  }

  const calendarEvents = events.map(e => {
    // Show orange if event was updated within the last 3 hours
    const threeHoursMs = 3 * 60 * 60 * 1000
    const recentlyUpdated = e.updated_at && e.created_at &&
      new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 2000 &&
      Date.now() - new Date(e.updated_at).getTime() < threeHoursMs

    // Apply trip timezone offset so FullCalendar can convert correctly
    let start = e.start_time
    let end = e.end_time
    if (timezone) {
      const cleanStart = e.start_time?.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
      const cleanEnd = e.end_time?.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
      const startOffset = getTimezoneOffset(e.start_time, timezone)
      const endOffset = getTimezoneOffset(e.end_time || e.start_time, timezone)
      start = `${cleanStart}${startOffset}`
      end = `${cleanEnd}${endOffset}`
    }

    return {
      id: e.id,
      title: recentlyUpdated ? `⚡ ${e.title}` : e.title,
      start,
      end,
      backgroundColor: recentlyUpdated ? alertColor : e.type === 'mandatory' ? '#EF4444' : '#3B82F6',
      borderColor: recentlyUpdated ? alertColor : e.type === 'mandatory' ? '#DC2626' : '#2563EB',
    }
  })

  function handleEventClick(info: any) {
    const event = events.find(e => e.id === info.event.id)
    if (event) {
      setSelectedEvent(event)
      setMeetingWithOpen(false)
    }
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

  const meetingContacts: MeetingContact[] = selectedEvent?.meeting_with
    ? [...selectedEvent.meeting_with].sort((a, b) => a.sort_order - b.sort_order)
    : []

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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto"
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

            {/* Meeting With — clickable dropdown */}
            {meetingContacts.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setMeetingWithOpen(prev => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    Meeting With ({meetingContacts.length})
                  </span>
                  {meetingWithOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {meetingWithOpen && (
                  <div className="mt-2 space-y-2">
                    {meetingContacts.map((contact, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg">
                        {contact.photo_url ? (
                          <img
                            src={contact.photo_url}
                            alt={contact.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-600 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 text-xs font-medium shrink-0">
                            {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{contact.name}</p>
                          {contact.title && (
                            <p className="text-slate-400 text-xs truncate">{contact.title}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Talking Points */}
            {selectedEvent.talking_points && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500 mb-1">Talking Points</p>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{selectedEvent.talking_points}</p>
              </div>
            )}

            {selectedEvent.description && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
                <p className="text-slate-400 text-sm">{selectedEvent.description}</p>
              </div>
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
