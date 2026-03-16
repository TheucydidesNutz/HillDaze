'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import { Megaphone, Globe, Users, ChevronUp, ChevronDown } from 'lucide-react'

interface Broadcast {
  id: string
  message: string
  sender_name: string
  created_at: string
  group: { id: string; name: string } | null
}

interface Group {
  id: string
  name: string
}

export default function BroadcastComposer() {
  const [message, setMessage] = useState('')
  const [senderName, setSenderName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    apiFetch('/api/admin/groups').then(r => r.json()).then(setGroups)
    apiFetch('/api/admin/broadcasts').then(r => r.json()).then(setBroadcasts)
  }, [])

  async function handleSend() {
    if (!message.trim() || !senderName.trim()) return
    setSending(true)

    const res = await apiFetch('/api/admin/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sender_name: senderName, group_id: groupId || null }),
    })

    const data = await res.json()
    setSending(false)

    if (res.ok) {
      setBroadcasts(prev => [data, ...prev])
      setMessage('')
    } else {
      alert(data.error || 'Failed to send')
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/broadcasts?id=${id}`, { method: 'DELETE' })
    setBroadcasts(prev => prev.filter(b => b.id !== id))
  }

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-amber-400" />
          <h2 className="text-white font-semibold">Broadcast Message</h2>
          {broadcasts.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full border border-amber-500/30">
              {broadcasts.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          {expanded ? <><ChevronUp className="w-4 h-4 inline" /> Collapse</> : <><ChevronDown className="w-4 h-4 inline" /> Expand</>}
        </button>
      </div>

      {/* Compose */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Your Name</label>
            <input
              type="text"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="Will Dawson"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Send To</label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
            >
              <option value="">All Participants</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>👥 {g.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Dinner tonight moved to 7pm — meet in the hotel lobby..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm resize-none"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !message.trim() || !senderName.trim()}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold rounded-lg text-sm transition-colors"
        >
          {sending ? 'Sending...' : <><Megaphone className="w-4 h-4 inline" /> Send Broadcast</>}
        </button>
      </div>

      {/* Active broadcasts */}
      {expanded && broadcasts.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-slate-800 pt-4">
          <p className="text-slate-400 text-xs font-medium mb-3">Active broadcasts — visible to participants until deleted</p>
          {broadcasts.map(b => (
            <div key={b.id} className="flex items-start justify-between gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-amber-300 text-xs font-medium">{b.sender_name}</p>
                  {b.group && (
                    <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">
                      {b.group.name}
                    </span>
                  )}
                  {!b.group && (
                    <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">
                      All
                    </span>
                  )}
                  <span className="text-slate-600 text-xs">{formatTime(b.created_at)}</span>
                </div>
                <p className="text-slate-300 text-sm truncate">{b.message}</p>
              </div>
              <button
                onClick={() => handleDelete(b.id)}
                className="text-slate-600 hover:text-red-400 text-xs transition-colors flex-shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}