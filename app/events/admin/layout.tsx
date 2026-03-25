'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'

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

// Pages that don't belong to a specific trip — always use default theme
const NON_TRIP_PATHS = ['/events/admin/trips', '/events/admin/login', '/events/admin/signup']

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const pathname = usePathname()

  const readTheme = useCallback(() => {
    // Non-trip pages always get the default dark theme
    if (NON_TRIP_PATHS.includes(pathname)) {
      setTheme(DEFAULT_THEME)
      return
    }
    try {
      const tripStr = localStorage.getItem('current_trip')
      if (tripStr) {
        const trip = JSON.parse(tripStr)
        if (trip.theme) {
          setTheme({ ...DEFAULT_THEME, ...trip.theme })
          return
        }
      }
    } catch {}
    setTheme(DEFAULT_THEME)
  }, [pathname])

  // Re-read theme on every route change
  useEffect(() => {
    readTheme()
  }, [readTheme])

  // Patch localStorage.setItem to detect same-tab trip changes
  useEffect(() => {
    const originalSetItem = localStorage.setItem.bind(localStorage)
    localStorage.setItem = function (key: string, value: string) {
      originalSetItem(key, value)
      if (key === 'current_trip') {
        // Defer to let the calling code finish
        setTimeout(readTheme, 0)
      }
    }
    return () => {
      localStorage.setItem = originalSetItem
    }
  }, [readTheme])

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
