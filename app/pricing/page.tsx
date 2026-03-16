'use client'

import { useRouter } from 'next/navigation'
import {
  Check,
  X,
  Users,
  CalendarDays,
  Smartphone,
  FolderOpen,
  Megaphone,
  Map,
  AlertTriangle,
} from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: null,
    period: null,
    description: 'Perfect for trying out Covaled with a small group.',
    color: 'border-slate-700',
    badge: null,
    features: [
      { text: 'Up to 3 trips', included: true },
      { text: 'Up to 15 participants per trip', included: true },
      { text: 'Full feature access', included: true },
      { text: 'Attendee microsites', included: true },
      { text: 'Calendar & schedule management', included: true },
      { text: 'Document & file management', included: true },
      { text: '90-day trial period', included: true },
      { text: 'Multiple admin seats', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Get Started Free',
    ctaStyle: 'bg-slate-700 hover:bg-slate-600 text-white',
  },
  {
    name: 'Basic',
    price: '$1.99',
    period: 'per month',
    description: 'For solo organizers who run regular group trips.',
    color: 'border-slate-700',
    badge: null,
    features: [
      { text: 'Up to 3 trips', included: true },
      { text: 'Up to 15 participants per trip', included: true },
      { text: 'Full feature access', included: true },
      { text: 'Attendee microsites', included: true },
      { text: 'Calendar & schedule management', included: true },
      { text: 'Document & file management', included: true },
      { text: 'No expiry', included: true },
      { text: 'Multiple admin seats', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Start Basic',
    ctaStyle: 'bg-slate-700 hover:bg-slate-600 text-white',
  },
  {
    name: 'Pro',
    price: '$4.99',
    period: 'per month',
    description: 'For teams coordinating larger, more complex group travel.',
    color: 'border-blue-500',
    badge: 'Most Popular',
    features: [
      { text: 'Up to 5 trips', included: true },
      { text: 'Up to 25 participants per trip', included: true },
      { text: 'Full feature access', included: true },
      { text: 'Attendee microsites', included: true },
      { text: 'Calendar & schedule management', included: true },
      { text: 'Document & file management', included: true },
      { text: 'No expiry', included: true },
      { text: '3 admin seats', included: true },
      { text: 'Priority support', included: false },
    ],
    cta: 'Start Pro',
    ctaStyle: 'bg-blue-600 hover:bg-blue-500 text-white',
  },
  {
    name: 'Enterprise',
    price: '$9.99',
    period: 'per month',
    description: 'For organizations running high-volume, high-stakes group travel.',
    color: 'border-purple-500',
    badge: 'Unlimited',
    features: [
      { text: 'Unlimited trips', included: true },
      { text: 'Unlimited participants', included: true },
      { text: 'Full feature access', included: true },
      { text: 'Attendee microsites', included: true },
      { text: 'Calendar & schedule management', included: true },
      { text: 'Document & file management', included: true },
      { text: 'No expiry', included: true },
      { text: 'Unlimited admin seats', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Start Enterprise',
    ctaStyle: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
]

const featureHighlights = [
  { icon: Users,       label: 'Participant Management' },
  { icon: CalendarDays, label: 'Schedule & Calendar' },
  { icon: Smartphone,  label: 'Attendee Microsites' },
  { icon: FolderOpen,  label: 'Document Sharing' },
  { icon: Megaphone,   label: 'Broadcast Messaging' },
  { icon: Map,         label: 'Maps & Fact Sheets' },
]

const faqs = [
  {
    q: 'What counts as a "trip"?',
    a: 'A trip is any group travel event you create in Covaled — a fly-in, conference, retreat, or any other coordinated group outing. Each trip has its own participants, schedule, and attendee microsites.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. You can change your plan at any time. Upgrades take effect immediately. Downgrades take effect at the start of your next billing cycle.',
  },
  {
    q: 'What happens when my free trial expires?',
    a: "After 90 days on the free tier, you'll need to upgrade to a paid plan to continue creating trips and adding participants. Your existing data is never deleted.",
  },
  {
    q: 'What is an admin seat?',
    a: 'Admin seats allow you to invite colleagues to co-manage a trip — viewing participants, editing schedules, and sending broadcasts. Free and Basic plans are single-user only.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Covaled is built on Supabase with row-level security, meaning your data is only accessible to authenticated users you authorize. Attendee links are unique, token-based, and cannot be guessed.',
  },
]

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-950">

      {/* Nav */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm transition-colors">
            ← Back
          </button>
          <h1 className="text-white font-bold text-lg">Covaled</h1>
          <a href="/admin/login" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            Sign in
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">

        {/* Beta banner — FIX: replaced ⚠ emoji with AlertTriangle icon */}
        <div className="mb-10 text-center">
          <p className="text-red-400 text-sm font-medium flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Currently in Beta Testing — Pricing Not in Effect — Contact Admin to Escalate Privileges for Free
          </p>
        </div>

        {/* Hero */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            Covaled is built for organizations that take group travel seriously.
            From solo trip organizers to enterprise advocacy teams — there's a plan for every scale.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`relative bg-slate-900 border-2 ${plan.color} rounded-2xl p-6 flex flex-col`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold ${
                  plan.name === 'Pro' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                }`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
                <div className="mb-3">
                  {plan.price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-slate-500 text-sm">{plan.period}</span>
                    </div>
                  ) : (
                    <span className="text-4xl font-bold text-white">Free</span>
                  )}
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f.text} className="flex items-start gap-2.5">
                    {f.included ? (
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${f.included ? 'text-slate-300' : 'text-slate-600'}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => router.push('/admin/signup')}
                className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${plan.ctaStyle}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Feature comparison callout */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-20">
          <h3 className="text-white font-bold text-2xl mb-2 text-center">Everything you need to run a flawless trip</h3>
          <p className="text-slate-400 text-center mb-8">Every plan includes Covaled's full feature set.</p>
          {/* FIX: replaced emoji spans with Lucide icon components */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-center">
            {featureHighlights.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-slate-400 text-xs leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-20">
          <h3 className="text-white font-bold text-2xl text-center mb-8">Frequently asked questions</h3>
          <div className="space-y-6">
            {faqs.map(faq => (
              <div key={faq.q} className="border-b border-slate-800 pb-6">
                <p className="text-white font-medium mb-2">{faq.q}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center bg-slate-900 border border-slate-800 rounded-2xl p-12">
          <h3 className="text-white font-bold text-3xl mb-3">Ready to coordinate better?</h3>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto">
            Join organizations already using Covaled to run smoother, better-coordinated group trips.
            Start free — no credit card required.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push('/admin/signup')}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Get started free
            </button>
            {/* FIX: restored malformed <a> tag */}
            <a
              href="mailto:admin@covaled.com"
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
            >
              Contact us
            </a>
          </div>
          <p className="text-slate-600 text-xs mt-6 flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Beta pricing is not currently in effect. Contact your administrator to adjust subscription levels.
          </p>
        </div>

      </div>
    </div>
  )
}