'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signupError || !data.user) {
      setError(signupError?.message || 'Signup failed')
      setLoading(false)
      return
    }

    // Create user_settings via server route (bypasses RLS)
    // FIX: No longer sending userId — the server reads it from the auth session
    const settingsRes = await fetch('/api/admin/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName }),
    })
    const settingsData = await settingsRes.json()

    if (!settingsRes.ok) {
      setError(settingsData.error || 'Account created but settings failed to save. Please contact support.')
      setLoading(false)
      return
    }

    setLoading(false)
    router.push('/admin/trips')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Hero block */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-xl overflow-hidden" style={{ width: '125%', aspectRatio: '5/5' }}>
              <img
                src="/covaled-hero.png"
                alt="Group travel"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <h1 className="text-6xl font-bold text-white tracking-tight">Covaled</h1>
          <p className="text-slate-400 mt-2 text-base">Group travel, coordinated.</p>
        </div>

        {/* Signup Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Create your account</h2>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Organization Name <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. ACME Corp"
              />
              <p className="text-slate-500 text-xs mt-1.5">You can set or change this later in Settings.</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors mt-2"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-slate-500 text-sm text-center mt-6">
            Already have an account?{' '}
            <a href="/admin/login" className="text-blue-400 hover:text-blue-300">Sign in</a>
          </p>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-slate-500 text-xs text-center mb-3">Free tier includes:</p>
            <div className="space-y-1.5">
              {[
                'Up to 3 trips',
                'Up to 15 participants per trip',
                'Full feature access for 90 days',
              ].map(feature => (
                <p key={feature} className="text-slate-400 text-xs flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  {feature}
                </p>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}