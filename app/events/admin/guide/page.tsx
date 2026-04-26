'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trip } from '@/lib/events/types'
import TripHeader from '@/components/TripHeader'
import {
  Users,
  Tag,
  CalendarDays,
  NotebookPen,
  Download,
  FolderOpen,
  Megaphone,
  Camera,
  Smartphone,
  FileText,
  Map,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react'

interface Section {
  id: string
  icon: any
  title: string
  color: string
  bg: string
  steps: { title: string; detail: string }[]
}

const adminSections: Section[] = [
  {
    id: 'trips',
    icon: BookOpen,
    title: 'Getting Started — Trips',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    steps: [
      { title: 'Create a trip', detail: 'From the All Trips page, click "+ New Trip" and enter a title, dates, and timezone.' },
      { title: 'Customize your theme', detail: 'Click the gear icon on your trip card to open settings. Choose a preset theme (Dark/Light) or set custom colors — these control what attendees see on their microsite.' },
      { title: 'Upload a logo', detail: 'In trip settings, upload a logo image. It appears in the header on both the admin dashboard and the attendee microsite.' },
      { title: 'Invite co-admins', detail: 'In trip settings, enter an email address to invite another admin. They\'ll get full access to manage the trip.' },
      { title: 'Select a trip', detail: 'Click a trip card to enter its Dashboard. The selected trip is remembered for your session.' },
    ],
  },
  {
    id: 'participants',
    icon: Users,
    title: 'Participants',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    steps: [
      { title: 'Add participants', detail: 'Click "+ Add Participant" and fill in their details across tabs: Personal, Flights, Hotel & Fun, Emergency, and Group.' },
      { title: 'Bulk import via CSV', detail: 'Go to Import > CSV tab. Upload a CSV file with columns for name, email, phone, title, company, etc. Preview before importing.' },
      { title: 'View participant details', detail: 'Click any participant card to see their full profile across five tabs: Personal, Flights, Hotel & Fun, Emergency, and Group.' },
      { title: 'Share attendee links', detail: 'Each participant gets a unique microsite URL. In their detail view, click "Copy URL" and send it to them — that\'s their personal event page.' },
      { title: 'Edit or delete', detail: 'Click a participant, then "Edit" to update their info, or "Delete" at the bottom of the edit form to remove them.' },
    ],
  },
  {
    id: 'groups',
    icon: Tag,
    title: 'Groups',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    steps: [
      { title: 'Create groups', detail: 'Click "+ Add Group" and enter a name. Optionally add a group lead with name, email, phone, and photo.' },
      { title: 'Import lead from participant', detail: 'In the group form, use "Import from Participant" to auto-fill lead details from an existing participant.' },
      { title: 'Assign participants', detail: 'Edit a participant and select their group from the Group tab dropdown.' },
      { title: 'Group-specific content', detail: 'Events, documents, and maps can be assigned to specific groups — only those participants will see them on their microsite.' },
    ],
  },
  {
    id: 'schedule',
    icon: CalendarDays,
    title: 'Schedule (Events)',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    steps: [
      { title: 'Navigate the calendar', detail: 'Switch between Month, Week, Day, and List views using the buttons at the top. Click dates to navigate.' },
      { title: 'Create an event', detail: 'Click "+ Add Event" or click on a time slot. Fill in title, date/time, location, type (mandatory/optional), and optionally assign to a group.' },
      { title: 'Add talking points', detail: 'In the event form, add preparation notes in "Talking Points" — these appear on the attendee microsite so participants come prepared.' },
      { title: 'Add meeting contacts', detail: 'Add up to 5 people attendees will be meeting, with names, titles, and photos. Drag to reorder. These show on the attendee event detail.' },
      { title: 'Set a meeting lead', detail: 'Select a participant as the meeting lead from the dropdown.' },
      { title: 'Import from ICS', detail: 'Go to Import > ICS tab to bulk-import events from a calendar file. Choose the event type and optionally assign to a group.' },
      { title: 'Significant changes', detail: 'The system tracks meaningful edits (title, time, location, type). Only significant changes trigger update highlights on attendee microsites.' },
    ],
  },
  {
    id: 'notes',
    icon: NotebookPen,
    title: 'Notes Feed',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    steps: [
      { title: 'View participant notes', detail: 'The Notes Feed shows all journal entries submitted by participants from their microsites.' },
      { title: 'Filter and sort', detail: 'Use the dropdowns to filter by participant or group. Toggle between newest-first and oldest-first.' },
      { title: 'View event context', detail: 'If a note is linked to an event, click to expand and see the event title, time, and location.' },
      { title: 'Delete notes', detail: 'Click the X on any note to remove it (with confirmation).' },
    ],
  },
  {
    id: 'files',
    icon: FolderOpen,
    title: 'File Management',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    steps: [
      { title: 'Upload fact sheets', detail: 'Upload PDF fact sheets with a label. Click "Set Active" to make one visible to attendees — only one can be active at a time.' },
      { title: 'Upload documents', detail: 'Upload PDFs or images as documents. Optionally assign to a specific group so only those participants see it.' },
      { title: 'Upload maps', detail: 'Upload maps (PDF or image) the same way. These appear in the Maps section of the attendee microsite.' },
      { title: 'Download trip photos', detail: 'View the count of attendee-uploaded photos and download them all as a ZIP file, organized by participant.' },
    ],
  },
  {
    id: 'broadcasts',
    icon: Megaphone,
    title: 'Broadcasts',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    steps: [
      { title: 'Send a broadcast', detail: 'From the Dashboard, scroll to the Broadcast Composer. Enter your name, message, and choose "Everyone" or a specific group.' },
      { title: 'What attendees see', detail: 'Broadcasts appear as a collapsible "Note from [Name]" banner at the top of the attendee microsite.' },
      { title: 'View history', detail: 'Expand "Recent Broadcasts" to see past messages with timestamps and audience.' },
    ],
  },
]

const attendeeSections: Section[] = [
  {
    id: 'att-profile',
    icon: Users,
    title: 'Profile & Group Info',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    steps: [
      { title: 'View profile', detail: 'Attendees see their name, photo, title, company, and group info at the top of their microsite.' },
      { title: 'Edit profile', detail: 'Tap the pencil icon to update personal info, flight details, hotel info, dietary needs, and emergency contacts.' },
      { title: 'Upload profile photo', detail: 'Tap the camera icon on the avatar to upload or change their profile photo.' },
      { title: 'Group lead contact', detail: 'If assigned to a group, attendees see their group lead\'s name, email (tap to email), and phone (tap to call).' },
    ],
  },
  {
    id: 'att-calendar',
    icon: CalendarDays,
    title: 'Schedule & Events',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    steps: [
      { title: 'Browse the schedule', detail: 'A day-by-day scrollable calendar shows all events, color-coded by type (mandatory vs. optional).' },
      { title: 'View event details', detail: 'Tap any event to see the full description, talking points, meeting contacts with photos, and team attendees.' },
      { title: 'Download calendar', detail: 'Tap "Add to Calendar" to download an ICS file and import all events into their personal calendar app.' },
    ],
  },
  {
    id: 'att-docs',
    icon: FileText,
    title: 'Documents & Maps',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    steps: [
      { title: 'Fact sheets', detail: 'The active fact sheet appears as a tappable link that opens the PDF in a new tab.' },
      { title: 'Documents', detail: 'Any documents assigned to their group (or all groups) appear in an expandable Documents section.' },
      { title: 'Maps', detail: 'Uploaded maps appear in a separate Maps section. Tap to view full-screen.' },
    ],
  },
  {
    id: 'att-journal',
    icon: NotebookPen,
    title: 'Journal',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    steps: [
      { title: 'Write notes', detail: 'Attendees can write observations or notes. Each note can optionally be linked to a specific event from a dropdown.' },
      { title: 'Admin visibility', detail: 'All notes are submitted to the admin\'s Notes Feed for review.' },
      { title: 'Manage notes', detail: 'Attendees can view and delete their own notes.' },
    ],
  },
  {
    id: 'att-photos',
    icon: Camera,
    title: 'Trip Photos',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    steps: [
      { title: 'Upload photos', detail: 'Tap "Add photos to the trip album" to select one or multiple photos at once.' },
      { title: 'Bulk upload', detail: 'Select as many photos as you want — progress shows "Uploading 3 of 7..." as they process.' },
      { title: 'Auto-compression', detail: 'All photos (including HEIC from iPhones) are automatically compressed and converted to JPEG before uploading.' },
    ],
  },
  {
    id: 'att-pwa',
    icon: Smartphone,
    title: 'Install as App',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    steps: [
      { title: 'Add to Home Screen', detail: 'On supported devices, a banner prompts attendees to install the microsite as an app for quick access.' },
      { title: 'Offline support', detail: 'Once installed, the app caches content for faster loading. It always fetches fresh content when online.' },
    ],
  },
]

function SectionCard({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = section.icon

  return (
    <div
      className="rounded-xl border transition-all"
      style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${section.bg} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${section.color}`} />
        </div>
        <h3 className="font-semibold flex-1" style={{ color: 'var(--theme-text)' }}>{section.title}</h3>
        {expanded
          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />
        }
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {section.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-text)' }}
              >
                {i + 1}
              </div>
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--theme-text)' }}>{step.title}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GuidePage() {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [tab, setTab] = useState<'admin' | 'attendee'>('admin')
  const router = useRouter()

  useEffect(() => {
    const tripStr = localStorage.getItem('current_trip')
    if (!tripStr) { router.push('/events/admin/trips'); return }
    setTrip(JSON.parse(tripStr))
  }, [router])

  const tabClass = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-blue-600 text-white' : ''}`

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        {trip && (
          <TripHeader
            trip={trip}
            pageTitle="How to Use This App"
            pageSubtitle="Step-by-step guide for admins and attendees"
          />
        )}

        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setTab('admin')}
            className={tabClass('admin')}
            style={tab !== 'admin' ? { color: 'var(--theme-text-secondary)' } : {}}
          >
            Admin Guide
          </button>
          <button
            onClick={() => setTab('attendee')}
            className={tabClass('attendee')}
            style={tab !== 'attendee' ? { color: 'var(--theme-text-secondary)' } : {}}
          >
            Attendee Guide
          </button>
        </div>

        <div className="space-y-4">
          {(tab === 'admin' ? adminSections : attendeeSections).map(section => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>

        <p className="text-center mt-12 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
          Need help? Contact your administrator or reach out to the Covaled team.
        </p>
      </div>
    </div>
  )
}
