'use client'

import { useState, useEffect } from 'react'
import { Trip } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import UsageBanner from '@/components/UsageBanner'

interface TripAdmin {
  id: string
  trip_id: string
  user_id: string
  role: 'super' | 'admin'
  email?: string
}

interface UserSettings {
  org_name: string | null
  logo_url: string | null
  display_name: string | null
  timezone: string | null
}

interface OrgUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  role?: 'super' | 'admin' | null
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editTimezone, setEditTimezone] = useState('')
  const [saving, setSaving] = useState(false)
  const [tripAdmins, setTripAdmins] = useState<TripAdmin[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [deleteStep, setDeleteStep] = useState<{ id: string; step: 1 | 2 } | null>(null)

  // Settings state
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'general' | 'account' | 'users'>('general')
  const [userSettings, setUserSettings] = useState<UserSettings>({ org_name: null, logo_url: null, display_name: null, timezone: null })
  const [settingsOrgName, setSettingsOrgName] = useState('')
  const [settingsDisplayName, setSettingsDisplayName] = useState('')
  const [settingsTimezone, setSettingsTimezone] = useState('America/New_York')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchTrips()
    fetchUserInfo()
  }, [])

  async function fetchUserInfo() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)
    setCurrentUserEmail(user.email ?? null)

    const { data } = await supabase
      .from('user_settings')
      .select('org_name, logo_url, display_name, timezone')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setUserSettings(data)
      setSettingsOrgName(data.org_name || '')
      setSettingsDisplayName(data.display_name || '')
      setSettingsTimezone(data.timezone || 'America/New_York')
    }
  }

  async function fetchTrips() {
    const res = await fetch('/api/admin/trips')
    const data = await res.json()
    setTrips(data)
    setLoading(false)
    if (Array.isArray(data) && data.some((t: Trip) => t.role === 'super')) {
      setIsSuperAdmin(true)
    }
  }

  async function fetchTripAdmins(tripId: string) {
    const res = await fetch(`/api/admin/trips/${tripId}/invite`)
    const data = await res.json()
    setTripAdmins(Array.isArray(data) ? data : [])
  }

  async function fetchOrgUsers() {
    setLoadingUsers(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setOrgUsers(Array.isArray(data) ? data : [])
    setLoadingUsers(false)
  }

  async function handleCreate() {
    if (!newTitle.trim()) return alert('Title required')
    setCreating(true)
    const res = await fetch('/api/admin/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        start_date: newStart,
        end_date: newEnd,
        timezone: userSettings.timezone || 'America/New_York',
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      setTrips(prev => [...prev, data])
      setShowNew(false)
      setNewTitle('')
      setNewStart('')
      setNewEnd('')
    } else {
      alert(data.error)
    }
  }

  async function handleSaveEdit() {
    if (!editingTrip || !editTitle.trim()) return
    setSaving(true)
    const res = await fetch(`/api/admin/trips/${editingTrip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        start_date: editStart || null,
        end_date: editEnd || null,
        timezone: editTimezone || 'America/New_York',
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setTrips(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t))
      setEditingTrip(null)
    } else alert(data.error)
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !editingTrip) return
    setInviting(true)
    setInviteMessage('')
    const res = await fetch(`/api/admin/trips/${editingTrip.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    setInviting(false)
    if (res.ok) {
      setInviteMessage(`✓ ${data.message}`)
      setInviteEmail('')
      fetchTripAdmins(editingTrip.id)
    } else {
      setInviteMessage(`✗ ${data.error}`)
    }
  }

  async function handleRemoveAdmin(userId: string) {
    if (!editingTrip) return
    if (!confirm('Remove this admin from the trip?')) return
    await fetch(`/api/admin/trips/${editingTrip.id}/invite?user_id=${userId}`, { method: 'DELETE' })
    setTripAdmins(prev => prev.filter(a => a.user_id !== userId))
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/trips/${id}`, { method: 'DELETE' })
    setTrips(prev => prev.filter(t => t.id !== id))
    setDeleteStep(null)
  }

  function openEdit(trip: Trip) {
    const fullTrip = trips.find(t => t.id === trip.id) || trip
    setEditingTrip(fullTrip)
    setEditTitle(fullTrip.title)
    setEditStart(fullTrip.start_date || '')
    setEditEnd(fullTrip.end_date || '')
    setEditTimezone((fullTrip as any).timezone || userSettings.timezone || 'America/New_York')
    setInviteMessage('')
    setInviteEmail('')
    fetchTripAdmins(fullTrip.id)
  }

  async function handleSaveSettings() {
    if (!currentUserId) return
    setSavingSettings(true)
    setSettingsMessage('')

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: currentUserId,
        org_name: settingsOrgName.trim() || null,
        display_name: settingsDisplayName.trim() || null,
        timezone: settingsTimezone,
        updated_at: new Date().toISOString(),
      })

    setSavingSettings(false)
    if (error) {
      setSettingsMessage('✗ Failed to save settings')
    } else {
      setUserSettings(prev => ({
        ...prev,
        org_name: settingsOrgName.trim() || null,
        display_name: settingsDisplayName.trim() || null,
        timezone: settingsTimezone,
      }))
      setSettingsMessage('✓ Settings saved')
      setShowSettings(false)
      setTimeout(() => setSettingsMessage(''), 3000)
    }
  }

  async function handleOrgLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    setUploadingLogo(true)

    const ext = file.name.split('.').pop()
    const path = `${currentUserId}/org-logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('org-logos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setSettingsMessage(`✗ Logo upload failed: ${uploadError.message}`)
      setUploadingLogo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('org-logos')
      .getPublicUrl(path)

    const { error: dbError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: currentUserId,
        logo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })

    setUploadingLogo(false)
    if (!dbError) {
      setUserSettings(prev => ({ ...prev, logo_url: publicUrl }))
      setSettingsMessage('✓ Logo updated')
      setTimeout(() => setSettingsMessage(''), 3000)
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      setPasswordMessage('✗ Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage('✗ Password must be at least 6 characters')
      return
    }
    setChangingPassword(true)
    setPasswordMessage('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) {
      setPasswordMessage(`✗ ${error.message}`)
    } else {
      setPasswordMessage('✓ Password updated')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(''), 3000)
    }
  }

  async function handleToggleUserRole(userId: string, currentRole: 'super' | 'admin') {
    const newRole = currentRole === 'super' ? 'admin' : 'super'
    if (!confirm(`Change this user to ${newRole}?`)) return
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    if (res.ok) {
      setOrgUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ))
    }
  }

  async function handleDeleteUser(userId: string, email: string) {
    if (userId === currentUserId) return alert("You can't delete your own account.")
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    setDeletingUserId(userId)
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setDeletingUserId(null)
    if (res.ok) {
      setOrgUsers(prev => prev.filter(u => u.id !== userId))
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to delete user')
    }
  }

  function formatDateRange(trip: Trip) {
    if (!trip.start_date) return null
    const start = new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  const displayName = userSettings.org_name || '[Your Group]'

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-4">
              {userSettings.logo_url && (
                <img
                  src={userSettings.logo_url}
                  alt="org logo"
                  className="w-36 h-36 object-contain flex-shrink-0 rounded-2xl"
                />
              )}
              <div className="text-center">
                <h1 className="text-4xl font-bold text-white">{displayName}</h1>
                <p className="text-slate-500 text-xs italic mt-0.5">by Covaled</p>
                <p className="text-slate-400 mt-1">Select a Trip to manage</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSettings(true); setSettingsMessage(''); setPasswordMessage(''); setSettingsTab('general') }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/admin/login')
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              Sign out
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              + New Trip
            </button>
          </div>
        </div>

        {/* Usage Banner */}
        <UsageBanner />

        {/* Trips grid */}
        {loading ? (
          <div className="text-slate-400 text-center py-20">Loading...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg mb-4">No trips yet</p>
            <button onClick={() => setShowNew(true)} className="text-blue-400 hover:text-blue-300">
              Create your first trip →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trips.map(trip => (
              <div key={trip.id} className="relative bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-colors">
                {trip.role === 'super' && (
                  <div className="absolute top-3 right-3">
                    {deleteStep?.id === trip.id && deleteStep.step === 1 && (
                      <div className="absolute right-0 top-7 bg-slate-800 border border-slate-700 rounded-xl p-3 z-10 w-52 shadow-xl">
                        <p className="text-white text-xs font-medium mb-2">Delete this trip?</p>
                        <p className="text-slate-400 text-xs mb-3">All data will be permanently removed.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteStep(null)} className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">Cancel</button>
                          <button onClick={() => setDeleteStep({ id: trip.id, step: 2 })} className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg transition-colors">Yes, delete</button>
                        </div>
                      </div>
                    )}
                    {deleteStep?.id === trip.id && deleteStep.step === 2 && (
                      <div className="absolute right-0 top-7 bg-slate-800 border border-red-500/30 rounded-xl p-3 z-10 w-52 shadow-xl">
                        <p className="text-red-400 text-xs font-medium mb-2">⚠️ Are you absolutely sure?</p>
                        <p className="text-slate-400 text-xs mb-3">This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteStep(null)} className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">Cancel</button>
                          <button onClick={() => handleDelete(trip.id)} className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors">Delete</button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setDeleteStep(deleteStep?.id === trip.id ? null : { id: trip.id, step: 1 })}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex items-start gap-4 mb-4">
                  {trip.logo_url ? (
                    <img src={trip.logo_url} alt={trip.title} className="w-14 h-14 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-2xl font-bold">{trip.title.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-6">
                    <h2 className="text-white font-semibold text-xl truncate">{trip.title}</h2>
                    {formatDateRange(trip) && (
                      <p className="text-slate-400 text-sm mt-0.5">{formatDateRange(trip)}</p>
                    )}
                    <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      trip.role === 'super'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}>
                      {trip.role === 'super' ? '⭐ Super Admin' : '👤 Admin'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('current_trip', JSON.stringify(trip))
                      router.push('/admin')
                    }}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
                    Open →
                  </button>
                  <button onClick={() => openEdit(trip)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New Trip Modal */}
        {showNew && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white font-semibold text-lg">Create New Trip</h2>
                <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Trip Title *</label>
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. ACME Corp Hill Day 2026"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                    <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                    <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button onClick={() => setShowNew(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                <button onClick={handleCreate} disabled={creating || !newTitle.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg text-sm transition-colors">
                  {creating ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Trip Modal */}
        {editingTrip && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h2 className="text-white font-semibold text-lg">Edit Trip</h2>
                <button onClick={() => setEditingTrip(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Trip Title *</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                    <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                    <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Trip Timezone</label>
                  <select value={editTimezone} onChange={e => setEditTimezone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Logo</label>
                  <div className="flex items-center gap-3">
                    {editingTrip.logo_url && (
                      <img src={editingTrip.logo_url} alt="logo" className="w-12 h-12 rounded-lg object-contain bg-slate-700 p-1" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const fd = new FormData()
                        fd.append('file', file)
                        const res = await fetch(`/api/admin/trips/${editingTrip.id}/logo`, { method: 'POST', body: fd })
                        const data = await res.json()
                        if (res.ok) {
                          setEditingTrip(prev => prev ? { ...prev, logo_url: data.url } : prev)
                          setTrips(prev => prev.map(t => t.id === editingTrip.id ? { ...t, logo_url: data.url } : t))
                        }
                      }}
                      className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-4">
                  <h3 className="text-white font-medium mb-3">👥 Trip Admins</h3>
                  {tripAdmins.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {tripAdmins.map(admin => (
                        <div key={admin.id} className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${admin.role === 'super' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                              {admin.role === 'super' ? '⭐ Super' : '👤 Admin'}
                            </span>
                            <span className="text-slate-300 text-sm">{admin.email}</span>
                          </div>
                          {admin.role !== 'super' && (
                            <button onClick={() => handleRemoveAdmin(admin.user_id)}
                              className="text-slate-500 hover:text-red-400 text-xs transition-colors">
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {editingTrip.role === 'super' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Invite by Email</label>
                      <div className="flex gap-2">
                        <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleInvite()}
                          placeholder="colleague@example.com"
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                        <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors">
                          {inviting ? '...' : 'Invite'}
                        </button>
                      </div>
                      {inviteMessage && (
                        <p className={`text-xs mt-1.5 ${inviteMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                          {inviteMessage}
                        </p>
                      )}
                      <p className="text-slate-500 text-xs mt-1.5">
                        If they don't have an account, they'll receive an email invitation to join.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
                <button onClick={() => setEditingTrip(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Close</button>
                <button onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg text-sm transition-colors">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h2 className="text-white font-semibold text-lg">Settings</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-6 pt-4 pb-2">
                {(['general', 'account', ...(isSuperAdmin ? ['users'] : [])] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setSettingsTab(t as any); if (t === 'users') fetchOrgUsers() }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${settingsTab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

                {/* General Tab */}
                {settingsTab === 'general' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Organization Name</label>
                      <input
                        type="text"
                        value={settingsOrgName}
                        onChange={e => setSettingsOrgName(e.target.value)}
                        placeholder="e.g. ACME Corp"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <p className="text-slate-500 text-xs mt-1.5">Replaces "[Your Group]" in the header.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Organization Logo</label>
                      <div className="flex items-center gap-3">
                        {userSettings.logo_url ? (
                          <img src={userSettings.logo_url} alt="org logo"
                            className="w-12 h-12 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-slate-500 text-xs">None</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={handleOrgLogoUpload}
                          disabled={uploadingLogo}
                          className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer disabled:opacity-50"
                        />
                      </div>
                      {uploadingLogo && <p className="text-slate-400 text-xs mt-1.5">Uploading...</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Default Timezone</label>
                      <select
                        value={settingsTimezone}
                        onChange={e => setSettingsTimezone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                      <p className="text-slate-500 text-xs mt-1.5">Applied as default when creating new trips.</p>
                    </div>
                    {settingsMessage && (
                      <p className={`text-sm ${settingsMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                        {settingsMessage}
                      </p>
                    )}
                  </>
                )}

                {/* Account Tab */}
                {settingsTab === 'account' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Your Name</label>
                      <input
                        type="text"
                        value={settingsDisplayName}
                        onChange={e => setSettingsDisplayName(e.target.value)}
                        placeholder="e.g. Jane Smith"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="border-t border-slate-800 pt-4 space-y-3">
                      <h3 className="text-white font-medium text-sm">Account Info</h3>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                        <p className="text-slate-300 text-sm">{currentUserEmail}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">User ID</label>
                        <p className="text-slate-500 text-xs font-mono break-all">{currentUserId}</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-800 pt-4 space-y-3">
                      <h3 className="text-white font-medium text-sm">Change Password</h3>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">New Password</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                      </div>
                      {passwordMessage && (
                        <p className={`text-xs ${passwordMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                          {passwordMessage}
                        </p>
                      )}
                      <button onClick={handleChangePassword}
                        disabled={changingPassword || !newPassword || !confirmPassword}
                        className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium rounded-lg transition-colors">
                        {changingPassword ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                    {settingsMessage && (
                      <p className={`text-sm ${settingsMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                        {settingsMessage}
                      </p>
                    )}
                  </>
                )}

                {/* Users Tab — super admin only */}
                {settingsTab === 'users' && (
                  <>
                    <h3 className="text-white font-medium text-sm">All Users</h3>
                    {loadingUsers ? (
                      <p className="text-slate-400 text-sm">Loading...</p>
                    ) : orgUsers.length === 0 ? (
                      <p className="text-slate-400 text-sm">No users found.</p>
                    ) : (
                      <div className="space-y-2">
                        {orgUsers.map(u => (
                          <div key={u.id} className="p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-slate-300 text-sm truncate">{u.email}</p>
                                <p className="text-slate-500 text-xs mt-0.5">
                                  Last sign in: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                                </p>
                              </div>
                              {u.id !== currentUserId && (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  disabled={deletingUserId === u.id}
                                  className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0 mt-0.5"
                                >
                                  {deletingUserId === u.id ? '...' : 'Delete'}
                                </button>
                              )}
                              {u.id === currentUserId && (
                                <span className="text-slate-600 text-xs flex-shrink-0 mt-0.5">You</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {trips
                                .filter(t => t.role === 'super')
                                .map(trip => {
                                  const admin = tripAdmins.find(a => a.user_id === u.id)
                                  if (!admin && u.id !== currentUserId) return null
                                  const role = admin?.role || (u.id === currentUserId ? 'super' : null)
                                  if (!role) return null
                                  return (
                                    <div key={trip.id} className="flex items-center gap-1.5">
                                      <span className="text-slate-600 text-xs">{trip.title}:</span>
                                      <button
                                        onClick={() => u.id !== currentUserId && handleToggleUserRole(u.id, role as 'super' | 'admin')}
                                        disabled={u.id === currentUserId}
                                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                          role === 'super'
                                            ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:cursor-default'
                                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:cursor-default'
                                        }`}
                                      >
                                        {role === 'super' ? '⭐ Super' : '👤 Admin'}
                                      </button>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
                <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                  Close
                </button>
                {settingsTab !== 'users' && (
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg text-sm transition-colors"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}