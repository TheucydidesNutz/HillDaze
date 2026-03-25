'use client'

import { useState, useEffect } from 'react'
import { Trip, TripTheme, DEFAULT_TRIP_THEME, LIGHT_TRIP_THEME } from '@/lib/events/types'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import UsageBanner from '@/components/UsageBanner'
import { Settings, LogOut, Plus, Star, User, Users, X, AlertTriangle } from 'lucide-react'

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
  phone: string | null
  timezone: string | null
  photo_url: string | null
  company: string | null
  role: string | null
}

interface OrgUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  role?: 'super' | 'admin' | null
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Dubai', label: 'Gulf (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST)' },
]

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [newTimezone, setNewTimezone] = useState('America/New_York')
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editTimezone, setEditTimezone] = useState('')
  const [editTheme, setEditTheme] = useState<TripTheme>({ ...DEFAULT_TRIP_THEME })
  const [saving, setSaving] = useState(false)
  const [tripAdmins, setTripAdmins] = useState<TripAdmin[]>([])
  const [newTripAdmins, setNewTripAdmins] = useState<TripAdmin[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [newInviteEmail, setNewInviteEmail] = useState('')
  const [newInviting, setNewInviting] = useState(false)
  const [newInviteMessage, setNewInviteMessage] = useState('')
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null)
  const [deleteStep, setDeleteStep] = useState<{ id: string; step: 1 | 2 } | null>(null)

  // Settings state
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'general' | 'account' | 'users'>('general')
  const [userSettings, setUserSettings] = useState<UserSettings>({ org_name: null, logo_url: null, display_name: null, timezone: null, photo_url: null, phone: null, company: null, role: null })
  const [settingsOrgName, setSettingsOrgName] = useState('')
  const [settingsDisplayName, setSettingsDisplayName] = useState('')
  const [settingsTimezone, setSettingsTimezone] = useState('America/New_York')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [settingsPhone, setSettingsPhone] = useState('')
  const [settingsCompany, setSettingsCompany] = useState('')
  const [settingsRole, setSettingsRole] = useState('')
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
      .select('org_name, logo_url, display_name, timezone, photo_url, phone, company, role')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setUserSettings(data)
      setSettingsOrgName(data.org_name || '')
      setSettingsDisplayName(data.display_name || '')
      setSettingsPhone(data.phone || '')
      setSettingsCompany(data.company || '')
      setSettingsRole(data.role || '')
      setSettingsTimezone(data.timezone || 'America/New_York')
      setNewTimezone(data.timezone || 'America/New_York')
    } else {
      const meta = user.user_metadata
      const photoExists = await supabase.storage
        .from('admin-photos')
        .list(user.id)
      const hasPhoto = photoExists.data?.some(f => f.name.startsWith('admin-photo'))
      const actualFile = photoExists.data?.find(f => f.name.startsWith('admin-photo'))
      const { data: { publicUrl } } = supabase.storage
        .from('admin-photos')
        .getPublicUrl(`${user.id}/${actualFile?.name || 'admin-photo.jpg'}`)

      await fetch('/api/events/admin/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: '',
          displayName: meta?.display_name || '',
          phone: meta?.phone || '',
          company: meta?.company || null,
          role: meta?.role || null,
          photoUrl: hasPhoto ? publicUrl : null,
        }),
      })
      // Sync profile to any existing participant records
      await fetch('/api/events/admin/users/sync-participants', { method: 'POST' })
      // Re-fetch now that the row exists
      fetchUserInfo()
    }
  }

  async function fetchTrips() {
    const res = await fetch('/api/events/admin/trips')
    const data = await res.json()
    setTrips(data)
    setLoading(false)
    if (Array.isArray(data) && data.some((t: Trip) => t.role === 'super')) {
      setIsSuperAdmin(true)
    }
  }

  async function fetchTripAdmins(tripId: string) {
    const res = await fetch(`/api/events/admin/trips/${tripId}/invite`)
    const data = await res.json()
    setTripAdmins(Array.isArray(data) ? data : [])
  }

  async function fetchNewTripAdmins(tripId: string) {
    const res = await fetch(`/api/events/admin/trips/${tripId}/invite`)
    const data = await res.json()
    setNewTripAdmins(Array.isArray(data) ? data : [])
  }

  async function fetchOrgUsers() {
    setLoadingUsers(true)
    const res = await fetch('/api/events/admin/users')
    const data = await res.json()
    setOrgUsers(Array.isArray(data) ? data : [])
    setLoadingUsers(false)
  }

  async function handleCreate() {
    if (!newTitle.trim()) return alert('Title required')
    setCreating(true)
    const res = await fetch('/api/events/admin/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        start_date: newStart,
        end_date: newEnd,
        timezone: newTimezone,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (res.ok) {
      const newTrip = { ...data, role: 'super' } as Trip
      setTrips(prev => [...prev, newTrip])
      setCreatedTrip(newTrip)
      fetchNewTripAdmins(newTrip.id)
    } else {
      alert(data.error)
    }
  }

  function closeNewModal() {
    setShowNew(false)
    setCreatedTrip(null)
    setNewTitle('')
    setNewStart('')
    setNewEnd('')
    setNewTimezone(userSettings.timezone || 'America/New_York')
    setNewTripAdmins([])
    setNewInviteEmail('')
    setNewInviteMessage('')
  }

  async function handleNewTripInvite() {
    if (!newInviteEmail.trim() || !createdTrip) return
    setNewInviting(true)
    setNewInviteMessage('')
    const res = await fetch(`/api/events/admin/trips/${createdTrip.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newInviteEmail }),
    })
    const data = await res.json()
    setNewInviting(false)
    if (res.ok) {
      setNewInviteMessage(`✓ ${data.message}`)
      setNewInviteEmail('')
      fetchNewTripAdmins(createdTrip.id)
    } else {
      setNewInviteMessage(`✗ ${data.error}`)
    }
  }

  async function handleSaveEdit() {
    if (!editingTrip || !editTitle.trim()) return
    setSaving(true)
    const res = await fetch(`/api/events/admin/trips/${editingTrip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        start_date: editStart || null,
        end_date: editEnd || null,
        timezone: editTimezone || 'America/New_York',
        theme: editTheme,
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
    const res = await fetch(`/api/events/admin/trips/${editingTrip.id}/invite`, {
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
    await fetch(`/api/events/admin/trips/${editingTrip.id}/invite?user_id=${userId}`, { method: 'DELETE' })
    setTripAdmins(prev => prev.filter(a => a.user_id !== userId))
  }

  async function handleDelete(id: string) {
    await fetch(`/api/events/admin/trips/${id}`, { method: 'DELETE' })
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
    setEditTheme({ ...DEFAULT_TRIP_THEME, ...(fullTrip.theme || {}) })
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
        phone: settingsPhone.trim() || null,
        company: settingsCompany.trim() || null,
        role: settingsRole.trim() || null,
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
        phone: settingsPhone.trim() || null,
        company: settingsCompany.trim() || null,
        role: settingsRole.trim() || null,
        timezone: settingsTimezone,
      }))
      setSettingsMessage('✓ Settings saved')
      setShowSettings(false)
      setTimeout(() => setSettingsMessage(''), 3000)
      // Silently sync changes to linked participant records (respects overrides)
      fetch('/api/events/admin/users/sync-participants', { method: 'POST' }).catch(() => null)
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

  async function handleAdminPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return

    const ext = file.name.split('.').pop()
    const path = `${currentUserId}/admin-photo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('admin-photos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setSettingsMessage(`✗ Photo upload failed: ${uploadError.message}`)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('admin-photos')
      .getPublicUrl(path)

    const { error: dbError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: currentUserId,
        photo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })

    if (!dbError) {
      setUserSettings(prev => ({ ...prev, photo_url: publicUrl }))
      setSettingsMessage('✓ Photo updated')
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
    const res = await fetch('/api/events/admin/users', {
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
    const res = await fetch('/api/events/admin/users', {
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
    const start = new Date(trip.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!trip.end_date) return start
    const end = new Date(trip.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} – ${end}`
  }

  const displayName = userSettings.org_name || '[Your Group]'

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* ── Header: logo + org name, centered ── */}
        <div className="flex flex-col items-center text-center mb-6">
          {userSettings.logo_url && (
            <img
              src={`${userSettings.logo_url}?t=${userSettings.logo_url ? Date.now() : ''}`}
              alt="org logo"
              className="w-full h-44 md:h-56 object-cover rounded-3xl mb-4 self-stretch"
            />
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-white">{displayName}</h1>
          <p className="text-slate-500 text-xs italic mt-0.5">by Covaled</p>
          <p className="text-slate-400 mt-1 text-sm">Select a Trip to manage</p>

          {/* FIX: action buttons moved below header, centered row */}
          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={() => {
                setShowSettings(true)
                setSettingsMessage('')
                setPasswordMessage('')
                setSettingsTab('general')
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              title="Settings"
            >
              {/* FIX: Lucide Settings icon, size 18 */}
              <Settings className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/events/admin/login')
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-[18px] h-[18px]" />
              <span>New Trip</span>
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
              <div key={trip.id} className="relative bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-colors" style={{ borderLeftWidth: '4px', borderLeftColor: trip.theme?.primary || '#3B82F6' }}>
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
                        <p className="text-red-400 text-xs font-medium mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Are you absolutely sure?</p>
                        <p className="text-slate-400 text-xs mb-3">This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteStep(null)} className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">Cancel</button>
                          <button onClick={() => handleDelete(trip.id)} className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors">Delete</button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setDeleteStep(deleteStep?.id === trip.id ? null : { id: trip.id, step: 1 })}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
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
                    <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${trip.role === 'super'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-slate-700 text-slate-400 border-slate-600'
                      }`}>
                      {trip.role === 'super' ? <><Star className="w-3 h-3 inline" /> Super Admin</> : <><User className="w-3 h-3 inline" /> Admin</>}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('current_trip', JSON.stringify(trip))
                      router.push('/events/admin')
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
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h2 className="text-white font-semibold text-lg">
                  {createdTrip ? `✓ Trip Created — Add Details` : 'Create New Trip'}
                </h2>
                <button onClick={closeNewModal} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {!createdTrip ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Trip Title *</label>
                      <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                        placeholder="e.g. ACME Corp Hill Day 2026"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                        <input type="date" value={newStart || ''} onChange={e => setNewStart(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                        <input type="date" value={newEnd || ''} onChange={e => setNewEnd(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Trip Timezone</label>
                      <select value={newTimezone} onChange={e => setNewTimezone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        {TIMEZONES.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-800/50 rounded-lg p-3 mb-2">
                      <p className="text-slate-400 text-xs">Trip <span className="text-white font-medium">{createdTrip.title}</span> created. Add a logo and invite admins, or close to finish.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Logo</label>
                      <div className="flex items-center gap-3">
                        {createdTrip.logo_url && (
                          <img src={createdTrip.logo_url} alt="logo" className="w-12 h-12 rounded-lg object-contain bg-slate-700 p-1" />
                        )}
                        <input
                          type="file"
                          accept="image/png,image/svg+xml,image/jpeg,image/jpg"
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const fd = new FormData()
                            fd.append('file', file)
                            const res = await fetch(`/api/events/admin/trips/${createdTrip.id}/logo`, { method: 'POST', body: fd })
                            const data = await res.json()
                            if (res.ok) {
                              setCreatedTrip(prev => prev ? { ...prev, logo_url: data.url } : prev)
                              setTrips(prev => prev.map(t => t.id === createdTrip.id ? { ...t, logo_url: data.url } : t))
                            }
                          }}
                          className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="border-t border-slate-800 pt-4">
                      <h3 className="text-white font-medium mb-3 text-sm flex items-center gap-1.5"><Users className="w-4 h-4" /> Trip Admins</h3>
                      {newTripAdmins.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {newTripAdmins.map(admin => (
                            <div key={admin.id} className="flex items-center gap-2 p-2.5 bg-slate-800/50 rounded-lg">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${admin.role === 'super' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                                {admin.role === 'super' ? <><Star className="w-3 h-3 inline" /> Super</> : <><User className="w-3 h-3 inline" /> Admin</>}
                              </span>
                              <span className="text-slate-300 text-sm">{admin.email}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <label className="block text-xs font-medium text-slate-400 mb-1">Invite by Email</label>
                      <div className="flex gap-2">
                        <input type="email" value={newInviteEmail} onChange={e => setNewInviteEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleNewTripInvite()}
                          placeholder="colleague@example.com"
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                        <button onClick={handleNewTripInvite} disabled={newInviting || !newInviteEmail.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors">
                          {newInviting ? '...' : 'Invite'}
                        </button>
                      </div>
                      {newInviteMessage && (
                        <p className={`text-xs mt-1.5 ${newInviteMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                          {newInviteMessage}
                        </p>
                      )}
                      <p className="text-slate-500 text-xs mt-1.5">
                        If they don't have an account, they'll receive an email invitation to join.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
                <button onClick={closeNewModal} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                  {createdTrip ? 'Done' : 'Cancel'}
                </button>
                {!createdTrip && (
                  <button onClick={handleCreate} disabled={creating || !newTitle.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg text-sm transition-colors">
                    {creating ? 'Creating...' : 'Create Trip'}
                  </button>
                )}
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
                <button onClick={() => setEditingTrip(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
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
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
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
                      accept="image/png,image/svg+xml,image/jpeg,image/jpg"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const fd = new FormData()
                        fd.append('file', file)
                        const res = await fetch(`/api/events/admin/trips/${editingTrip.id}/logo`, { method: 'POST', body: fd })
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
                {/* Theme Editor */}
                <div className="border-t border-slate-800 pt-4">
                  <h3 className="text-white font-medium mb-3">Theme Colors</h3>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setEditTheme({ ...DEFAULT_TRIP_THEME })}
                      className="flex-1 py-2 rounded-lg text-xs font-medium border transition-colors bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                    >
                      <span className="inline-block w-3 h-3 rounded-full bg-slate-900 mr-1.5 align-middle border border-slate-600"></span>
                      Dark Mode
                    </button>
                    <button
                      onClick={() => setEditTheme({ ...LIGHT_TRIP_THEME })}
                      className="flex-1 py-2 rounded-lg text-xs font-medium border transition-colors bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                    >
                      <span className="inline-block w-3 h-3 rounded-full bg-white mr-1.5 align-middle border border-slate-400"></span>
                      Light Mode
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ['surface', 'Surface'],
                      ['background', 'Background'],
                      ['text', 'Text'],
                      ['textSecondary', 'Text Secondary'],
                      ['border', 'Border'],
                      ['secondary', 'Secondary'],
                      ['primary', 'Accent 1'],
                      ['accent', 'Accent 2'],
                    ] as [keyof TripTheme, string][]).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editTheme[key]}
                          onChange={e => setEditTheme(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300 text-xs">{label}</p>
                          <p className="text-slate-500 text-[10px] font-mono">{editTheme[key]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Preview */}
                  <div className="mt-3 rounded-lg p-3 border" style={{ backgroundColor: editTheme.background, borderColor: editTheme.border }}>
                    <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: editTheme.surface, borderColor: editTheme.border, border: `1px solid ${editTheme.border}` }}>
                      <p className="text-xs font-medium" style={{ color: editTheme.text }}>Sample Event</p>
                      <p className="text-[10px] mt-0.5" style={{ color: editTheme.textSecondary }}>10:00 AM - Grand Ballroom</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="px-2 py-1 rounded text-[10px] font-medium text-white" style={{ backgroundColor: editTheme.primary }}>Accent 1</div>
                      <div className="px-2 py-1 rounded text-[10px] font-medium text-white" style={{ backgroundColor: editTheme.accent }}>Accent 2</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-1.5"><Users className="w-4 h-4" /> Trip Admins</h3>
                  {tripAdmins.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {tripAdmins.map(admin => (
                        <div key={admin.id} className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${admin.role === 'super' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                              {admin.role === 'super' ? <><Star className="w-3 h-3 inline" /> Super</> : <><User className="w-3 h-3 inline" /> Admin</>}
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
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>

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

                {settingsTab === 'general' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Organization Name</label>
                      <input type="text" value={settingsOrgName} onChange={e => setSettingsOrgName(e.target.value)}
                        placeholder="e.g. ACME Corp"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                      <p className="text-slate-500 text-xs mt-1.5">Replaces "[Your Group]" in the header.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Organization Logo</label>
                      <div className="flex items-center gap-3">
                        {userSettings.logo_url ? (
                          <img src={`${userSettings.logo_url}?t=${Date.now()}`} alt="org logo"
                            className="w-12 h-12 rounded-xl object-contain bg-slate-800 p-1 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-slate-500 text-xs">None</span>
                          </div>
                        )}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={handleOrgLogoUpload} disabled={uploadingLogo}
                          className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer disabled:opacity-50" />
                      </div>
                      {uploadingLogo && <p className="text-slate-400 text-xs mt-1.5">Uploading...</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Default Timezone</label>
                      <select value={settingsTimezone} onChange={e => setSettingsTimezone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                        {TIMEZONES.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
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

                {settingsTab === 'account' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Profile Photo</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {userSettings.photo_url ? (
                            <img src={`${userSettings.photo_url}?t=${Date.now()}`} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xl font-bold">
                              {settingsDisplayName?.charAt(0) || currentUserEmail?.charAt(0) || '?'}
                            </span>
                          )}
                        </div>
                        <div>
                          <input
                            type="file"
                            accept="image/png,image/svg+xml,image/jpeg,image/jpg"
                            onChange={handleAdminPhotoUpload}
                            className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                          />
                          <p className="text-slate-500 text-xs mt-1">JPG, PNG or WebP</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Your Name</label>
                      <input type="text" value={settingsDisplayName} onChange={e => setSettingsDisplayName(e.target.value)}
                        placeholder="e.g. Jane Smith"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Your Phone</label>
                      <input type="tel" value={settingsPhone} onChange={e => setSettingsPhone(e.target.value)}
                        placeholder="e.g. (555) 555-1234"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Your Company</label>
                      <input type="text" value={settingsCompany} onChange={e => setSettingsCompany(e.target.value)}
                        placeholder="e.g. Acme Corp"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Your Role / Title</label>
                      <input type="text" value={settingsRole} onChange={e => setSettingsRole(e.target.value)}
                        placeholder="e.g. VP of Sales"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
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
                                <button onClick={() => handleDeleteUser(u.id, u.email)}
                                  disabled={deletingUserId === u.id}
                                  className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0 mt-0.5">
                                  {deletingUserId === u.id ? '...' : 'Delete'}
                                </button>
                              )}
                              {u.id === currentUserId && (
                                <span className="text-slate-600 text-xs flex-shrink-0 mt-0.5">You</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {trips.filter(t => t.role === 'super').map(trip => {
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
                                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${role === 'super'
                                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:cursor-default'
                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 disabled:cursor-default'
                                        }`}>
                                      {role === 'super' ? <><Star className="w-3 h-3 inline" /> Super</> : <><User className="w-3 h-3 inline" /> Admin</>}
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
                  <button onClick={handleSaveSettings} disabled={savingSettings}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium rounded-lg text-sm transition-colors">
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