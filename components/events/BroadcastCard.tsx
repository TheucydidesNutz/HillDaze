'use client'

import { Megaphone, Check } from 'lucide-react'

interface Broadcast {
  id: string
  message: string
  sender_name: string
  created_at: string
}

interface Props {
  broadcast: Broadcast
  onDismiss: (id: string) => void
}

export default function BroadcastCard({ broadcast, onDismiss }: Props) {
  function formatTime(ts: string) {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden border"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--theme-primary, #F59E0B) 10%, transparent)',
        borderColor: 'color-mix(in srgb, var(--theme-primary, #F59E0B) 40%, transparent)',
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--theme-primary, #F59E0B) 50%, transparent), transparent)`,
        }}
      />

      <div className="flex items-start gap-3">
        <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--theme-primary, #F59E0B)' }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1" style={{ color: 'var(--theme-primary, #F59E0B)' }}>
            Note from {broadcast.sender_name}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text, #F8FAFC)' }}>
            {broadcast.message}
          </p>
          <p className="text-xs mt-2" style={{ color: 'color-mix(in srgb, var(--theme-primary, #F59E0B) 70%, transparent)' }}>
            {formatTime(broadcast.created_at)}
          </p>
        </div>
      </div>

      <button
        onClick={() => onDismiss(broadcast.id)}
        className="mt-4 w-full py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--theme-primary, #F59E0B) 20%, transparent)',
          borderColor: 'color-mix(in srgb, var(--theme-primary, #F59E0B) 30%, transparent)',
          border: '1px solid color-mix(in srgb, var(--theme-primary, #F59E0B) 30%, transparent)',
          color: 'var(--theme-primary, #F59E0B)',
        }}
      >
        <Check className="w-4 h-4" /> Got it
      </button>
    </div>
  )
}
