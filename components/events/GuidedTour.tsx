'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'

interface TourStep {
  target: string // CSS selector
  title: string
  content: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-grid"]',
    title: 'Dashboard Navigation',
    content: 'These tiles are your main navigation. Each one leads to a different section of your trip management tools.',
    position: 'bottom',
  },
  {
    target: '[data-tour="tile-participants"]',
    title: 'Participants',
    content: 'Add and manage your attendees here. Each participant gets a unique microsite link you can share with them.',
    position: 'bottom',
  },
  {
    target: '[data-tour="tile-groups"]',
    title: 'Groups',
    content: 'Organize participants into groups. Assign a group lead, and target events, documents, and broadcasts to specific groups.',
    position: 'bottom',
  },
  {
    target: '[data-tour="tile-schedule"]',
    title: 'Schedule',
    content: 'Build your event calendar. Add events with talking points, meeting contacts, and photos. Attendees see these on their microsite.',
    position: 'bottom',
  },
  {
    target: '[data-tour="tile-notes"]',
    title: 'Notes Feed',
    content: 'View journal entries submitted by participants from their microsites. Filter by person or group.',
    position: 'bottom',
  },
  {
    target: '[data-tour="tile-import"]',
    title: 'Import',
    content: 'Bulk import participants from CSV files or events from ICS calendar files.',
    position: 'bottom',
  },
  {
    target: '[data-tour="tile-files"]',
    title: 'File Management',
    content: 'Upload fact sheets, documents, and maps for attendees. Download trip photos as a ZIP.',
    position: 'bottom',
  },
  {
    target: '[data-tour="broadcast"]',
    title: 'Broadcasts',
    content: 'Send real-time messages to all attendees or specific groups. They appear as banners on the attendee microsite.',
    position: 'top',
  },
]

const STORAGE_KEY = 'covaled_tour_completed'

export default function GuidedTour() {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({})

  // Show tour button if not completed
  const [showButton, setShowButton] = useState(false)
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShowButton(true)
    }
  }, [])

  const positionTooltip = useCallback(() => {
    const currentStep = TOUR_STEPS[step]
    if (!currentStep) return
    const el = document.querySelector(currentStep.target)
    if (!el) return

    const rect = el.getBoundingClientRect()
    const tooltipWidth = 320
    const gap = 12

    let top = 0
    let left = 0
    let arrowTop = 0
    let arrowLeft = 0

    switch (currentStep.position) {
      case 'bottom':
        top = rect.bottom + gap
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        arrowTop = -6
        arrowLeft = tooltipWidth / 2 - 6
        break
      case 'top':
        top = rect.top - gap - 160
        left = rect.left + rect.width / 2 - tooltipWidth / 2
        arrowTop = 160 - 6
        arrowLeft = tooltipWidth / 2 - 6
        break
      case 'right':
        top = rect.top + rect.height / 2 - 80
        left = rect.right + gap
        arrowTop = 80 - 6
        arrowLeft = -6
        break
      case 'left':
        top = rect.top + rect.height / 2 - 80
        left = rect.left - tooltipWidth - gap
        arrowTop = 80 - 6
        arrowLeft = tooltipWidth - 6
        break
    }

    // Clamp to viewport
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12))
    top = Math.max(12, top)

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: tooltipWidth,
      zIndex: 10001,
    })
    setArrowStyle({
      position: 'absolute',
      top: arrowTop,
      left: arrowLeft,
      width: 12,
      height: 12,
      transform: 'rotate(45deg)',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderWidth: currentStep.position === 'bottom' ? '1px 0 0 1px' : currentStep.position === 'top' ? '0 1px 1px 0' : '1px',
    })

    // Highlight the target element
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [step])

  useEffect(() => {
    if (!active) return
    positionTooltip()
    window.addEventListener('resize', positionTooltip)
    window.addEventListener('scroll', positionTooltip, true)
    return () => {
      window.removeEventListener('resize', positionTooltip)
      window.removeEventListener('scroll', positionTooltip, true)
    }
  }, [active, step, positionTooltip])

  function startTour() {
    setStep(0)
    setActive(true)
  }

  function endTour() {
    setActive(false)
    localStorage.setItem(STORAGE_KEY, 'true')
    setShowButton(false)
  }

  function next() {
    if (step < TOUR_STEPS.length - 1) setStep(step + 1)
    else endTour()
  }

  function prev() {
    if (step > 0) setStep(step - 1)
  }

  const currentStep = TOUR_STEPS[step]

  if (!showButton && !active) return null

  return (
    <>
      {/* Start tour button */}
      {showButton && !active && (
        <button
          onClick={startTour}
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
        >
          Take a Tour
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Tour overlay */}
      {active && currentStep && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-[10000]" onClick={endTour} />

          {/* Highlight cutout — raise targeted element above backdrop */}
          <style>{`
            ${currentStep.target} {
              position: relative;
              z-index: 10001 !important;
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.2);
              border-radius: 12px;
            }
          `}</style>

          {/* Tooltip */}
          <div style={tooltipStyle}>
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 relative">
              <div style={arrowStyle} />
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-white text-sm">{currentStep.title}</h4>
                <button onClick={endTour} className="text-slate-400 hover:text-white ml-2 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-300 text-sm mb-4">{currentStep.content}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{step + 1} of {TOUR_STEPS.length}</span>
                <div className="flex gap-2">
                  {step > 0 && (
                    <button onClick={prev} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-300 hover:text-white transition-colors">
                      <ChevronLeft className="w-3 h-3" /> Back
                    </button>
                  )}
                  <button
                    onClick={next}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {step === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
