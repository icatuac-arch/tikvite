'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Loader2, X, Check } from 'lucide-react'

type Signal = 'going' | 'interested' | 'maybe'

interface Attendee {
  name: string
  avatar_url: string | null
  signal: Signal
}

interface InterestData {
  going: number
  interested: number
  maybe: number
  attendees: Attendee[]
}

interface Props {
  eventId: string
}

const AVATAR_COLORS: Record<Signal, string> = {
  going: 'bg-green-500',
  interested: 'bg-indigo-500',
  maybe: 'bg-amber-500',
}

const SIGNAL_CONFIG: {
  key: Signal
  label: string
  active: string
  inactive: string
  check: string
}[] = [
  {
    key: 'going',
    label: 'Going',
    active: 'bg-green-500 text-white border-green-500',
    inactive: 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600',
    check: 'text-white',
  },
  {
    key: 'interested',
    label: 'Interested',
    active: 'bg-indigo-500 text-white border-indigo-500',
    inactive: 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600',
    check: 'text-white',
  },
  {
    key: 'maybe',
    label: 'Maybe',
    active: 'bg-amber-500 text-white border-amber-500',
    inactive: 'bg-white text-gray-600 border-gray-200 hover:border-amber-400 hover:text-amber-600',
    check: 'text-white',
  },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/* ── Identity modal ───────────────────────────────────────────────────── */
interface IdentityModalProps {
  pendingSignal: Signal
  onConfirm: (name: string, email: string) => void
  onClose: () => void
}

function IdentityModal({ pendingSignal, onConfirm, onClose }: IdentityModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const config = SIGNAL_CONFIG.find((s) => s.key === pendingSignal)!

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Please fill in both fields.')
      return
    }
    onConfirm(name.trim(), email.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Who&apos;s going?</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Tell us your name and email so we can show you on the{' '}
          <span className="font-medium text-gray-700">&quot;Who&apos;s Going&quot;</span> list.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Your name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 border ${config.active}`}
          >
            <Check size={15} />
            Mark as {config.label}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function WhosGoing({ eventId }: Props) {
  const [data, setData] = useState<InterestData>({ going: 0, interested: 0, maybe: 0, attendees: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mySignal, setMySignal] = useState<Signal | null>(null)
  const [pendingSignal, setPendingSignal] = useState<Signal | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchInterest = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}/interest`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setData(json)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance data.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchInterest()
    // Restore signal from localStorage
    const savedSignal = localStorage.getItem(`signal_${eventId}`) as Signal | null
    if (savedSignal) setMySignal(savedSignal)
  }, [fetchInterest, eventId])

  async function submitSignal(name: string, email: string, signal: Signal) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/events/${eventId}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, user_name: name, signal }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)

      // Save to localStorage
      localStorage.setItem('comment_name', name)
      localStorage.setItem('comment_email', email)
      localStorage.setItem(`signal_${eventId}`, signal)
      setMySignal(signal)

      // Refresh counts
      await fetchInterest()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSubmitting(false)
      setPendingSignal(null)
    }
  }

  function handleSignalClick(signal: Signal) {
    const email = localStorage.getItem('comment_email')
    const name = localStorage.getItem('comment_name')
    if (email && name) {
      submitSignal(name, email, signal)
    } else {
      setPendingSignal(signal)
    }
  }

  function handleIdentityConfirm(name: string, email: string) {
    if (pendingSignal) submitSignal(name, email, pendingSignal)
  }

  // Build summary string
  const parts: string[] = []
  if (data.going > 0) parts.push(`${data.going} going`)
  if (data.interested > 0) parts.push(`${data.interested} interested`)
  if (data.maybe > 0) parts.push(`${data.maybe} maybe`)
  const summary = parts.join(' · ')

  // First 8 attendees for avatar row
  const shownAttendees = data.attendees.slice(0, 8)
  const overflow = data.attendees.length - shownAttendees.length

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading attendance…
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-red-500 py-2">{error}</div>
  }

  return (
    <>
      <section className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-indigo-500" />
          <h2 className="text-base font-bold text-gray-800">Who&apos;s Going</h2>
        </div>

        {/* Count summary */}
        {summary && (
          <p className="text-sm text-gray-500 mb-4">{summary}</p>
        )}

        {/* Avatar row */}
        {shownAttendees.length > 0 && (
          <div className="flex items-center mb-4">
            <div className="flex -space-x-2">
              {shownAttendees.map((att, i) => (
                <div
                  key={i}
                  title={`${att.name} (${att.signal})`}
                  className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-semibold ${AVATAR_COLORS[att.signal]}`}
                >
                  {att.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.avatar_url}
                      alt={att.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(att.name)
                  )}
                </div>
              ))}
              {overflow > 0 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                  +{overflow}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signal buttons */}
        <div className="flex flex-wrap gap-2">
          {SIGNAL_CONFIG.map((cfg) => {
            const isActive = mySignal === cfg.key
            return (
              <button
                key={cfg.key}
                onClick={() => handleSignalClick(cfg.key)}
                disabled={submitting}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all disabled:opacity-60 ${
                  isActive ? cfg.active : cfg.inactive
                }`}
              >
                {isActive && <Check size={13} className={cfg.check} />}
                {submitting && mySignal === cfg.key ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : null}
                {cfg.label}
              </button>
            )
          })}
        </div>

        {data.going === 0 && data.interested === 0 && data.maybe === 0 && (
          <p className="text-sm text-gray-400 mt-3">
            Be the first to signal your interest!
          </p>
        )}
      </section>

      {/* Identity modal */}
      {pendingSignal && (
        <IdentityModal
          pendingSignal={pendingSignal}
          onConfirm={handleIdentityConfirm}
          onClose={() => setPendingSignal(null)}
        />
      )}
    </>
  )
}
