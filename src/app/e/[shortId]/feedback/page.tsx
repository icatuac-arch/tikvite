'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Star, Send, CheckCircle2, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function getShortId(id: string): string {
  return id.replace(/-/g, '').substring(0, 7)
}

export default function FeedbackPage() {
  const params = useParams()
  const shortId = params.shortId as string

  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function loadEvent() {
      try {
        const lo = `${shortId}0-0000-0000-0000-000000000000`
        const hi = `${shortId}f-ffff-ffff-ffff-ffffffffffff`
        const res = await fetch(`/api/events?id_gte=${lo}&id_lte=${hi}&limit=16`)
        if (!res.ok) {
          // Fallback: try fetching by prefix search
          setLoading(false)
          return
        }
        const data = await res.json()
        const events = data.events || data.data || []
        const found = events.find((e: any) => getShortId(e.id) === shortId) || events[0]
        if (found) setEvent(found)
      } catch {
        // silent
      }
      setLoading(false)
    }
    loadEvent()
  }, [shortId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) {
      setErrorMsg('Please select a star rating')
      return
    }
    setErrorMsg(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/events/${event.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          rating,
          comment: comment.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrorMsg(data.message || 'Failed to submit feedback')
        setSubmitting(false)
        return
      }
      setSubmitted(true)
    } catch {
      setErrorMsg('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00')
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-10">
        {/* Back link */}
        <Link
          href={`/e/${shortId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 hover:opacity-70 transition-opacity"
          style={{ color: '#4F46E5' }}
        >
          <ArrowLeft size={16} /> Back to event
        </Link>

        {loading && (
          <div className="text-center py-20">
            <div
              className="animate-spin rounded-full h-8 w-8 border-t-2 mx-auto"
              style={{ borderColor: '#4F46E5' }}
            />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>Loading...</p>
          </div>
        )}

        {!loading && !event && (
          <div className="text-center py-20">
            <p className="text-lg font-semibold" style={{ color: '#4F46E5' }}>Event not found</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              This feedback link may be invalid or the event has been removed.
            </p>
          </div>
        )}

        {!loading && event && submitted && (
          <div
            className="rounded-2xl border p-8 text-center space-y-5"
            style={{ backgroundColor: '#F0FAF0', borderColor: '#D1FAE5' }}
          >
            <CheckCircle2 size={56} className="mx-auto" style={{ color: '#2D7A3A' }} />
            <h2
              className="text-2xl font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#0F172A' }}
            >
              Thank you for your feedback!
            </h2>
            <p className="text-sm" style={{ color: '#475569' }}>
              Your review helps us improve future events. We appreciate you taking the time!
            </p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={28}
                  fill={s <= rating ? '#7C3AED' : 'none'}
                  stroke={s <= rating ? '#7C3AED' : '#E2E8F0'}
                />
              ))}
            </div>
            <Link
              href={`/e/${shortId}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
            >
              Back to Event
            </Link>
          </div>
        )}

        {!loading && event && !submitted && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
              >
                Rate Your Experience
              </h1>
              <div className="mt-2 space-y-1">
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                  {event.title}
                </p>
                {event.date && (
                  <p className="text-xs flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                    <Calendar size={12} /> {formatDate(event.date)}
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              {/* Star Rating */}
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: '#334155' }}>
                  How would you rate this event? <span style={{ color: '#4F46E5' }}>*</span>
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        size={36}
                        fill={(hoverRating || rating) >= s ? '#7C3AED' : 'none'}
                        stroke={(hoverRating || rating) >= s ? '#7C3AED' : '#E2E8F0'}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 text-sm font-medium" style={{ color: '#7C3AED' }}>
                      {rating === 1 && 'Poor'}
                      {rating === 2 && 'Fair'}
                      {rating === 3 && 'Good'}
                      {rating === 4 && 'Very Good'}
                      {rating === 5 && 'Excellent'}
                    </span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#334155' }}>
                  Your thoughts <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="What did you enjoy? What could be improved?"
                  className="w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none resize-none"
                  style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                  onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                  onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
                />
              </div>

              {/* Name and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                    Your Name <span style={{ color: '#4F46E5' }}>*</span>
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none"
                    style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                    onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                    onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                    Email <span style={{ color: '#4F46E5' }}>*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none"
                    style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                    onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                    onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
                  />
                  <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>
                    Used to verify your attendance. Not shared publicly.
                  </p>
                </div>
              </div>

              {/* Error */}
              {errorMsg && (
                <div
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: '#FFF0F0', border: '1px solid #FECDD3', color: '#991B1B' }}
                >
                  {errorMsg}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="w-full py-3.5 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
              >
                <Send size={16} />
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>

              <p className="text-[11px] text-center" style={{ color: '#94A3B8' }}>
                Your feedback is anonymous to other attendees and helps organizers improve.
              </p>
            </form>
          </div>
        )}
      </main>

      
    </div>
  )
}
