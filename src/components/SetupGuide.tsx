'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react'

const STEPS = [
  {
    title: 'Tell us about your event',
    description: 'Add a catchy title, pick a category, and write a description that makes people want to attend.',
    example: 'Example: "Diwali Mela 2026 - A celebration of lights, food, and community"',
    section: 'details',
  },
  {
    title: 'When is it?',
    description: 'Set the date and time so attendees know when to show up.',
    example: 'Tip: Events on weekends tend to get more RSVPs.',
    section: 'datetime',
  },
  {
    title: 'Where is it?',
    description: 'Add the venue name and address. We will auto-detect the city and state from the address.',
    example: 'Tip: Type the full address and we will fill in the rest.',
    section: 'location',
  },
  {
    title: 'Add an eye-catching poster',
    description: 'Upload a poster image to make your event stand out in listings and social shares.',
    example: 'Recommended: 1200x675px (16:9) or 1080x1080px (square).',
    section: 'poster',
  },
  {
    title: 'How will people get tickets?',
    description: 'Paste an external ticket link (Eventbrite, etc.) or use our built-in RSVP system.',
    example: 'Free events just need RSVP enabled -- no payment setup needed.',
    section: 'tickets',
  },
  {
    title: 'Ready to go live!',
    description: 'Once all required items are checked, hit the "Go Live" button to publish your event.',
    example: 'You can unpublish anytime to make changes.',
    section: '',
  },
]

interface SetupGuideProps {
  onDismiss: () => void
}

export default function SetupGuide({ onDismiss }: SetupGuideProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]

  const scrollToSection = (section: string) => {
    if (!section) return
    const el = document.getElementById(section)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Add a brief pulsing highlight
      el.classList.add('ring-2', 'ring-[#7C3AED]', 'ring-offset-2')
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#7C3AED]', 'ring-offset-2'), 3000)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96">
      <div
        className="rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#fff', border: '2px solid #7C3AED' }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
        >
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={18} />
            <span className="text-sm font-bold">Setup Guide</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">
              {step + 1}/{STEPS.length}
            </span>
            <button
              onClick={onDismiss}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-5 pt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full flex-1 transition-all duration-300"
              style={{ backgroundColor: i <= step ? '#7C3AED' : '#E2E8F0' }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          <h4 className="text-base font-bold" style={{ color: '#334155' }}>
            {current.title}
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
            {current.description}
          </p>
          <p
            className="text-xs italic px-3 py-2 rounded-lg"
            style={{ backgroundColor: '#F8FAFC', color: '#94A3B8' }}
          >
            {current.example}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm font-medium disabled:opacity-30 transition-colors"
            style={{ color: '#4F46E5' }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onDismiss}
              className="text-xs underline"
              style={{ color: '#94A3B8' }}
            >
              Skip
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => {
                  if (current.section) scrollToSection(current.section)
                  setStep(step + 1)
                }}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                style={{ backgroundColor: '#7C3AED', color: '#fff' }}
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={onDismiss}
                className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
              >
                Got it!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
