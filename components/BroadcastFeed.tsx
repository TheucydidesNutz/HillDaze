'use client'

import { useState, useEffect } from 'react'
import BroadcastCard from './BroadcastCard'

interface Broadcast {
  id: string
  message: string
  sender_name: string
  created_at: string
}

interface Props {
  token: string
}

export default function BroadcastFeed({ token }: Props) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    if (!token) return

    // Load dismissed IDs from localStorage
    const stored = localStorage.getItem(`dismissed_broadcasts_${token}`)
    const dismissedIds = stored ? JSON.parse(stored) : []
    setDismissed(dismissedIds)

    // Fetch broadcasts
    fetch(`/api/attendee/broadcasts?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBroadcasts(data)
      })
  }, [token])

  function handleDismiss(id: string) {
    const newDismissed = [...dismissed, id]
    setDismissed(newDismissed)
    localStorage.setItem(`dismissed_broadcasts_${token}`, JSON.stringify(newDismissed))
  }

  const visible = broadcasts.filter(b => !dismissed.includes(b.id))

  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      {visible.map(b => (
        <BroadcastCard
          key={b.id}
          broadcast={b}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  )
}