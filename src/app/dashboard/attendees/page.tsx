'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Search, Download, Users, UserCheck, Repeat, ChevronDown, ChevronUp,
  ArrowUpDown, Calendar, DollarSign, Ticket, Mail,
} from 'lucide-react'

interface AttendeeEvent {
  event_id: string; title: string; date: string; tickets: number; spent: number; status: string
}

interface Attendee {
  email: string; name: string; total_events_attended: number; total_tickets: number
  total_spent: number; first_event_date: string; last_event_date: string; events: AttendeeEvent[]
}

interface Summary {
  total_unique: number; repeat_attendees: number; avg_events: number
}

type SortKey = 'name' | 'email' | 'total_events_attended' | 'total_tickets' | 'total_spent' | 'first_event_date' | 'last_event_date'

export default function AttendeeCRMPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [summary, setSummary] = useState<Summary>({ total_unique: 0, repeat_attendees: 0, avg_events: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('total_events_attended')
  const [sortAsc, setSortAsc] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics/attendees')
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setAttendees(d.attendees || []); setSummary(d.summary) }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = attendees
    .filter(a => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })

  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Events Attended', 'Total Tickets', 'Total Spent', 'First Event', 'Last Event'],
      ...filtered.map(a => [
        a.name, a.email, String(a.total_events_attended), String(a.total_tickets),
        `$${a.total_spent.toFixed(2)}`, a.first_event_date, a.last_event_date,
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = `attendees-crm-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(el); el.click(); document.body.removeChild(el); URL.revokeObjectURL(url)
  }

  const fmtDate = (d: string) => {
    if (!d) return '-'
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }
  const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }

  const SortHeader = ({ label, sKey, align }: { label: string; sKey: SortKey; align?: string }) => (
    <th
      onClick={() => handleSort(sKey)}
      style={{ ...thStyle, textAlign: (align as any) || 'left' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {sortKey === sKey ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />}
      </span>
    </th>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" style={{ color: '#4F46E5' }}><ArrowLeft size={20} /></Link>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif', margin: 0 }}>
                Attendee CRM
              </h1>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Track and manage your attendees across all events</p>
            </div>
          </div>
          <button onClick={exportCsv} disabled={!attendees.length} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#4F46E5', color: '#F8FAFC', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: attendees.length ? 1 : 0.4 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Total Unique Attendees', value: String(summary.total_unique), icon: Users, color: '#4F46E5' },
                { label: 'Repeat Attendees (2+)', value: String(summary.repeat_attendees), icon: Repeat, color: '#2E7D32' },
                { label: 'Avg Events per Attendee', value: String(summary.avg_events), icon: Calendar, color: '#1565C0' },
              ].map(c => (
                <div key={c.label} style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${c.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.icon size={18} style={{ color: c.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ ...card, marginBottom: 20, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Search size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#334155', background: 'transparent' }}
                />
                {search && (
                  <span style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            {attendees.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 60 }}>
                <Users size={40} style={{ color: '#E2E8F0', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>No attendees yet</p>
                <p style={{ fontSize: 13, color: '#94A3B8' }}>Attendee data will appear here once people RSVP to your events.</p>
              </div>
            ) : (
              <div style={{ ...card, overflowX: 'auto', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                      <SortHeader label="Name" sKey="name" />
                      <SortHeader label="Email" sKey="email" />
                      <SortHeader label="Events" sKey="total_events_attended" align="right" />
                      <SortHeader label="Tickets" sKey="total_tickets" align="right" />
                      <SortHeader label="Spent" sKey="total_spent" align="right" />
                      <SortHeader label="First Event" sKey="first_event_date" align="right" />
                      <SortHeader label="Last Event" sKey="last_event_date" align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <>
                        <tr
                          key={a.email}
                          onClick={() => setExpandedRow(expandedRow === a.email ? null : a.email)}
                          style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer', background: expandedRow === a.email ? '#F8FAFC' : 'transparent', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => { if (expandedRow !== a.email) (e.currentTarget.style.background = '#FEFCF8') }}
                          onMouseLeave={(e) => { if (expandedRow !== a.email) (e.currentTarget.style.background = 'transparent') }}
                        >
                          <td style={{ padding: '10px 10px', fontWeight: 600, color: '#0F172A' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {expandedRow === a.email ? <ChevronUp size={13} style={{ color: '#94A3B8' }} /> : <ChevronDown size={13} style={{ color: '#94A3B8' }} />}
                              {a.name || <span style={{ color: '#94A3B8', fontStyle: 'italic', fontWeight: 400 }}>No name</span>}
                              {a.total_events_attended >= 3 && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#FFF3E0', color: '#E65100' }}>
                                  Loyal
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', color: '#475569' }}>{a.email}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: a.total_events_attended >= 2 ? '#2E7D32' : '#0F172A' }}>
                            {a.total_events_attended}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#334155' }}>{a.total_tickets}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: a.total_spent > 0 ? '#1565C0' : '#94A3B8' }}>
                            {a.total_spent > 0 ? `$${a.total_spent.toFixed(2)}` : 'Free'}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(a.first_event_date)}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(a.last_event_date)}</td>
                        </tr>
                        {expandedRow === a.email && (
                          <tr key={`${a.email}-detail`}>
                            <td colSpan={7} style={{ padding: 0 }}>
                              <div style={{ background: '#F8FAFC', padding: '12px 20px 16px 46px', borderBottom: '1px solid #E2E8F0' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#4F46E5', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, serif' }}>
                                  Event History
                                </div>
                                {a.events.map((ev, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: idx < a.events.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                                    <Calendar size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 12, color: '#334155' }}>
                                      <Link href={`/dashboard/analytics/${ev.event_id}`} style={{ color: '#4F46E5', fontWeight: 600, textDecoration: 'underline' }}>
                                        {ev.title}
                                      </Link>
                                    </span>
                                    <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDate(ev.date)}</span>
                                    <span style={{ fontSize: 11, color: '#475569', minWidth: 50, textAlign: 'right' }}>{ev.tickets} tix</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: ev.spent > 0 ? '#1565C0' : '#94A3B8', minWidth: 60, textAlign: 'right' }}>
                                      {ev.spent > 0 ? `$${ev.spent.toFixed(2)}` : 'Free'}
                                    </span>
                                    <span style={{
                                      fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 8,
                                      background: ev.status === 'checked_in' ? '#D1FAE5' : '#FFF3E0',
                                      color: ev.status === 'checked_in' ? '#2E7D32' : '#7C3AED',
                                    }}>
                                      {ev.status === 'checked_in' ? 'Attended' : ev.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
      
    </div>
  )
}
