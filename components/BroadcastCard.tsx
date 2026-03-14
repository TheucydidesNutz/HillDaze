'use client'

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
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-5 relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">📣</span>
        <div className="flex-1 min-w-0">
          <p className="text-amber-300 font-semibold text-sm mb-1">
            Note from {broadcast.sender_name}
          </p>
          <p className="text-amber-100 text-sm leading-relaxed">
            {broadcast.message}
          </p>
          <p className="text-amber-500/70 text-xs mt-2">
            {formatTime(broadcast.created_at)}
          </p>
        </div>
      </div>

      <button
        onClick={() => onDismiss(broadcast.id)}
        className="mt-4 w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        ✓ Got it
      </button>
    </div>
  )
}