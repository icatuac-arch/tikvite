'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

function getSessionToken(): string {
  if (typeof window === 'undefined') return ''
  let token = sessionStorage.getItem('ip_queue_token')
  if (!token) {
    token = crypto.randomUUID()
    sessionStorage.setItem('ip_queue_token', token)
  }
  return token
}

interface Props {
  eventId: string
  eventTitle: string
  shortId: string
}

export default function QueueClient({ eventId, eventTitle, shortId }: Props) {
  const router = useRouter()

  const [position, setPosition] = useState(0)
  const [ahead, setAhead] = useState(0)
  const [totalWaiting, setTotalWaiting] = useState(0)
  const [status, setStatus] = useState<string>('ready') // ready | waiting | admitted | expired
  const [estimatedMinutes, setEstimatedMinutes] = useState(0)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [pulse, setPulse] = useState(false)

  // Check if already in queue on mount
  useEffect(() => {
    const token = getSessionToken()
    fetch(`/api/queue/status?event_id=${eventId}&session_token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.in_queue) {
          setJoined(true)
          setPosition(data.position)
          setAhead(data.ahead)
          setTotalWaiting(data.total_waiting)
          setStatus(data.status)
          setEstimatedMinutes(data.estimated_wait_minutes || 0)
          setExpiresAt(data.expires_at || null)
        }
      })
      .catch(() => {})
  }, [eventId])

  // Join queue
  const joinQueue = useCallback(async () => {
    const token = getSessionToken()
    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          session_token: token,
          email: email || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setJoined(true)
        setPosition(data.position)
        setStatus(data.status)
      } else {
        setError(data.error || 'Failed to join queue')
      }
    } catch {
      setError('Network error')
    }
  }, [eventId, email])

  // Poll queue status every 5 seconds
  useEffect(() => {
    if (!joined) return
    let active = true

    const poll = async () => {
      const token = getSessionToken()
      try {
        const res = await fetch(
          `/api/queue/status?event_id=${eventId}&session_token=${token}`
        )
        const data = await res.json()
        if (!active) return

        if (data.ok) {
          setPosition(data.position)
          setAhead(data.ahead)
          setTotalWaiting(data.total_waiting)
          setStatus(data.status)
          setEstimatedMinutes(data.estimated_wait_minutes || 0)
          setExpiresAt(data.expires_at || null)
          setPulse((p) => !p)

          // Redirect when admitted
          if (data.status === 'admitted') {
            setTimeout(() => {
              router.push(`/e/${shortId}/rsvp?admitted=1`)
            }, 2000)
          }
        }
      } catch {
        // silent
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [joined, eventId, shortId, router])

  // Countdown for admitted users
  const [countdown, setCountdown] = useState('')
  useEffect(() => {
    if (status !== 'admitted' || !expiresAt) return
    const tick = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now()
      if (remaining <= 0) {
        setCountdown('Expired')
        setStatus('expired')
        return
      }
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setCountdown(`${mins}:${String(secs).padStart(2, '0')}`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [status, expiresAt])

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px 80px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#4F46E5',
              fontFamily: 'Plus Jakarta Sans, serif',
              marginBottom: 8,
            }}
          >
            {eventTitle}
          </h1>
          <p style={{ color: '#475569', fontFamily: 'Inter, sans-serif', fontSize: 15 }}>
            Virtual Waiting Room
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#FFF0F0',
              border: '1px solid #FFCDD2',
              borderRadius: 12,
              padding: '16px 20px',
              color: '#C62828',
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 24,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {error}
          </div>
        )}

        {/* Not yet joined — show join form */}
        {!joined && status === 'ready' && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: 32,
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            }}
          >
            {/* Animated queue icon */}
            <div style={{ marginBottom: 24 }}>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ margin: '0 auto', display: 'block' }}>
                <circle cx="40" cy="40" r="36" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                <circle
                  cx="40" cy="40" r="36" fill="none" stroke="#4F46E5" strokeWidth="3"
                  strokeDasharray="226" strokeDashoffset="170" strokeLinecap="round"
                  style={{ animation: 'qspin 2s linear infinite', transformOrigin: '40px 40px' }}
                />
                <text x="40" y="46" textAnchor="middle" fill="#4F46E5" fontSize="24" fontWeight="700" fontFamily="Inter, sans-serif">
                  Q
                </text>
              </svg>
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#0F172A',
                fontFamily: 'Plus Jakarta Sans, serif',
                marginBottom: 12,
              }}
            >
              High Demand Event
            </h2>
            <p
              style={{
                color: '#475569',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              This event has very high demand. Join the virtual queue to secure your spot.
              You will be notified when it is your turn to purchase tickets.
            </p>

            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  color: '#475569',
                  fontFamily: 'Inter, sans-serif',
                  marginBottom: 6,
                }}
              >
                Email (optional, for notifications)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={joinQueue}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: 12,
                background: '#4F46E5',
                color: '#F8FAFC',
                fontWeight: 600,
                fontSize: 16,
                fontFamily: 'Inter, sans-serif',
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              Join the Queue
            </button>
          </div>
        )}

        {/* In queue — waiting */}
        {joined && status === 'waiting' && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: 32,
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            }}
          >
            {/* Animated position display */}
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 8px 32px rgba(123,31,31,0.3)',
                transition: 'transform 0.3s',
                transform: pulse ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: '#7C3AED',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Position
              </span>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: '#F8FAFC',
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1,
                }}
              >
                {ahead + 1}
              </span>
              <span style={{ fontSize: 11, color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>
                of {totalWaiting}
              </span>
            </div>

            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#0F172A',
                fontFamily: 'Plus Jakarta Sans, serif',
                marginBottom: 8,
              }}
            >
              You are in the queue
            </h2>
            <p
              style={{
                color: '#475569',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              {ahead === 0
                ? 'You are next! Please stay on this page.'
                : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you.`}
            </p>

            {/* Estimated time */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>
                Estimated Wait
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#7C3AED', fontFamily: 'Inter, sans-serif' }}>
                ~{estimatedMinutes} min
              </div>
            </div>

            {/* Progress bar */}
            <div
              style={{
                background: '#E2E8F0',
                borderRadius: 8,
                height: 8,
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, #7C3AED, #4F46E5)',
                  width: totalWaiting > 0 ? `${Math.max(5, Math.round(((totalWaiting - ahead) / totalWaiting) * 100))}%` : '5%',
                  transition: 'width 0.5s ease-out',
                }}
              />
            </div>

            <p style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
              This page refreshes automatically. Please do not close this tab.
            </p>
          </div>
        )}

        {/* Admitted */}
        {joined && status === 'admitted' && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '2px solid #2E7D32',
              padding: 32,
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(46,125,50,0.15)',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#D1FAE5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#2E7D32',
                fontFamily: 'Plus Jakarta Sans, serif',
                marginBottom: 8,
              }}
            >
              You are in!
            </h2>
            <p
              style={{
                color: '#475569',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              You have been admitted. Complete your ticket purchase before time runs out.
            </p>

            {/* Countdown */}
            <div
              style={{
                background: '#FFF3E0',
                border: '1px solid #FEF3C7',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 12, color: '#E65100', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>
                Time Remaining
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#E65100', fontFamily: 'ui-monospace, monospace' }}>
                {countdown}
              </div>
            </div>

            <a
              href={`/e/${shortId}/rsvp?admitted=1`}
              style={{
                display: 'inline-block',
                width: '100%',
                padding: '14px 24px',
                borderRadius: 12,
                background: '#2E7D32',
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
                fontFamily: 'Inter, sans-serif',
                textDecoration: 'none',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              Get Your Tickets Now
            </a>
          </div>
        )}

        {/* Expired */}
        {joined && status === 'expired' && (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #FFCDD2',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#C62828',
                fontFamily: 'Plus Jakarta Sans, serif',
                marginBottom: 8,
              }}
            >
              Time Expired
            </h2>
            <p
              style={{
                color: '#475569',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.6,
              }}
            >
              Your admission window has expired. You may rejoin the queue if spots are still available.
            </p>
          </div>
        )}
      </main>
      

      <style>{`
        @keyframes qspin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
