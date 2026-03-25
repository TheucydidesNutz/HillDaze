'use client'

import { useState, useEffect } from 'react'

const DEFAULT_THEME = {
  primary: '#3B82F6',
  secondary: '#1E293B',
  accent: '#F59E0B',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [theme, setTheme] = useState(DEFAULT_THEME)

  useEffect(() => {
    try {
      const tripStr = localStorage.getItem('current_trip')
      if (tripStr) {
        const trip = JSON.parse(tripStr)
        if (trip.theme) {
          setTheme({ ...DEFAULT_THEME, ...trip.theme })
        }
      }
    } catch {}

    // Listen for storage changes (when user switches trips)
    const handler = () => {
      try {
        const tripStr = localStorage.getItem('current_trip')
        if (tripStr) {
          const trip = JSON.parse(tripStr)
          setTheme(trip.theme ? { ...DEFAULT_THEME, ...trip.theme } : DEFAULT_THEME)
        } else {
          setTheme(DEFAULT_THEME)
        }
      } catch {}
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const themeVars = {
    '--theme-primary': theme.primary,
    '--theme-secondary': theme.secondary,
    '--theme-accent': theme.accent,
    '--theme-bg': theme.background,
    '--theme-surface': theme.surface,
    '--theme-text': theme.text,
    '--theme-text-secondary': theme.textSecondary,
    '--theme-border': theme.border,
  } as React.CSSProperties

  return (
    <div
      className="min-h-screen"
      style={{ ...themeVars, backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}
    >
      {children}
    </div>
  )
}
