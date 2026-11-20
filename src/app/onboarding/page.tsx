'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Building2, Mail, Rocket, ChevronLeft, ChevronRight, Check } from 'lucide-react'

const ORG_TYPES = [
  'Individual',
  'Nonprofit',
  'Business',
  'School',
  'Community Group',
  'Religious Org',
  'Other',
] as const

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Form state
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState<string>('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserId(data.user.id)
      setEmail(data.user.email || '')
    })
  }, [supabase, router])

  const totalSteps = 4

  const canNext = () => {
    if (step === 2) return orgName.trim().length > 0 && orgType.length > 0
    if (step === 3) return email.trim().length > 0
    return true
  }

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleFinish = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const bio = [
        orgType && orgType !== 'Individual' ? orgType : '',
        phone ? `Phone: ${phone}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      await supabase
        .from('profiles')
        .update({
          name: orgName.trim(),
          bio: bio || null,
        })
        .eq('id', userId)

      localStorage.setItem('onboarding-complete', 'true')
      router.push('/dashboard/create')
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const stepLabels = ['Welcome', 'Organization', 'Contact', 'Create']

  return (
    <>
      <div className="min-h-screen bg-surface-muted flex items-start justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-lg">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              {stepLabels.map((label, i) => {
                const stepNum = i + 1
                const isActive = stepNum === step
                const isComplete = stepNum < step
                return (
                  <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        isComplete
                          ? 'bg-primary text-white'
                          : isActive
                          ? 'bg-primary text-white ring-4 ring-primary/20'
                          : 'bg-border text-text-muted'
                      }`}
                    >
                      {isComplete ? <Check size={16} /> : stepNum}
                    </div>
                    <span
                      className={`text-xs font-medium transition-colors ${
                        isActive || isComplete ? 'text-primary' : 'text-text-muted'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-border shadow-lg shadow-black/[0.04] p-8">
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto">
                  <Sparkles className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="font-heading text-2xl font-bold text-text">
                    Welcome to Ticvite!
                  </h1>
                  <p className="text-text-secondary mt-2 leading-relaxed">
                    You&apos;re just a few steps away from creating amazing events with
                    free ticketing, instant check-in, and powerful analytics.
                  </p>
                </div>
                <p className="text-text-muted text-sm">
                  Let&apos;s set up your organizer account so you can start selling
                  tickets in minutes.
                </p>
              </div>
            )}

            {/* Step 2: Organization */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="text-primary" size={24} />
                  </div>
                  <h2 className="font-heading text-xl font-bold text-text">
                    Your Organization
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Tell us about yourself or your organization.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">
                      Organization / Your Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Bay Area Dance Academy"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">
                      Organization Type <span className="text-danger">*</span>
                    </label>
                    <select
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition appearance-none"
                    >
                      <option value="">Select type...</option>
                      {ORG_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Contact */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                    <Mail className="text-primary" size={24} />
                  </div>
                  <h2 className="font-heading text-xl font-bold text-text">
                    Contact Information
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">
                    How can attendees reach you?
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-surface-muted text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                      readOnly
                    />
                    <p className="text-xs text-text-muted mt-1">
                      Pre-filled from your account.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-1.5">
                      Phone <span className="text-text-muted">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Create First Event */}
            {step === 4 && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center mx-auto">
                  <Rocket className="text-white" size={28} />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-text">
                    You&apos;re All Set!
                  </h2>
                  <p className="text-text-secondary mt-2 leading-relaxed">
                    Your organizer profile is ready. Now let&apos;s create your first
                    event and start selling tickets — completely free.
                  </p>
                </div>
                <div className="bg-primary-50 rounded-xl p-4 text-sm text-primary font-medium">
                  Zero platform fees. Unlimited events. Beautiful event pages.
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              {step > 1 ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text transition"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < totalSteps ? (
                <button
                  onClick={handleNext}
                  disabled={!canNext()}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-50 transition"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Rocket size={16} />
                  )}
                  Create Your First Event
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
