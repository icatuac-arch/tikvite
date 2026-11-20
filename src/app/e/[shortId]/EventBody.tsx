'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Ticket,
  CalendarPlus,
  Navigation,
  Share2,
  Check,
  Music,
  Utensils,
  Car,
  Users,
  TreePine,
  PartyPopper,
  Heart,
  Palette,
  Sparkles,
  ChevronRight,
  ArrowRight,
  User,
  ExternalLink,
  Search,
  Link2,
  Bell,
  Mail,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import type { Event } from '@/lib/types'
import { getCategoryMeta, getShortId } from '@/lib/constants'
import EventPoster from '@/components/EventPoster'
import { resolveTicketAction } from '@/lib/ticketUrl'
import { getPriceBadge } from '@/lib/formatPrice'
// No ads on Ticvite
import { formatTime } from '@/lib/formatTime'

interface Props {
  event: Event
  shortId: string
  shortUrl: string
  relatedEvents: Event[]
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getDateParts(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: date.getDate(),
  }
}

/* Feature-icon extraction from description keywords */
const FEATURE_MAP: { pattern: RegExp; label: string; icon: typeof Music }[] = [
  { pattern: /\bmusic\b|\bconcert\b|\bsong\b|\bsing\b/i, label: 'Live Music', icon: Music },
  { pattern: /\bdance\b|\bchoreograph\b|\bnritya\b|\bbhangra\b|\bgarba\b/i, label: 'Dance', icon: Sparkles },
  { pattern: /\bfood\b|\bfeast\b|\bdinner\b|\bcuisine\b|\bcatering\b|\bsnack/i, label: 'Food & Drinks', icon: Utensils },
  { pattern: /\bpark(ing)?\b|\bfree\s*park/i, label: 'Parking', icon: Car },
  { pattern: /\bfamil(y|ies)\b|\bkids?\b|\bchildren\b/i, label: 'Family Friendly', icon: Users },
  { pattern: /\boutdoor\b|\bopen\s*air\b|\bgarden\b|\bpark\b/i, label: 'Outdoor', icon: TreePine },
  { pattern: /\bcelebrat\b|\bfestiv(al|e)\b|\bmela\b/i, label: 'Celebration', icon: PartyPopper },
  { pattern: /\bcharit(y|able)\b|\bfundrais\b|\bdonate\b/i, label: 'Charity', icon: Heart },
  { pattern: /\bart\b|\bpaint\b|\bexhibit\b|\bgaller/i, label: 'Art', icon: Palette },
]

function extractFeatures(desc: string): { label: string; Icon: typeof Music }[] {
  if (!desc) return []
  const found: { label: string; Icon: typeof Music }[] = []
  for (const f of FEATURE_MAP) {
    if (f.pattern.test(desc)) {
      found.push({ label: f.label, Icon: f.icon })
    }
    if (found.length >= 4) break
  }
  return found
}

/* ── ICS download ────────────────────────────────────────────────────── */

function downloadIcs(opts: { title: string; description: string; date: string; time?: string; venue: string; city: string; shortUrl: string }) {
  const start = parseDateTime(opts.date, opts.time)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const esc = (s: string) => String(s || '').replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ticvite//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${opts.shortUrl}@ticvite`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(opts.title)}`, `DESCRIPTION:${esc(opts.description)}\\n\\n${opts.shortUrl}`,
    `LOCATION:${esc([opts.venue, opts.city].filter(Boolean).join(', '))}`,
    `URL:${opts.shortUrl}`, 'END:VEVENT', 'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function parseDateTime(dateStr: string, timeStr?: string): Date {
  let hours = 19, minutes = 0
  if (timeStr) {
    const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/)
    if (m) {
      hours = parseInt(m[1], 10)
      minutes = parseInt(m[2], 10)
      const meridiem = m[3]?.toUpperCase()
      if (meridiem === 'PM' && hours < 12) hours += 12
      if (meridiem === 'AM' && hours === 12) hours = 0
    }
  }
  return new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
}

