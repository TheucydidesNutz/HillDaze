'use client'

import { useState, useEffect, useRef } from 'react'
import { Participant, Group, Event, Trip } from '@/lib/types'
import AttendeeCalendar from '@/components/AttendeeCalendar'
import JournalSection from '@/components/JournalSection'
import MapModal from '@/components/MapModal'
import BroadcastFeed from '@/components/BroadcastFeed'
import {
  Phone,
  Mail,
  Tag,
  Plane,
  Hotel,
  PartyPopper,
  CalendarDays,
  FolderOpen,
  NotebookPen,
  Map,
  FileText,
  Camera,
  Smartphone,
  X,
  ExternalLink,
  Zap,
} from 'lucide-react'

interface FactSheet {
  id: string
  label: string
  file_url: string
  is_active: boolean
}

interface Document {
  id: string
  label: string
  file_url: string
  file_type: string
  doc_type: string
}

interface MapDoc {
  id: string
  label: string
  file_url: string
  file_type: string
}

interface PageData {
  participant: Participant & { group: Group | null }
  events: Event[]
  factSheet: FactSheet | null
  trip: Trip | null
}

interface EventContext {
  id: string
  title: string
  start_time: string
  end_time: string
  location: string | null
  type: string
  description: string | null
}

export default function AttendeePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string>('')
  const [data, setData] = useState<PageData | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [map, setMap] = useState<MapDoc | null>(null)
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [useEventTimezone, setUseEventTimezone] = useState(true)

  // Change 1: Event-linked notes state
  const [eventContext, setEventContext] = useState<EventContext | null>(null)
  const journalRef = useRef<HTMLDivElement>(null)

  // Change 2: Trip photo album state
  const [uploadingAlbumPhoto, setUploadingAlbumPhoto] = useState(false)
  const [albumPhotoSuccess, setAlbumPhotoSuccess] = useState(false)
  const albumPhotoInputRef = useRef<HTMLInputElement>(null)

  // Change 3: Calendar download state
  const [downloadingCalendar, setDownloadingCalendar] = useState(false)

  // Fact sheet — opens in new browser tab
  const [loadingFactSheet, setLoadingFactSheet] = useState(false)

  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    params.then(async ({ token: t }) => {
      setToken(t)
      const [attendeeRes, mapRes] = await Promise.all([
        fetch(`/api/attendee/${t}`),
        fetch(`/api/attendee/map?token=${t}`),
      ])
      const [attendeeData, mapData] = await Promise.all([
        attendeeRes.json(),
        mapRes.json(),
      ])
      if (attendeeData.error) setError(attendeeData.error)
      else setData(attendeeData)
      if (mapData.map) setMap(mapData.map)
      const docsRes = await fetch(`/api/attendee/documents?token=${t}`)
      const docsData = await docsRes.json()
      if (Array.isArray(docsData)) setDocuments(docsData)
      setLoading(false)
    })
  }, [params])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    if (ios) {
      const timer = setTimeout(() => setShowInstallBanner(true), 3000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setShowInstallBanner(false)
      }
      setInstallPrompt(null)
    }
  }

  async function handleFactSheetOpen() {
    if (!data?.factSheet) return
    const newTab = window.open('about:blank', '_blank')
    setLoadingFactSheet(true)
    const res = await fetch(`/api/admin/upload/pdf/signed-url?path=${encodeURIComponent(data.factSheet.file_url)}`)
    const { url } = await res.json()
    setLoadingFactSheet(false)
    if (newTab) newTab.location.href = url
  }

  async function handleDocOpen(doc: Document) {
    const newTab = window.open('about:blank', '_blank')
    const res = await fetch(`/api/admin/upload/pdf/signed-url?path=${encodeURIComponent(doc.file_url)}`)
    const { url } = await res.json()
    if (newTab) newTab.location.href = url
  }

  async function handleMapOpen() {
    if (!map) return
    const res = await fetch(`/api/admin/upload/pdf/signed-url?path=${encodeURIComponent(map.file_url)}`)
    const { url } = await res.json()
    setMapUrl(url)
    setShowMap(true)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingPhoto(true)
    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('token', token)
    const res = await fetch('/api/attendee/upload-photo', { method: 'POST', body: formData })
    const result = await res.json()
    setUploadingPhoto(false)
    if (!res.ok) {
      setPhotoPreview(null)
      alert(result.error || 'Photo upload failed')
    } else {
      setData(prev => prev ? {
        ...prev,
        participant: { ...prev.participant, photo_url: result.url }
      } : prev)
    }
  }

  // Change 1: Handle event note link from calendar popup
  function handleNoteAboutEvent(ctx: EventContext) {
    setEventContext(ctx)
    // Smooth scroll to journal section
    setTimeout(() => {
      journalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Change 2: Handle trip album photo upload
  async function handleAlbumPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setUploadingAlbumPhoto(true)
    setAlbumPhotoSuccess(false)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('token', token)
    try {
      const res = await fetch('/api/attendee/upload-photo-album', { method: 'POST', body: formData })
      if (res.ok) {
        setAlbumPhotoSuccess(true)
        setTimeout(() => setAlbumPhotoSuccess(false), 4000)
      } else {
        const result = await res.json()
        alert(result.error || 'Photo upload failed')
      }
    } catch {
      alert('Photo upload failed. Please try again.')
    }
    setUploadingAlbumPhoto(false)
    // Reset file input so the same file can be re-selected
    if (albumPhotoInputRef.current) albumPhotoInputRef.current.value = ''
  }

  // Change 3: Handle ICS calendar download
  async function handleCalendarDownload() {
    if (!token) return
    setDownloadingCalendar(true)
    try {
      const res = await fetch(`/api/attendee/calendar?token=${token}`)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Extract filename from Content-Disposition header, or use default
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^"]+)"?/)
      a.download = match ? match[1] : 'schedule.ics'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download calendar. Please try again.')
    }
    setDownloadingCalendar(false)
  }

  function formatDateRange(trip: Trip) {
    if (!trip.start_date) return null
    const start = new Date(trip.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
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

  const { participant, events, factSheet, trip } = data
  const p = participant
  const currentPhoto = photoPreview || p.photo_url
  const tripTitle = trip?.title || 'HillDayTracker'
  const tripLogo = trip?.logo_url
  const tripTimezone = (trip as any)?.timezone || null
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const activeTimezone = useEventTimezone && tripTimezone ? tripTimezone : undefined

  return (
    <div className="min-h-screen bg-slate-950">

      {token && (
        <>
          <link rel="manifest" href={`/attendee/${token}/manifest`} />
          <meta name="theme-color" content="#020617" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content={tripTitle} />
        </>
      )}

      {/* iOS install banner */}
      {showInstallBanner && isIOS && !isInstalled && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-slate-900 border-t border-slate-700">
          <div className="flex items-start gap-3 max-w-4xl mx-auto">
            {tripLogo ? (
              <img src={tripLogo} className="w-12 h-12 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0" alt={tripTitle} />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">{tripTitle.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Add to Home Screen</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Tap <span className="text-blue-400">Share</span> then{' '}
                <span className="text-blue-400">Add to Home Screen</span> to install {tripTitle}
              </p>
            </div>
            <button onClick={() => setShowInstallBanner(false)} className="text-slate-500 hover:text-white flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Android/Chrome install banner */}
      {showInstallBanner && !isIOS && installPrompt && !isInstalled && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-slate-900 border-t border-slate-700">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            {tripLogo ? (
              <img src={tripLogo} className="w-12 h-12 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0" alt={tripTitle} />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">{tripTitle.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Add to Home Screen</p>
              <p className="text-slate-400 text-xs mt-0.5">Install {tripTitle} for quick access</p>
            </div>
            <button onClick={() => setShowInstallBanner(false)} className="text-slate-500 hover:text-white mr-2 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
            <button onClick={handleInstall}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0">
              Install
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tripLogo ? (
              <img src={tripLogo} alt={tripTitle} className="w-10 h-10 rounded-lg object-contain bg-slate-800 p-0.5" />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{tripTitle.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{tripTitle}</p>
              {trip && formatDateRange(trip) && (
                <p className="text-slate-400 text-xs">{formatDateRange(trip)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {map && (
              <button onClick={handleMapOpen}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">
                <Map className="w-4 h-4" />
                Map
              </button>
            )}
            {factSheet && (
              <button
                onClick={handleFactSheetOpen}
                disabled={loadingFactSheet}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                {loadingFactSheet ? 'Loading...' : 'Fact Sheet'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Hero Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
                {currentPhoto ? (
                  <img src={currentPhoto} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-3xl font-bold">{p.name.charAt(0)}</span>
                )}
              </div>
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center transition-colors border-2 border-slate-900"
                title="Update photo"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">{p.name}</h1>
              {p.title && <p className="text-slate-300">{p.title}</p>}
              {p.company && <p className="text-slate-400 text-sm">{p.company}</p>}
              <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 mt-2">
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-blue-400 text-sm hover:text-blue-300">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    {p.phone}
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-blue-400 text-sm hover:text-blue-300 min-w-0">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          {!isInstalled && token && (isIOS || installPrompt) && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <button
                onClick={isIOS ? () => setShowInstallBanner(true) : handleInstall}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Add to Home Screen
              </button>
            </div>
          )}
        </div>

        {/* Broadcasts */}
        {token && <BroadcastFeed token={token} />}

        {/* Group Info */}
        {p.group && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" />
              Your Group
            </h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {p.group.lead_photo_url ? (
                  <img src={p.group.lead_photo_url} alt={p.group.lead_name || ''} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-lg font-bold">{p.group.name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium">{p.group.name}</p>
                {p.group.lead_name && <p className="text-slate-300 text-sm">Lead: {p.group.lead_name}</p>}
                <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4 mt-1">
                  {p.group.lead_phone && (
                    <a href={`tel:${p.group.lead_phone}`} className="flex items-center gap-1.5 text-blue-400 text-sm hover:text-blue-300">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      {p.group.lead_phone}
                    </a>
                  )}
                  {p.group.lead_email && (
                    <a href={`mailto:${p.group.lead_email}`} className="flex items-center gap-1.5 text-blue-400 text-sm hover:text-blue-300 min-w-0">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{p.group.lead_email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flights */}
        {(p.arrival_airline || p.departure_airline) && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Plane className="w-4 h-4 text-cyan-400" />
              Flights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {p.arrival_airline && (
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Arrival</p>
                  <p className="text-white font-medium">{p.arrival_airline} {p.arrival_flight_no}</p>
                  {p.arrival_datetime && <p className="text-slate-300 text-sm">{new Date(p.arrival_datetime).toLocaleString()}</p>}
                  {p.arrival_airport && <p className="text-slate-400 text-sm flex items-center gap-1"><Plane className="w-3 h-3" />{p.arrival_airport}</p>}
                </div>
              )}
              {p.departure_airline && (
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Departure</p>
                  <p className="text-white font-medium">{p.departure_airline} {p.departure_flight_no}</p>
                  {p.departure_datetime && <p className="text-slate-300 text-sm">{new Date(p.departure_datetime).toLocaleString()}</p>}
                  {p.departure_airport && <p className="text-slate-400 text-sm flex items-center gap-1"><Plane className="w-3 h-3" />{p.departure_airport}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hotel */}
        {p.hotel_name && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Hotel className="w-4 h-4 text-green-400" />
              Hotel
            </h2>
            <p className="text-white text-lg">{p.hotel_name}</p>
            {p.hotel_room && <p className="text-slate-400">Room {p.hotel_room}</p>}
          </div>
        )}

        {/* Fun Diversions */}
        {p.fun_diversions && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <PartyPopper className="w-4 h-4 text-yellow-400" />
              Fun Diversions
            </h2>
            <p className="text-slate-300 whitespace-pre-wrap">{p.fun_diversions}</p>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              Your Schedule
            </h2>
            {tripTimezone && (
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setUseEventTimezone(false)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    !useEventTimezone ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Time
                </button>
                <button
                  onClick={() => setUseEventTimezone(true)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    useEventTimezone ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Event Time
                </button>
              </div>
            )}
          </div>
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
              <span className="text-slate-400 flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Recently updated</span>
            </span>
          </div>
          <AttendeeCalendar
            events={events}
            timezone={activeTimezone}
            onNoteAboutEvent={handleNoteAboutEvent}
          />
          {tripTimezone && (
            <p className="text-slate-600 text-xs mt-2 text-right">
              {useEventTimezone ? tripTimezone : browserTimezone}
            </p>
          )}

          {/* Change 3: Download calendar button */}
          {events.length > 0 && (
            <button
              onClick={handleCalendarDownload}
              disabled={downloadingCalendar}
              className="mt-4 flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50"
            >
              <CalendarDays className="w-4 h-4" />
              {downloadingCalendar ? 'Downloading...' : 'Add to Calendar (Google, Apple, Outlook)'}
            </button>
          )}
        </div>

        {/* Your Documents */}
        {documents.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-orange-400" />
              Your Documents
            </h2>
            <p className="text-slate-500 text-xs mb-4 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Opens in a new tab
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => handleDocOpen(doc)}
                  className="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    {doc.file_type === 'pdf'
                      ? <FileText className="w-4 h-4 text-orange-400" />
                      : <FolderOpen className="w-4 h-4 text-orange-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.label}</p>
                    <p className="text-slate-400 text-xs">{doc.file_type === 'pdf' ? 'PDF Document' : 'Image'}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Journal */}
        <div ref={journalRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <NotebookPen className="w-4 h-4 text-yellow-400" />
            Notes & Journal
          </h2>
          <JournalSection
            token={token}
            eventContext={eventContext}
            onNoteSubmitted={() => setEventContext(null)}
          />
        </div>

        {/* Change 2: Trip Photos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Camera className="w-4 h-4 text-pink-400" />
            Trip Photos
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => albumPhotoInputRef.current?.click()}
              disabled={uploadingAlbumPhoto}
              className="flex items-center gap-3 w-full p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-left transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                {uploadingAlbumPhoto ? (
                  <Camera className="w-5 h-5 text-pink-400 animate-pulse" />
                ) : albumPhotoSuccess ? (
                  <Camera className="w-5 h-5 text-green-400" />
                ) : (
                  <Camera className="w-5 h-5 text-pink-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">
                  {uploadingAlbumPhoto
                    ? 'Uploading...'
                    : albumPhotoSuccess
                      ? 'Photo uploaded to trip album'
                      : 'Add a photo to the trip album'
                  }
                </p>
                {!uploadingAlbumPhoto && !albumPhotoSuccess && (
                  <p className="text-slate-500 text-xs mt-0.5">Photos are shared with your group organizer</p>
                )}
              </div>
            </button>
            <input
              ref={albumPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAlbumPhotoUpload}
              className="hidden"
            />
          </div>
        </div>

        {showInstallBanner && !isInstalled && <div className="h-20" />}
      </div>

      {showMap && mapUrl && map && (
        <MapModal mapUrl={mapUrl} mapLabel={map.label} onClose={() => setShowMap(false)} />
      )}
    </div>
  )
}
