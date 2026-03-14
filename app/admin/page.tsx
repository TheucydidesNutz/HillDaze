'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/types'
import { getCurrentTrip } from '@/lib/tripContext'
import LogoutButton from '@/components/LogoutButton'
import BroadcastComposer from '@/components/BroadcastComposer'

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
              <img src={trip.logo_url} alt={trip.title}
                className="w-14 h-14 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0" />
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
          <a href="/admin/participants" className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-6 transition-colors group">
            <div className="text-2xl mb-3">👥</div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">Participants</h3>
            <p className="text-slate-400 text-sm">Manage your attendees</p>
          </a>
          <a href="/admin/groups" className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-6 transition-colors group">
            <div className="text-2xl mb-3">🏷️</div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">Groups</h3>
            <p className="text-slate-400 text-sm">Manage group assignments</p>
          </a>
          <a href="/admin/events" className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-6 transition-colors group">
            <div className="text-2xl mb-3">📅</div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">Schedule</h3>
            <p className="text-slate-400 text-sm">Calendar & activities</p>
          </a>
          <a href="/admin/notes" className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-6 transition-colors group">
            <div className="text-2xl mb-3">📝</div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">Notes Feed</h3>
            <p className="text-slate-400 text-sm">Participant submissions</p>
          </a>
          <a href="/admin/import" className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-6 transition-colors group">
            <div className="text-2xl mb-3">📥</div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">Import</h3>
            <p className="text-slate-400 text-sm">CSV participants & ICS calendar</p>
          </a>
          <a href="/admin/file_management" className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-6 transition-colors group">
            <div className="text-2xl mb-3">⚙️</div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">File Management</h3>
            <p className="text-slate-400 text-sm">Fact sheets & configuration</p>
          </a>
        </div>

        {/* Broadcast composer */}
        <BroadcastComposer />
      </div>
    </div>
  )
}