'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/events/admin/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="px-3 py-1.5 text-slate-400 hover:text-white text-sm bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
    >
      Sign out
    </button>
  )
}