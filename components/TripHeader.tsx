'use client'

import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/types'
import LogoutButton from '@/components/LogoutButton'

interface TripHeaderProps {
  trip: Trip
  pageTitle?: string
  pageSubtitle?: string
}

export default function TripHeader({ trip, pageTitle, pageSubtitle }: TripHeaderProps) {
  const router = useRouter()

  function formatDateRange() {
    if (!trip.start_date) return null
    const start = new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
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
            onClick={() => router.push('/admin')}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← Dashboard
          </button>
          <button
            onClick={() => router.push('/admin/trips')}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            All Trips
          </button>
          <LogoutButton />
        </div>
      </div>

      {/* Page title sits below the trip header */}
      {pageTitle && (
        <div className="mt-6">
          <h2 className="text-3xl font-bold text-white">{pageTitle}</h2>
          {pageSubtitle && <p className="text-slate-400 mt-1">{pageSubtitle}</p>}
        </div>
      )}
    </div>
  )
}