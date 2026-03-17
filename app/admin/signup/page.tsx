'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  // Required fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  // Optional fields
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('Name is required'); return }
    if (!phone.trim()) { setError('Phone number is required'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)

    // 1. Create auth account
    const { data, error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError || !data.user) {
      setError(signupError?.message || 'Signup failed')
      setLoading(false)
      return
    }

    // 2. Upload photo if provided
    let photoUrl: string | null = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${data.user.id}/admin-photo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('admin-photos')
        .upload(path, photoFile, { upsert: true })
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('admin-photos').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }

    // 3. Save user settings
    const settingsRes = await fetch('/api/admin/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: '',
        displayName: name.trim(),
        phone: phone.trim(),
        company: company.trim() || null,
        role: title.trim() || null,
        photoUrl,
      }),
    })
    const settingsData = await settingsRes.json()

    if (!settingsRes.ok) {
      setError(settingsData.error || 'Account created but profile failed to save.')
      setLoading(false)
      return
    }

    setLoading(false)
    setDone(true)
  }

  // Welcome screen
  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You're all set, {name.split(' ')[0]}!</h2>
            <p className="text-slate-400 mb-8">Your Covaled account has been created. You can now sign in and start coordinating your group travel.</p>
            <button
              onClick={() => router.push('/admin/trips')}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Go to my dashboard →
            </button>
            <p className="text-slate-600 text-xs mt-4">You're signed in as {email}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Hero block */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-xl overflow-hidden" style={{ width: '125%', aspectRatio: '5/5' }}>
              <img src="/covaled-hero.png" alt="Group travel" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="text-6xl font-bold text-white tracking-tight">Covaled</h1>
          <p className="text-slate-400 mt-2 text-base">Group travel, coordinated.</p>
        </div>

        {/* Signup Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Create your account</h2>

          <form onSubmit={handleSignup} className="space-y-4">

            {/* Profile photo */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <div
                onClick={() => photoInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 hover:border-blue-500 flex items-center justify-center overflow-hidden cursor-pointer transition-colors relative group"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-7 h-7 text-slate-500 group-hover:text-blue-400 transition-colors" />
                )}
              </div>
              <p className="text-slate-500 text-xs">Profile photo <span className="text-slate-600">(optional)</span></p>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
            </div>

            {/* Required fields */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Jane Smith" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email <span className="text-red-400">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Cell Phone <span className="text-red-400">*</span></label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(555) 555-1234" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password <span className="text-red-400">*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••" />
            </div>

            {/* Optional fields */}
            <div className="border-t border-slate-800 pt-4">
              <p className="text-slate-500 text-xs mb-3">Optional — you can add these later in Settings</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Company</label>
                  <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Acme Corp" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Title / Role</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. VP of Sales" />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors mt-2">
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
              {['Up to 3 trips', 'Up to 15 participants per trip', 'Full feature access for 90 days'].map(feature => (
                <p key={feature} className="text-slate-400 text-xs flex items-center gap-2">
                  <span className="text-green-400">✓</span>{feature}
                </p>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}