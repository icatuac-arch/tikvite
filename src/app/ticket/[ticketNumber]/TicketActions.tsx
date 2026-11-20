'use client'

import { useState } from 'react'
import { CalendarPlus, MapPin, Mail, XCircle, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  ticketNumber: string
  ticketStatus: string
  holderEmail: string
  eventTitle: string
  eventDescription: string
  eventDate: string
  eventTime: string
  eventVenue: string
  eventCity: string
  eventState: string
  eventAddress: string
  organizerName: string
  organizerEmail: string
  allowSelfCancel?: boolean
}

/* ── ICS download ────────────────────────────────────────────────────── */

function parseDateTime(dateStr: string, timeStr?: string): Date {
  let hours = 19
  let minutes = 0
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

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function downloadIcs(opts: { title: string; description: string; date: string; time: string; venue: string; city: string }) {
  const start = parseDateTime(opts.date, opts.time)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const escape = (s: string) =>
    String(s || '')
      .replace(/[\\,;]/g, (m) => `\\${m}`)
      .replace(/\r?\n/g, '\\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ticvite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${slugify(opts.title)}-${opts.date}@ticvite`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(opts.title)}`,
    `DESCRIPTION:${escape(opts.description?.slice(0, 200) || '')}`,
    `LOCATION:${escape([opts.venue, opts.city].filter(Boolean).join(', '))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(opts.title)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function TicketActions(props: Props) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(props.ticketStatus === 'cancelled')
  const [error, setError] = useState('')

  const mapsQuery = encodeURIComponent(
    [props.eventAddress, props.eventVenue, props.eventCity, props.eventState].filter(Boolean).join(', ')
  )
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  const handleCancel = async () => {
    setCancelling(true)
    setError('')
    try {
      const res = await fetch('/api/tickets/cancel-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_number: props.ticketNumber,
          holder_email: props.holderEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Cancellation failed')
      } else {
        setCancelled(true)
        // Reload to show updated status
        window.location.reload()
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setCancelling(false)
  }

  const btnStyle = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: '10px 20px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600 as const,
    cursor: 'pointer' as const,
    textDecoration: 'none' as const,
    border: 'none' as const,
    transition: 'opacity 0.2s',
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Divider */}
      <div style={{ borderTop: '1px solid #E2E8F0', margin: '0 -28px', paddingTop: 20, paddingLeft: 28, paddingRight: 28 }}>

        {/* Add to Calendar + Get Directions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {props.eventDate && (
            <button
              onClick={() => downloadIcs({
                title: props.eventTitle,
                description: props.eventDescription,
                date: props.eventDate,
                time: props.eventTime,
                venue: props.eventVenue,
                city: props.eventCity,
              })}
              style={{
                ...btnStyle,
                backgroundColor: '#D1FAE5',
                color: '#2E7D32',
              }}
            >
              <CalendarPlus size={16} />
              Add to Calendar
            </button>
          )}

          {(props.eventVenue || props.eventAddress) && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...btnStyle,
                backgroundColor: '#E3F2FD',
                color: '#1565C0',
              }}
            >
              <MapPin size={16} />
              Get Directions
            </a>
          )}
        </div>

        {/* Contact Organizer */}
        {props.organizerName && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Event Organizer
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
              {props.organizerName}
            </div>
            {props.organizerEmail && (
              <a
                href={`mailto:${props.organizerEmail}?subject=${encodeURIComponent(`Question about ${props.eventTitle}`)}&body=${encodeURIComponent(`Hi ${props.organizerName},\n\nI have a question about my ticket (${props.ticketNumber}) for ${props.eventTitle}.\n\n`)}`}
                style={{
                  ...btnStyle,
                  backgroundColor: '#4F46E5',
                  color: '#F8FAFC',
                }}
              >
                <Mail size={16} />
                Email Organizer
              </a>
            )}
          </div>
        )}

        {/* Cancel Booking */}
        {props.ticketStatus === 'active' && !cancelled && props.allowSelfCancel && (
          <div style={{ marginTop: 8 }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 8,
                backgroundColor: '#FEE2E2', color: '#C62828',
                fontSize: 13, marginBottom: 10,
              }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {showCancelConfirm ? (
              <div style={{
                padding: 16, borderRadius: 12,
                backgroundColor: '#FFF8F8', border: '1.5px solid #FFCDD2',
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#C62828', margin: '0 0 4px' }}>
                  Are you sure you want to cancel this booking?
                </p>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 14px' }}>
                  This action cannot be undone. You will receive a cancellation confirmation email.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    style={{
                      ...btnStyle,
                      backgroundColor: '#C62828',
                      color: '#fff',
                      opacity: cancelling ? 0.5 : 1,
                    }}
                  >
                    {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel My Booking'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    style={{
                      ...btnStyle,
                      backgroundColor: '#fff',
                      color: '#475569',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    Keep My Booking
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCancelConfirm(true)}
                style={{
                  ...btnStyle,
                  backgroundColor: '#fff',
                  color: '#C62828',
                  border: '1.5px solid #FFCDD2',
                }}
              >
                <XCircle size={16} />
                Cancel My Booking
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
