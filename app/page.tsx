'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  CalendarDays,
  Megaphone,
  FolderOpen,
  ArrowRight,
  CheckCircle,
  XCircle,
  Plane,
  Hotel,
  Calendar,
  FileText,
  UserCircle,
  Radio,
  NotebookPen,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    title: 'Personal Attendee Microsites',
    description:
      'Every participant gets their own private link with everything they need — flights, hotel, schedule, documents, and emergency contacts. No app download required.',
  },
  {
    icon: CalendarDays,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    title: 'Schedule & Calendar Management',
    description:
      'Build a detailed trip schedule with mandatory and optional events. Attendees see only what applies to them, always in their timezone.',
  },
  {
    icon: Megaphone,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    title: 'Broadcast Messaging',
    description:
      'Send real-time updates to your whole group or specific subgroups. Dinner moved to 7pm? Gate change? Everyone knows instantly.',
  },
  {
    icon: FolderOpen,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    title: 'Documents & Fact Sheets',
    description:
      'Upload briefing documents, maps, and fact sheets. Attach them to specific groups or share with everyone — available on every microsite.',
  },
]

const painPoints = [
  'A spreadsheet that only you can read',
  'A group email thread that nobody checks',
  'Answering the same question fourteen times',
  'A frantic 6am text: "wait, what hotel are we at?"',
]

const micrositeItems = [
  { icon: Plane,       color: 'text-blue-400',   label: 'Their flights' },
  { icon: Hotel,       color: 'text-purple-400',  label: 'Their hotel' },
  { icon: Calendar,    color: 'text-green-400',   label: 'Their schedule' },
  { icon: FileText,    color: 'text-orange-400',  label: 'Their documents' },
  { icon: UserCircle,  color: 'text-sky-400',     label: 'Their group lead' },
  { icon: Radio,       color: 'text-amber-400',   label: 'Live broadcasts' },
  { icon: NotebookPen, color: 'text-pink-400',    label: 'Notes & journal' },
  { icon: MapPin,      color: 'text-red-400',     label: 'Maps & venues' },
]

const slides: {
  src: string
  headline: string
  description: string
  objectPosition?: string
  objectScale?: boolean
}[] = [
  {
    src: '/sample_Trip_management_Page.png',
    headline: 'Command center for every trip',
    description:
      'See all your participants, broadcast messages, and jump to any section of your trip from one clean dashboard.',
    objectPosition: 'center top',
  },
  {
    src: '/sample_Participants_Page.png',
    headline: 'Every attendee, at a glance',
    description:
      'View all attendees with their company, email, group, and hotel room — search, sort, and copy their personal microsite link in one click.',
    objectPosition: 'center top',
  },
  {
    src: '/sample_Scheduling_Page.png',
    headline: 'A full calendar built for group travel',
    description:
      'Plot mandatory and optional events across the trip dates. Attendees only see the events that apply to them, always in their own timezone.',
    objectPosition: 'center top',
  },
  {
    src: '/sample_Microsite_top.png',
    headline: 'Their personal link — everything they need',
    description:
      'Each attendee sees their own profile, live broadcast alerts, group lead contact, flights, hotel room, and fun diversions — no login required.',
    objectPosition: 'center top',
  },
  {
    src: '/sample_Microsite_bottom.png',
    headline: 'Schedule, notes, and maps — always in pocket',
    description:
      'Attendees can view their personal schedule, take trip notes, and install the site as a PWA on their home screen for offline access.',
    objectPosition: 'center top',
  },
  {
    src: '/sample_Notes_Page.png',
    headline: 'A live notes feed from the field',
    description:
      'Participants submit notes from their meetings and you see them in real time — filterable by group, sortable by time, and downloadable as a report.',
    objectPosition: 'center bottom',
  },
  {
    src: '/sample_Groups_Page.png',
    headline: 'Organize attendees into groups',
    description:
      'Create subgroups with a named lead, email, and phone. Participants are assigned to a group and see their lead contact on their microsite.',
    objectPosition: 'center center',
    objectScale: true,
  },
  {
    src: '/sample_File_Mgmt_Top.png',
    headline: 'One active fact sheet, always current',
    description:
      'Upload a PDF fact sheet and mark it active — it surfaces as a download button on every attendee microsite automatically.',
    objectPosition: 'center 30%',
  },
  {
    src: '/sample_File_Mgmt_Bottom.png',
    headline: 'Documents and maps for every group',
    description:
      'Upload briefing docs and maps, then scope visibility to all groups or specific ones. Documents appear in the attendee "Your Documents" section.',
    objectPosition: 'center 40%',
  },
  {
    src: '/sample_Import_Page.png',
    headline: 'Bulk import participants in seconds',
    description:
      'Upload a CSV with flights, hotels, and emergency contacts. Preview the import before committing — existing attendees are updated, not duplicated.',
    objectPosition: 'center 35%',
  },
]

// ─── Screenshot Carousel ──────────────────────────────────────────────────────

