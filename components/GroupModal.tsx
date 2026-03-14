'use client'

import { useState } from 'react'
import { Group } from '@/lib/types'
import { apiFetch } from '@/lib/apiFetch'

interface Props {
  group: Group | null
  onClose: () => void
  onSaved: (g: Group) => void
}

export default function GroupModal({ group, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: group?.name || '',
    lead_name: group?.lead_name || '',
    lead_phone: group?.lead_phone || '',
    lead_email: group?.lead_email || '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('Group name is required')
    setSaving(true)

    const url = group ? `/api/admin/groups/${group.id}` : '/api/admin/groups'
    const method = group ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setSaving(false)
      alert(data.error || 'Something went wrong')
      return
    }

    // Upload lead photo if selected
    if (photoFile && data.id) {
      const photoFormData = new FormData()
      photoFormData.append('file', photoFile)
      photoFormData.append('group_id', data.id)
      const photoRes = await apiFetch('/api/admin/upload/photo', {
        method: 'POST',
        body: photoFormData,
      })
      if (photoRes.ok) {
        const { url: photoUrl } = await photoRes.json()
        data.lead_photo_url = photoUrl
      }
    }

    setSaving(false)
    onSaved(data)
  }

  const currentPhoto = photoPreview || group?.lead_photo_url

  const input = (field: string, placeholder: string, type = 'text') => (
    <input
      type={type}
      placeholder={placeholder}
      value={(form as any)[field]}
      onChange={e => set(field, e.target.value)}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    />
  )

  const label = (text: string) => (
    <label className="block text-xs font-medium text-slate-400 mb-1">{text}</label>
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-lg">
            {group ? `Edit: ${group.name}` : 'Add Group'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Group Name */}
          <div>
            {label('Group Name *')}
            {input('name', 'Group A')}
          </div>

          {/* Lead Photo */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
              {currentPhoto ? (
                <img src={currentPhoto} alt="Lead" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-lg font-bold">
                  {form.lead_name
                    ? form.lead_name.charAt(0).toUpperCase()
                    : form.name.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div>
              {label('Group Lead Photo')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Lead Info */}
          <div>
            {label('Group Lead Name')}
            {input('lead_name', 'Jane Smith')}
          </div>
          <div>
            {label('Group Lead Phone')}
            {input('lead_phone', '+1 (555) 000-0000', 'tel')}
          </div>
          <div>
            {label('Group Lead Email')}
            {input('lead_email', 'jane@example.com', 'email')}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {saving ? 'Saving...' : group ? 'Save Changes' : 'Add Group'}
          </button>
        </div>
      </div>
    </div>
  )
}