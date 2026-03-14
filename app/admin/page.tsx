import { createSupabaseServerClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import BroadcastComposer from '@/components/BroadcastComposer'

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">HillDayTracker</h1>
            <p className="text-slate-400 mt-1">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">{user.email}</span>
            <LogoutButton />
          </div>
        </div>

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
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">Events</h3>
            <p className="text-slate-400 text-sm">Calendar & scheduling</p>
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
          <a href="/admin/settings" className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-6 transition-colors group">
            <div className="text-2xl mb-3">⚙️</div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">Settings</h3>
            <p className="text-slate-400 text-sm">Fact sheets & configuration</p>
          </a>
        </div>

        {/* Broadcast composer */}
        <BroadcastComposer />
      </div>
    </div>
  )
}