function ScreenshotCarousel() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const total = slides.length

  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total])
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total])

  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(next, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, next])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? next() : prev()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  return (
    <section className="py-16 md:py-24 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">
            See it in action
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mt-3">
            Built for the way
            <br />
            <span className="text-slate-400">organizers actually work.</span>
          </h2>
        </div>

        <div
          className="relative rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-black/50 select-none"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile uses 4:3, desktop uses 16:10 */}
          <div className="relative aspect-[4/3] md:aspect-[16/10] bg-slate-900">
            {slides.map((slide, i) => (
              <div
                key={slide.src}
                aria-hidden={i !== current}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
              >
                {slide.objectScale ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <img
                      src={slide.src}
                      alt={slide.headline}
                      className="w-[110%] h-full object-contain"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <img
                    src={slide.src}
                    alt={slide.headline}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: slide.objectPosition ?? 'center top' }}
                    draggable={false}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 z-20">
                  <p className="text-white font-bold text-base md:text-2xl leading-snug mb-1 md:mb-2">
                    {slide.headline}
                  </p>
                  <p className="text-slate-300 text-xs md:text-base leading-relaxed max-w-2xl hidden sm:block">
                    {slide.description}
                  </p>
                  {/* Abbreviated description on mobile */}
                  <p className="text-slate-300 text-xs leading-relaxed sm:hidden line-clamp-2">
                    {slide.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => { prev(); setPaused(true) }}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 rounded-full bg-slate-900/70 border border-slate-700/50 text-white hover:bg-slate-800 hover:border-slate-600 transition-all backdrop-blur-sm"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          <button
            onClick={() => { next(); setPaused(true) }}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-1.5 md:p-2 rounded-full bg-slate-900/70 border border-slate-700/50 text-white hover:bg-slate-800 hover:border-slate-600 transition-all backdrop-blur-sm"
          >
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          <div className="absolute bottom-3 right-4 z-30 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); setPaused(true) }}
                aria-label={`Go to slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'bg-blue-400 w-4 h-2'
                    : 'bg-slate-500/70 hover:bg-slate-400 w-2 h-2'
                }`}
              />
            ))}
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4 tabular-nums">
          {current + 1} / {total}
        </p>
      </div>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
          <span className="text-white font-bold text-lg md:text-xl shrink-0">Covaled</span>
          <div className="flex items-center gap-2 md:gap-4">
            {/* Hide Pricing link on very small screens to avoid crowding */}
            <a href="/pricing" className="hidden sm:block text-slate-400 hover:text-white text-sm transition-colors">Pricing</a>
            <a href="/admin/login" className="text-slate-400 hover:text-white text-sm transition-colors">Sign in</a>
            <button
              onClick={() => router.push('/admin/signup')}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* ── 1. HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src="/covaled-hero.png" alt="Group travel" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/50 to-slate-950" />
        </div>
        <div className="relative z-10 text-center max-w-4xl mx-auto px-5 pt-20 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs md:text-sm font-medium mb-6 md:mb-8">
            Group travel, finally coordinated
          </div>
          {/* FIX: text-4xl on mobile (was text-5xl, too large) */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight mb-5 md:mb-6">
            Every great trip needs
            <span className="text-blue-400"> someone leading</span>
            <br />
            the pack.
          </h1>
          {/* FIX: smaller body text on mobile */}
          <p className="text-base md:text-xl text-slate-300 max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed">
            Covaled gives group travel organizers a command center — and gives every attendee a personal microsite with everything they need, right in their pocket.
          </p>
          {/* FIX: stack buttons vertically on mobile, side-by-side on sm+ */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <button
              onClick={() => router.push('/admin/signup')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 md:px-8 md:py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-base md:text-lg"
            >
              Get started free
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <a
              href="/pricing"
              className="w-full sm:w-auto text-center px-6 py-3.5 md:px-8 md:py-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors text-base md:text-lg backdrop-blur-sm"
            >
              See pricing
            </a>
          </div>
          <p className="text-slate-500 text-xs md:text-sm mt-4">Free for 90 days · No credit card required</p>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-500">
          <span className="text-xs">scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-slate-500 to-transparent" />
        </div>
      </section>

      {/* ── 2. THE CORE IDEA ── */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">The core idea</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-4 md:mb-6">
              A personal microsite
              <br />
              <span className="text-slate-400">for every attendee.</span>
            </h2>
            <p className="text-slate-400 text-base md:text-xl max-w-2xl mx-auto">
              You set everything up once. Each participant gets a unique private link showing only their information. No login. No app. No confusion.
            </p>
          </div>
          {/* 2-col on mobile, 4-col on md */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10 md:mb-16">
            {micrositeItems.map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 p-3 md:p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <Icon className={`w-5 h-5 md:w-6 md:h-6 ${color}`} />
                <span className="text-slate-300 text-xs md:text-sm text-center">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 p-4 md:p-5 bg-green-500/5 border border-green-500/20 rounded-2xl max-w-lg mx-auto">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-300 text-sm">Attendees can install it as a PWA on their phone home screen — works offline, no app store needed.</p>
          </div>
        </div>
      </section>

      {/* ── 3. VIDEO ── */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">
              Watch it in action
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-3">
              See a full trip,
              <br />
              <span className="text-slate-400">start to finish.</span>
            </h2>
          </div>
          <div className="rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-black/50">
            <video
              autoPlay
              muted
              loop
              playsInline
              controls
              className="w-full"
              src="https://fferiutafqvcomnwvmal.supabase.co/storage/v1/object/public/video_assets/Covaled%20(720.a).mp4"
            />
          </div>
        </div>
      </section>

      {/* ── 4. PAIN SECTION ── */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-6">
            Managing a group trip
            <span className="text-slate-500"> should not feel like this.</span>
          </h2>
          <p className="text-slate-400 text-base md:text-xl mb-10 md:mb-16 max-w-2xl mx-auto">
            You have been the person holding everything together. You know what that looks like.
          </p>
          {/* 1-col on mobile, 2-col on md */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-2xl mx-auto">
            {painPoints.map((point, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-left">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm md:text-base">{point}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 md:mt-16 max-w-2xl mx-auto">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-10 md:mb-16" />
            <p className="text-lg md:text-2xl text-white font-medium leading-relaxed">
              There is a better way. One link, sent to each person.
              <span className="text-blue-400"> Everything they need, nothing they do not.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. SCREENSHOT CAROUSEL ── */}
      <ScreenshotCarousel />

      {/* Features */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Built for organizers</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-3">
              Everything you need
              <br />
              <span className="text-slate-400">to run a flawless trip.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {features.map(({ icon: Icon, color, bg, title, description }) => (
              <div key={title} className="p-6 md:p-8 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors">
                <div className={`inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl mb-4 md:mb-5 ${bg}`}>
                  <Icon className={`w-5 h-5 md:w-6 md:h-6 ${color}`} />
                </div>
                <h3 className="text-white font-bold text-lg md:text-xl mb-2 md:mb-3">{title}</h3>
                <p className="text-slate-400 text-sm md:text-base leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 md:py-24 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">Built for anyone leading a group.</h2>
          <p className="text-slate-400 text-base md:text-xl mb-10 md:mb-16">From Capitol Hill fly-ins to corporate retreats.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: 'Trade Associations', desc: 'Hill Days and Fly-Ins' },
              { label: 'Corporate Teams',    desc: 'Offsites and Retreats' },
              { label: 'Event Planners',     desc: 'Group Conferences' },
              { label: 'Tour Operators',     desc: 'Managed Group Travel' },
            ].map(item => (
              <div key={item.label} className="p-4 md:p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <p className="text-white font-semibold text-xs md:text-sm">{item.label}</p>
                <p className="text-slate-500 text-xs mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-slate-900/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">Start free. Scale when you are ready.</h2>
          <p className="text-slate-400 text-base md:text-xl mb-8 md:mb-10">The free tier gives you 90 days and up to 3 trips with 15 participants each.</p>
          {/* FIX: 2-col grid on mobile instead of wrapping flex */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-2 md:gap-3 mb-8 md:mb-10">
            {['Free — 90 day trial', 'Basic — $1.99/mo', 'Pro — $4.99/mo', 'Enterprise — $9.99/mo'].map(plan => (
              <span key={plan} className="px-3 py-2 md:px-4 bg-slate-800 border border-slate-700 rounded-full text-slate-300 text-xs md:text-sm text-center">{plan}</span>
            ))}
          </div>
          <a href="/pricing" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">See full plan comparison</a>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 md:py-32 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/covaled-hero.png" alt="" className="w-full h-full object-cover object-top opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-slate-950/80" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-5 md:mb-6">
            Ready to lead
            <span className="text-blue-400"> a better trip?</span>
          </h2>
          <p className="text-slate-300 text-base md:text-xl mb-8 md:mb-10">
            Join the organizers who have stopped herding cats and started running coordinated, professional group travel.
          </p>
          <button
            onClick={() => router.push('/admin/signup')}
            className="flex items-center gap-2 px-8 py-4 md:px-10 md:py-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-lg md:text-xl mx-auto"
          >
            Get started free
            <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <p className="text-slate-600 text-xs md:text-sm mt-4">Free for 90 days · No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 md:py-10 px-4 md:px-6">
        {/* FIX: column layout on mobile, row on md */}
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:justify-between gap-4 text-center md:text-left">
          <span className="text-white font-bold">Covaled</span>
          <p className="text-slate-600 text-sm italic">Group travel, coordinated.</p>
          <div className="flex items-center gap-4 md:gap-6 text-slate-500 text-sm">
            <a href="/pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="/admin/login" className="hover:text-white transition-colors">Sign in</a>
            <a href="/admin/signup" className="hover:text-white transition-colors">Sign up</a>
          </div>
        </div>
      </footer>

    </div>
  )
}