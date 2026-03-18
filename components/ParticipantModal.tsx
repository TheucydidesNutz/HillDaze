'use client'

import { useState } from 'react'
import { Participant, Group } from '@/lib/types'
import { apiFetch } from '@/lib/apiFetch'

interface Props {
  participant: Participant | null
  groups: Group[]
  onClose: () => void
  onSaved: (p: Participant) => void
}

const TABS = ['Personal', 'Flights', 'Hotel & Fun', 'Emergency', 'Group']

export default function ParticipantModal({ participant, groups, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState('Personal')
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: participant?.name || '',
    company: participant?.company || '',
    title: participant?.title || '',
    phone: participant?.phone || '',
    email: participant?.email || '',
    emergency_name: participant?.emergency_name || '',
    emergency_phone: participant?.emergency_phone || '',
    emergency_email: participant?.emergency_email || '',
    arrival_airline: participant?.arrival_airline || '',
    arrival_flight_no: participant?.arrival_flight_no || '',
    arrival_datetime: participant?.arrival_datetime?.slice(0, 16) || '',
    arrival_airport: participant?.arrival_airport || '',
    departure_airline: participant?.departure_airline || '',
    departure_flight_no: participant?.departure_flight_no || '',
    departure_datetime: participant?.departure_datetime?.slice(0, 16) || '',
    departure_airport: participant?.departure_airport || '',
    hotel_name: participant?.hotel_name || '',
    hotel_room: participant?.hotel_room || '',
    fun_diversions: participant?.fun_diversions || '',
    group_id: participant?.group_id || '',
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
    if (!form.name.trim()) return alert('Name is required')
    setSaving(true)

    const payload = {
      ...form,
      group_id: form.group_id || null,
      arrival_datetime: form.arrival_datetime || null,
      departure_datetime: form.departure_datetime || null,
    }

    const url = participant
      ? `/api/admin/participants/${participant.id}`
      : '/api/admin/participants'
    const method = participant ? 'PATCH' : 'POST'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      alert(data.error || 'Something went wrong')
      return
    }

    // Upload photo if one was selected
    if (photoFile && data.id) {
      const photoFormData = new FormData()
      photoFormData.append('file', photoFile)
      photoFormData.append('participant_id', data.id)
      const photoRes = await apiFetch('/api/admin/upload/photo', {
        method: 'POST',
        body: photoFormData,
      })
      if (photoRes.ok) {
        const { url: photoUrl } = await photoRes.json()
        data.photo_url = photoUrl
      }
    }

    onSaved(data)
  }

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

  const field = (labelText: string, fieldName: string, placeholder: string, type = 'text') => (
    <div>
      {label(labelText)}
      {input(fieldName, placeholder, type)}
    </div>
  )

  const currentPhoto = photoPreview || participant?.photo_url

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-white font-semibold text-lg">
            {participant ? `Edit: ${participant.name}` : 'Add Participant'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'Personal' && (
            <div className="grid grid-cols-2 gap-4">
              {/* Photo upload */}
              <div className="col-span-2 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xl font-bold">
                      {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Photo</label>
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/jpg"
                    onChange={handlePhotoChange}
                    className="text-sm text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer"
                  />
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG or WebP, max 5MB</p>
                </div>
              </div>

              <div className="col-span-2">{field('Full Name *', 'name', 'Alice Johnson')}</div>
              {field('Company', 'company', 'Acme Corp')}
              {field('Title', 'title', 'VP of Policy')}
              {field('Phone', 'phone', '+1 (555) 000-0000', 'tel')}
              {field('Email', 'email', 'alice@acme.com', 'email')}
            </div>
          )}

          {activeTab === 'Flights' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  ✈️ Arrival Flight
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {field('Airline', 'arrival_airline', 'United Airlines')}
                  {field('Flight No.', 'arrival_flight_no', 'UA 1234')}
                  {field('Date & Time', 'arrival_datetime', '', 'datetime-local')}
                  {field('Airport', 'arrival_airport', 'DCA')}
                </div>
              </div>
              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  ✈️ Departure Flight
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {field('Airline', 'departure_airline', 'United Airlines')}
                  {field('Flight No.', 'departure_flight_no', 'UA 5678')}
                  {field('Date & Time', 'departure_datetime', '', 'datetime-local')}
                  {field('Airport', 'departure_airport', 'DCA')}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Hotel & Fun' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {field('Hotel Name', 'hotel_name', 'The Hay-Adams')}
                {field('Room Number', 'hotel_room', '412')}
              </div>
              <div>
                {label('Fun Diversions / Personal Notes')}
                <textarea
                  placeholder="Restaurants, activities, personal preferences..."
                  value={form.fun_diversions}
                  onChange={e => set('fun_diversions', e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'Emergency' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-slate-400 text-sm mb-4">Emergency contact information for this participant.</p>
              </div>
              <div className="col-span-2">{field('Contact Name', 'emergency_name', 'Bob Johnson')}</div>
              {field('Contact Phone', 'emergency_phone', '+1 (555) 000-0000', 'tel')}
              {field('Contact Email', 'emergency_email', 'bob@example.com', 'email')}
            </div>
          )}

          {activeTab === 'Group' && (
            <div className="space-y-4">
              <div>
                {label('Assign to Group')}
                <select
                  value={form.group_id}
                  onChange={e => set('group_id', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">— No group —</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              {groups.length === 0 && (
                <p className="text-slate-500 text-sm">No groups created yet. Add groups from the Groups page.</p>
              )}
            </div>
          )}
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
            {saving ? 'Saving...' : participant ? 'Save Changes' : 'Add Participant'}
          </button>
        </div>
      </div>
    </div>
  )
}