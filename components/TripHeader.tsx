'use client'

import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/events/types'
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
    const start = new Date(trip.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          {trip.logo_url ? (
            <img src={trip.logo_url} alt={trip.title}
              className="w-14 h-14 rounded-xl object-contain p-1 flex-shrink-0"
              style={{ backgroundColor: 'var(--theme-secondary)' }} />
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--theme-primary)' }}>
              <span className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{trip.title.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate" style={{ color: 'var(--theme-text)' }}>{trip.title}</h1>
            {formatDateRange() && (
              <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{formatDateRange()}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => router.push('/home')}
            className="text-sm transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            Home
          </button>
          <button
            onClick={() => router.push('/events/admin')}
            className="text-sm transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/events/admin/trips')}
            className="text-sm transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            All Trips
          </button>
          <LogoutButton />
        </div>
      </div>

      {/* Page title sits below the trip header */}
      {pageTitle && (
        <div className="mt-6">
          <h2 className="text-3xl font-bold" style={{ color: 'var(--theme-text)' }}>{pageTitle}</h2>
          {pageSubtitle && <p className="mt-1" style={{ color: 'var(--theme-text-secondary)' }}>{pageSubtitle}</p>}
        </div>
      )}
    </div>
  )
}
