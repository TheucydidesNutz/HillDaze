'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/types'
import { getCurrentTrip } from '@/lib/tripContext'
import LogoutButton from '@/components/LogoutButton'
import BroadcastComposer from '@/components/BroadcastComposer'
import {
  Users,
  Tag,
  CalendarDays,
  NotebookPen,
  Download,
  FolderOpen,
} from 'lucide-react'

const navItems = [
  {
    href: '/admin/participants',
    icon: Users,
    title: 'Participants',
    description: 'Manage your attendees',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    href: '/admin/groups',
    icon: Tag,
    title: 'Groups',
    description: 'Manage group assignments',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    href: '/admin/events',
    icon: CalendarDays,
    title: 'Schedule',
    description: 'Calendar & activities',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    href: '/admin/notes',
    icon: NotebookPen,
    title: 'Notes Feed',
    description: 'Participant submissions',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    href: '/admin/import',
    icon: Download,
    title: 'Import',
    description: 'CSV participants & ICS calendar',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    href: '/admin/file_management',
    icon: FolderOpen,
    title: 'File Management',
    description: 'Fact sheets & configuration',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
]

export default function AdminDashboard() {
  const [trip, setTrip] = useState<Trip | null>(null)
  const router = useRouter()

  useEffect(() => {
    const current = getCurrentTrip()
    if (!current) {
      router.push('/admin/trips')
      return
    }
    setTrip(current)
  }, [router])

  if (!trip) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </div>
  )

  function formatDateRange() {
    if (!trip?.start_date) return null
    const start = new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {trip.logo_url ? (
              <img
                src={trip.logo_url}
                alt={trip.title}
                className="w-14 h-14 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-2xl font-bold">{trip.title.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{trip.title}</h1>
              {formatDateRange() && (
                <p className="text-slate-400 text-sm">{formatDateRange()}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/trips')}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← All Trips
            </button>
            <LogoutButton />
          </div>
        </div>

        {/* Nav Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {navItems.map(({ href, icon: Icon, title, description, color, bg }) => (
            <a
              key={href}
              href={href}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-6 transition-all group hover:bg-slate-800/50"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${bg} mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">{title}</h3>
              <p className="text-slate-400 text-sm">{description}</p>
            </a>
          ))}
        </div>

        {/* Broadcast composer */}
        <BroadcastComposer />

      </div>
    </div>
  )
}