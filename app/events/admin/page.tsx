'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/events/types'
import { getCurrentTrip } from '@/lib/events/tripContext'
import LogoutButton from '@/components/LogoutButton'
import BroadcastComposer from '@/components/events/BroadcastComposer'
import GuidedTour from '@/components/events/GuidedTour'
import {
  Users,
  Tag,
  CalendarDays,
  NotebookPen,
  Download,
  FolderOpen,
  BookOpen,
} from 'lucide-react'

const navItems = [
  {
    href: '/events/admin/participants',
    icon: Users,
    title: 'Participants',
    description: 'Manage your attendees',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    tourId: 'tile-participants',
  },
  {
    href: '/events/admin/groups',
    icon: Tag,
    title: 'Groups',
    description: 'Manage group assignments',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    tourId: 'tile-groups',
  },
  {
    href: '/events/admin/events',
    icon: CalendarDays,
    title: 'Schedule',
    description: 'Calendar & activities',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    tourId: 'tile-schedule',
  },
  {
    href: '/events/admin/notes',
    icon: NotebookPen,
    title: 'Notes Feed',
    description: 'Participant submissions',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    tourId: 'tile-notes',
  },
  {
    href: '/events/admin/import',
    icon: Download,
    title: 'Import',
    description: 'CSV participants & ICS calendar',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    tourId: 'tile-import',
  },
  {
    href: '/events/admin/file_management',
    icon: FolderOpen,
    title: 'File Management',
    description: 'Fact sheets & configuration',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    tourId: 'tile-files',
  },
  {
    href: '/events/admin/guide',
    icon: BookOpen,
    title: 'Guide',
    description: 'How to use this app',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    tourId: 'tile-guide',
  },
]

export default function AdminDashboard() {
  const [trip, setTrip] = useState<Trip | null>(null)
  const router = useRouter()

  useEffect(() => {
    const current = getCurrentTrip()
    if (!current) {
      router.push('/events/admin/trips')
      return
    }
    setTrip(current)
  }, [router])

  if (!trip) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </div>
  )

  function formatDateRange() {
    if (!trip?.start_date) return null
    const start = new Date(trip.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {trip.logo_url ? (
              <img
                src={trip.logo_url}
                alt={trip.title}
                className="w-14 h-14 rounded-xl object-contain p-1 flex-shrink-0"
                style={{ backgroundColor: 'var(--theme-secondary)' }}
              />
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--theme-primary)' }}>
                <span className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{trip.title.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{trip.title}</h1>
              {formatDateRange() && (
                <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{formatDateRange()}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/events/admin/trips')}
              className="text-sm transition-colors"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              ← All Trips
            </button>
            <LogoutButton />
          </div>
        </div>

        {/* Nav Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" data-tour="nav-grid">
          {navItems.map(({ href, icon: Icon, title, description, color, bg, tourId }) => (
            <a
              key={href}
              href={href}
              data-tour={tourId}
              className="rounded-xl p-6 transition-all group border"
              style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${bg} mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--theme-text)' }}>{title}</h3>
              <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{description}</p>
            </a>
          ))}
        </div>

        {/* Broadcast composer */}
        <div data-tour="broadcast">
          <BroadcastComposer />
        </div>

        <GuidedTour />

      </div>
    </div>
  )
}