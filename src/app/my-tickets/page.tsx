'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Ticket, Calendar, MapPin, Eye, XCircle, Loader2, AlertCircle } from 'lucide-react'

interface TicketResult {
  ticket_number: string
  holder_name: string
  holder_email: string
  status: string
  event_title: string
  event_date: string
  event_time: string
  event_venue: string
  event_city: string
  event_state: string
  event_id: string
  allow_self_cancel: boolean
}

export default function MyTicketsPage() {
  const [query, setQuery] = useState('')
  const [tickets, setTickets] = useState<TicketResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError('')
    setSearched(true)
    setTickets([])

    try {
      const res = await fetch(`/api/tickets/lookup?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setTickets(data.tickets || [])
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  const handleCancel = async (ticketNumber: string, email: string) => {
    setCancellingId(ticketNumber)
    try {
      const res = await fetch('/api/tickets/cancel-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_number: ticketNumber, holder_email: email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Cancellation failed')
      } else {
        // Update ticket status in local state
        setTickets(prev =>
          prev.map(t =>
            t.ticket_number === ticketNumber ? { ...t, status: 'cancelled' } : t
          )
        )
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setCancellingId(null)
    setCancelConfirm(null)
  }

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: '#D1FAE5', text: '#2E7D32', label: 'Active' },
    used: { bg: '#E3F2FD', text: '#1565C0', label: 'Checked In' },
    cancelled: { bg: '#FEE2E2', text: '#C62828', label: 'Cancelled' },
    revoked: { bg: '#FFF3E0', text: '#E65100', label: 'Revoked' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: '#F5EFE0', marginBottom: 16 }}>
            <Ticket size={28} style={{ color: '#4F46E5' }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif', margin: '0 0 8px' }}>
            My Tickets
          </h1>
          <p style={{ fontSize: 15, color: '#475569', margin: 0 }}>
            Find your tickets by entering your email address or confirmation code.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email address or confirmation code (e.g. TK-2609-ABCD1234)"
              style={{
                width: '100%',
                padding: '14px 14px 14px 44px',
                borderRadius: 12,
                border: '1.5px solid #E2E8F0',
                fontSize: 15,
                color: '#334155',
                backgroundColor: '#fff',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: '#4F46E5',
              color: '#F8FAFC',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !query.trim() ? 0.5 : 1,
              fontFamily: 'Inter, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {loading ? 'Searching...' : 'Find My Tickets'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 10,
            backgroundColor: '#FEE2E2', color: '#C62828',
            fontSize: 14, marginBottom: 20,
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Results */}
        {searched && !loading && tickets.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
            <Ticket size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>No tickets found</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Make sure you entered the correct email or ticket number.
            </p>
          </div>
        )}

        {tickets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} found
            </p>

            {tickets.map((t) => {
              const st = statusColors[t.status] || statusColors.active
              return (
                <div
                  key={t.ticket_number}
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #E2E8F0',
                    padding: '20px 24px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Event title */}
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#4F46E5', margin: '0 0 8px', fontFamily: 'Plus Jakarta Sans, serif' }}>
                    {t.event_title}
                  </h3>

                  {/* Date & venue */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {t.event_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                        <Calendar size={13} />
                        {t.event_date}{t.event_time ? ` at ${t.event_time}` : ''}
                      </div>
                    )}
                    {t.event_venue && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                        <MapPin size={13} />
                        {t.event_venue}{t.event_city ? `, ${t.event_city}` : ''}{t.event_state ? `, ${t.event_state}` : ''}
                      </div>
                    )}
                  </div>

                  {/* Ticket number + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticket</div>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: '#334155', letterSpacing: '0.04em' }}>
                        {t.ticket_number}
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-block',
                      background: st.bg,
                      color: st.text,
                      padding: '4px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link
                      href={`/ticket/${encodeURIComponent(t.ticket_number)}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 18px', borderRadius: 8,
                        backgroundColor: '#4F46E5', color: '#F8FAFC',
                        fontSize: 13, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      <Eye size={14} />
                      View Ticket
                    </Link>

                    {t.status === 'active' && t.allow_self_cancel && (
                      <>
                        {cancelConfirm === t.ticket_number ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: '#C62828', fontWeight: 500 }}>Cancel this ticket?</span>
                            <button
                              onClick={() => handleCancel(t.ticket_number, t.holder_email)}
                              disabled={cancellingId === t.ticket_number}
                              style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: 'none', backgroundColor: '#C62828', color: '#fff',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                opacity: cancellingId === t.ticket_number ? 0.5 : 1,
                              }}
                            >
                              {cancellingId === t.ticket_number ? 'Cancelling...' : 'Yes, Cancel'}
                            </button>
                            <button
                              onClick={() => setCancelConfirm(null)}
                              style={{
                                padding: '6px 14px', borderRadius: 6,
                                border: '1px solid #E2E8F0', backgroundColor: '#fff', color: '#475569',
                                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCancelConfirm(t.ticket_number)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '8px 18px', borderRadius: 8,
                              border: '1.5px solid #FFCDD2', backgroundColor: '#fff', color: '#C62828',
                              fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            <XCircle size={14} />
                            Cancel Booking
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      
    </div>
  )
}