/* ── main component ──────────────────────────────────────────────────── */

export default function EventBody({ event, shortId, shortUrl, relatedEvents }: Props) {
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  // Reminder opt-in state
  const [showReminder, setShowReminder] = useState(false)
  const [reminderEmail, setReminderEmail] = useState('')
  const [reminderStatus, setReminderStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [reminderMsg, setReminderMsg] = useState('')

  // Close share menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false)
      }
    }
    if (shareOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [shareOpen])

  const submitReminder = async () => {
    if (!reminderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reminderEmail)) {
      setReminderMsg('Please enter a valid email')
      setReminderStatus('error')
      return
    }
    setReminderStatus('loading')
    try {
      const res = await fetch(`/api/events/${event.id}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: reminderEmail }),
      })
      if (!res.ok) throw new Error('Failed')
      setReminderStatus('done')
      setReminderMsg('You will be reminded before this event!')
    } catch {
      setReminderStatus('error')
      setReminderMsg('Something went wrong. Please try again.')
    }
  }

  const category = getCategoryMeta(event.category)
  const ticketAction = resolveTicketAction({
    title: event.title,
    city: event.city,
    venue: event.venue,
    ticket_url: event.ticket_url,
  })

  const locationParts = [event.venue, event.address, event.city, event.state, event.zip_code]
    .map((s) => (s || '').trim())
    .filter(Boolean)
  const locationQuery = locationParts.join(', ')
  const mapEncoded = encodeURIComponent(locationQuery)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapEncoded}`

  const features = extractFeatures(event.description)

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
    setShareOpen(false)
  }

  const shareText = encodeURIComponent(`Check out ${event.title}!`)
  const shareUrlEncoded = encodeURIComponent(shortUrl)
  const whatsappUrl = `https://wa.me/?text=${shareText}%20${shareUrlEncoded}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrlEncoded}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrlEncoded}`

  return (
    <>
      {/* Leaderboard ad — top */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 hidden md:block"></div>

      {/* ════════════════════════════════════════════════════════════════
          HERO SECTION
          ════════════════════════════════════════════════════════════════ */}
      <section className="relative w-full" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:auto-rows-fr">
            {/* Left: Poster image */}
            <div className="lg:col-span-3">
              {event.image_url ? (
                <div
                  className="rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-sm flex items-center justify-center h-full"
                  style={{ minHeight: '400px', backgroundColor: '#F1F5F9' }}
                >
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '500px' }}
                  />
                </div>
              ) : (
                <div
                  className="rounded-2xl flex items-center justify-center h-full"
                  style={{ minHeight: '400px', background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 50%, #3D1010 100%)' }}
                >
                  <span className="text-9xl opacity-30">{category.emoji}</span>
                </div>
              )}
            </div>

            {/* Right: Info card — same height as poster box */}
            <div className="lg:col-span-2">
              <div
                className="w-full h-full p-6 flex flex-col justify-center rounded-2xl border border-[#E2E8F0]"
                style={{ backgroundColor: '#FFFFFF' }}
              >
                {/* Top badges */}
                <div className="flex items-center justify-between mb-5">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#F8FAFC',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {category.emoji} {category.label}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: '#4F46E5', fontFamily: 'Inter, sans-serif' }}
                  >
                    {(() => { const pb = getPriceBadge(event.price); return pb.isFree ? 'Free Event' : pb.label === 'Paid' ? 'Paid Event' : pb.label })()}
                  </span>
                </div>

                {/* Title */}
                <h1
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-6"
                  style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}
                >
                  {event.title}
                </h1>

                {/* Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Calendar size={18} style={{ color: '#4F46E5' }} className="flex-shrink-0" />
                    <span style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }} className="text-sm sm:text-base">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  {event.time && (
                    <div className="flex items-center gap-3">
                      <Clock size={18} style={{ color: '#4F46E5' }} className="flex-shrink-0" />
                      <span style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }} className="text-sm sm:text-base">
                        {formatTime(event.time)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <MapPin size={18} style={{ color: '#4F46E5' }} className="flex-shrink-0 mt-0.5" />
                    <div style={{ fontFamily: 'Inter, sans-serif' }} className="text-sm sm:text-base">
                      {event.venue && (
                        <div style={{ color: '#0F172A' }} className="font-medium">{event.venue}</div>
                      )}
                      <div style={{ color: '#475569' }}>
                        {[event.address, event.city, event.state, event.zip_code].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                  {event.metro_region && (
                    <div className="flex items-center gap-3">
                      <Building2 size={18} style={{ color: '#4F46E5' }} className="flex-shrink-0" />
                      <span style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }} className="text-sm sm:text-base">
                        {event.metro_region}
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary CTA — Queue > Reserved > RSVP > External */}
                {(event as any).queue_enabled ? (
                  <a
                    href={`/e/${shortId}/queue`}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-all hover:opacity-90"
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#F8FAFC',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <Users size={18} />
                    Join Queue for Tickets
                    <ChevronRight size={18} />
                  </a>
                ) : (event as any).seating_mode === 'reserved' ? (
                  <a
                    href={`/e/${shortId}/seats`}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-all hover:opacity-90"
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#F8FAFC',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <Ticket size={18} />
                    Choose Seats
                    <ChevronRight size={18} />
                  </a>
                ) : (event as any).rsvp_enabled ? (
                  <a
                    href={`/e/${shortId}/rsvp`}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-all hover:opacity-90"
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#F8FAFC',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <Ticket size={18} />
                    {event.price === 'Free' ? 'Get Free Tickets' : 'RSVP Now'}
                    <ChevronRight size={18} />
                  </a>
                ) : ticketAction ? (
                  <a
                    href={ticketAction.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-all hover:opacity-90"
                    style={{
                      backgroundColor: '#4F46E5',
                      color: '#F8FAFC',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {ticketAction.kind === 'direct' ? <Ticket size={18} /> : <Search size={18} />}
                    {ticketAction.label}
                    <ChevronRight size={18} />
                  </a>
                ) : null}

                {/* Secondary external ticket link when RSVP is enabled and external link exists */}
                {(event as any).rsvp_enabled && ticketAction && (
                  <a
                    href={ticketAction.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold mt-3 transition-all hover:opacity-90 border-2"
                    style={{
                      borderColor: '#E2E8F0',
                      color: '#475569',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <ExternalLink size={16} />
                    {ticketAction.label} (External)
                    <ChevronRight size={18} />
                  </a>
                )}

                {/* Remind Me opt-in */}
                {reminderStatus === 'done' ? (
                  <div
                    className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: '#D1FAE5', color: '#2D7A3A', fontFamily: 'Inter, sans-serif' }}
                  >
                    <Check size={16} />
                    {reminderMsg}
                  </div>
                ) : !showReminder ? (
                  <button
                    type="button"
                    onClick={() => setShowReminder(true)}
                    className="w-full flex items-center justify-center gap-2 mt-3 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border-2"
                    style={{
                      borderColor: '#E2E8F0',
                      color: '#4F46E5',
                      backgroundColor: '#F8FAFC',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <Bell size={16} />
                    Remind me about this event
                  </button>
                ) : (
                  <div
                    className="mt-3 p-4 rounded-xl border"
                    style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Bell size={16} style={{ color: '#4F46E5' }} />
                      <span className="text-sm font-semibold" style={{ color: '#4F46E5', fontFamily: 'Inter, sans-serif' }}>
                        Get a reminder
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={reminderEmail}
                          onChange={(e) => { setReminderEmail(e.target.value); setReminderStatus('idle'); setReminderMsg('') }}
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
                          style={{ borderColor: '#E2E8F0', fontFamily: 'Inter, sans-serif', backgroundColor: '#FFFFFF' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={submitReminder}
                        disabled={reminderStatus === 'loading'}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: '#4F46E5', color: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}
                      >
                        {reminderStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : 'Notify Me'}
                      </button>
                    </div>
                    {reminderStatus === 'error' && reminderMsg && (
                      <p className="text-xs mt-2" style={{ color: '#C62828', fontFamily: 'Inter, sans-serif' }}>{reminderMsg}</p>
                    )}
                  </div>
                )}

                {/* Three action buttons */}
                <div
                  className="grid grid-cols-3 gap-2 mt-4 pt-4"
                  style={{ borderTop: '1px solid #E2E8F0' }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      downloadIcs({
                        title: event.title,
                        description: event.description,
                        date: event.date,
                        time: event.time,
                        venue: event.venue,
                        city: event.city,
                        shortUrl,
                      })
                    }
                    className="flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[#E2E8F0]/50"
                    style={{ color: '#4F46E5', fontFamily: 'Inter, sans-serif' }}
                  >
                    <CalendarPlus size={16} />
                    <span>Add to Calendar</span>
                  </button>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[#E2E8F0]/50"
                    style={{ color: '#4F46E5', fontFamily: 'Inter, sans-serif' }}
                  >
                    <Navigation size={16} />
                    <span>Get Directions</span>
                  </a>
                  <div className="relative" ref={shareRef}>
                    <button
                      type="button"
                      onClick={() => setShareOpen((v) => !v)}
                      className="flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[#E2E8F0]/50 w-full"
                      style={{ color: '#4F46E5', fontFamily: 'Inter, sans-serif' }}
                    >
                      {copied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
                      <span>{copied ? 'Copied!' : 'Share'}</span>
                    </button>

                    {/* Share dropdown */}
                    {shareOpen && (
                      <div
                        className="absolute bottom-full right-0 mb-2 w-52 rounded-xl shadow-lg border overflow-hidden z-50"
                        style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
                      >
                        <button
                          type="button"
                          onClick={onCopyLink}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors hover:bg-[#E2E8F0]/60"
                          style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}
                        >
                          <Link2 size={16} style={{ color: '#4F46E5' }} />
                          Copy Link
                        </button>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShareOpen(false)}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors hover:bg-[#E2E8F0]/60"
                          style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          WhatsApp
                        </a>
                        <a
                          href={facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShareOpen(false)}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors hover:bg-[#E2E8F0]/60"
                          style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          Facebook
                        </a>
                        <a
                          href={twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShareOpen(false)}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors hover:bg-[#E2E8F0]/60"
                          style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#0F172A"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                          X (Twitter)
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          CONTENT AREA — adaptive layout based on available data
          ════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* ── Side-by-side: About + Location/Map (same height) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_160px] gap-6">
          {/* About This Event */}
          <div
            className="rounded-2xl p-6 flex flex-col"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#4F46E5' }}>
                <Sparkles size={16} style={{ color: '#7C3AED' }} />
              </div>
              <h2 className="text-lg font-bold" style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}>
                About This Event
              </h2>
            </div>
            {event.description ? (
              <div
                className="leading-relaxed whitespace-pre-wrap flex-1"
                style={{ color: '#334155', fontFamily: 'Inter, sans-serif', lineHeight: '1.75', fontSize: '0.9rem' }}
              >
                {event.description}
              </div>
            ) : (
              <p className="text-sm flex-1" style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
                No description available. Visit the ticket link for more details.
              </p>
            )}
            {features.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 mt-auto" style={{ borderTop: '1px solid #E2E8F0' }}>
                {features.map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#4F46E5', fontFamily: 'Inter, sans-serif' }}>
                    <f.Icon size={14} style={{ color: '#7C3AED' }} />
                    {f.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location + Map */}
          {locationQuery ? (
            <div
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
            >
              <iframe
                title={`Map — ${event.venue || event.city || 'event location'}`}
                src={`https://maps.google.com/maps?q=${mapEncoded}&z=14&output=embed`}
                className="w-full flex-1 border-0"
                style={{ minHeight: '220px' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div style={{ fontFamily: 'Inter, sans-serif' }}>
                    {event.venue && <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{event.venue}</p>}
                    <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                      {[event.address, event.city, event.state, event.zip_code].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0 transition-all hover:opacity-90" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
                    <Navigation size={12} />
                    Directions
                  </a>
                </div>
                <div className="pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #E2E8F0' }}>
                  <User size={12} style={{ color: '#94A3B8' }} />
                  <span className="text-xs" style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
                    Listed by {event.publisher_name === 'KhojAI' ? (
                      <span title="Discovered and verified by KhojAI">KhojAI <span style={{ color: '#7C3AED' }}>&#10003;</span></span>
                    ) : (
                      event.publisher_name || 'Ticvite'
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-6 flex items-center justify-center"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
            >
              <p className="text-sm" style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
                Location details not available
              </p>
            </div>
          )}

          {/* Ad sidebar — right column, desktop only */}
          <div className="hidden lg:block">
            
          </div>
        </div>

        {/* Mobile ad — shown only on small screens where sidebar is hidden */}
        <div className="lg:hidden mt-6">
          
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          YOU MAY ALSO LIKE
          ════════════════════════════════════════════════════════════════ */}
      {relatedEvents.length > 0 && (
        <section
          className="py-10 sm:py-14"
          style={{ borderTop: '1px solid #E2E8F0' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2
                className="text-xl sm:text-2xl font-bold"
                style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}
              >
                You May Also Like
              </h2>
              <Link
                href="/events"
                className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: '#7C3AED', fontFamily: 'Inter, sans-serif' }}
              >
                View All Events
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {relatedEvents.slice(0, 4).map((re) => {
                const rCat = getCategoryMeta(re.category)
                const rShortId = getShortId(re.id)
                const rDateParts = getDateParts(re.date)
                return (
                  <Link
                    key={re.id}
                    href={`/e/${rShortId}`}
                    className="group rounded-2xl overflow-hidden transition-all hover:shadow-lg"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                  >
                    {/* Card image */}
                    <div className="relative h-44 overflow-hidden">
                      {re.image_url ? (
                        <img
                          src={re.image_url}
                          alt={re.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, #4F46E5 0%, #3D1010 100%)` }}
                        >
                          <span className="text-5xl opacity-40">{rCat.emoji}</span>
                        </div>
                      )}
                      {/* Date chip */}
                      <div
                        className="absolute top-3 left-3 rounded-lg overflow-hidden text-center shadow-sm"
                        style={{ backgroundColor: '#F8FAFC' }}
                      >
                        <div
                          className="px-2 py-0.5 text-[10px] font-bold tracking-wider"
                          style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                        >
                          {rDateParts.month}
                        </div>
                        <div
                          className="px-2 py-1 text-lg font-bold leading-none"
                          style={{ color: '#0F172A' }}
                        >
                          {rDateParts.day}
                        </div>
                      </div>
                      {/* Category badge */}
                      <div
                        className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          color: '#4F46E5',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {rCat.emoji} {rCat.label}
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-4">
                      <h3
                        className="text-sm font-bold leading-snug mb-2 line-clamp-2"
                        style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}
                      >
                        {re.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                        <MapPin size={12} />
                        <span className="truncate">
                          {re.venue || re.city || re.metro_region}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: re.price === 'Free' ? '#D1FAE5' : '#FFF3E0',
                            color: re.price === 'Free' ? '#2D7A3A' : '#7C3AED',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {re.price === 'Free' ? 'Free' : 'Paid'}
                        </span>
                        {re.time && (
                          <span className="text-xs" style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
                            {formatTime(re.time)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Leaderboard ad — bottom */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 hidden md:block"></div>

      {/* Mobile sticky banner */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden" style={{ backgroundColor: 'rgba(253,248,240,0.95)' }}>
        
      </div>
    </>
  )
}
