'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users,
  CheckCircle2,
  Gift,
  Clock,
  Search,
  Activity,
  BarChart3,
  Loader2,
  LogIn,
  XCircle,
  UserCheck,
  AlertTriangle,
} from 'lucide-react'

interface TicketRow {
  id: string
  ticket_number: string
  holder_name: string
  holder_email: string
  status: string
  checked_in_at: string | null
  checked_in_by: string | null
  gate: string | null
  is_comp: boolean
  comp_reason: string | null
}

interface GateStats {
  [gate: string]: number
}

export default function EventDayDashboard() {
  const params = useParams()
  const eventId = params?.eventId as string
  const supabase = createClient()
  const refreshInterval = useRef<NodeJS.Timeout | null>(null)

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [event, setEvent] = useState<any>(null)
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'checkin' | 'status'>('name')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Auth + initial data
  useEffect(() => {
    if (!eventId) return
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthed(false); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || (profile.role !== 'publisher' && profile.role !== 'admin')) {
        setAuthed(false)
        return
      }
      setAuthed(true)
    })()
  }, [eventId])

  // Fetch event + tickets
  const fetchData = useCallback(async () => {
    if (!eventId || authed !== true) return

    const { data: evt } = await supabase
      .from('events')
      .select('id, title, date, time, venue, city')
      .eq('id', eventId)
      .single()
    if (evt) setEvent(evt)

    const { data: tix } = await supabase
      .from('tickets')
      .select('id, ticket_number, holder_name, holder_email, status, checked_in_at, checked_in_by, gate, is_comp, comp_reason')
      .eq('event_id', eventId)
      .order('checked_in_at', { ascending: false, nullsFirst: false })

    if (tix) setTickets(tix as TicketRow[])
    setLastRefresh(new Date())
  }, [eventId, authed])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (authed !== true) return
    refreshInterval.current = setInterval(fetchData, 10000)
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current) }
  }, [authed, fetchData])

  // Computed stats
  const total = tickets.length
  const checkedIn = tickets.filter(t => t.status === 'used').length
  const compCount = tickets.filter(t => t.is_comp).length
  const activeCount = tickets.filter(t => t.status === 'active').length

  // Gate breakdown
  const gateStats: GateStats = {}
  tickets.forEach(t => {
    if (t.status === 'used' && t.gate) {
      gateStats[t.gate] = (gateStats[t.gate] || 0) + 1
    }
  })
  const ungated = tickets.filter(t => t.status === 'used' && !t.gate).length
  if (ungated > 0) gateStats['No Gate'] = ungated

  // Recent check-ins (last 20)
  const recentCheckins = tickets
    .filter(t => t.status === 'used' && t.checked_in_at)
    .sort((a, b) => (b.checked_in_at || '').localeCompare(a.checked_in_at || ''))
    .slice(0, 20)

  // Filtered + sorted attendee list
  const q = search.trim().toLowerCase()
  const filteredTickets = tickets.filter(t =>
    !q || t.holder_name.toLowerCase().includes(q) || t.holder_email.toLowerCase().includes(q) || t.ticket_number.toLowerCase().includes(q)
  )
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (sortBy === 'name') return a.holder_name.localeCompare(b.holder_name)
    if (sortBy === 'checkin') return (b.checked_in_at || '').localeCompare(a.checked_in_at || '')
    // status: used first, then active, then rest
    const order: Record<string, number> = { used: 0, active: 1, cancelled: 2, revoked: 3 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
  })

  // No-shows
  const noShows = tickets.filter(t => t.status === 'active')

  if (authed === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        
        <div className="flex items-center justify-center py-32">
          <Loader2 className="animate-spin" size={32} style={{ color: '#7C3AED' }} />
        </div>
      </div>
    )
  }

  if (authed === false) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        
        <main className="max-w-md mx-auto px-4 py-20 text-center">
          <LogIn size={48} style={{ color: '#4F46E5' }} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>Event Day Dashboard</h1>
          <p className="text-sm mb-6" style={{ color: '#475569' }}>Please log in as a publisher to access this dashboard.</p>
          <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}>
            <LogIn size={16} /> Log In
          </a>
        </main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>
              {event?.title || 'Event Day Dashboard'}
            </h1>
            {event && (
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                {event.date}{event.time ? ` at ${event.time}` : ''} {event.venue ? `· ${event.venue}` : ''} {event.city ? `· ${event.city}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
              <Activity size={12} />
              Live · Updated {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </div>
            <button
              onClick={() => window.open(`/api/events/${eventId}/checkin-list`, '_blank')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
              style={{ borderColor: '#E2E8F0', color: '#4E342E' }}
            >
              Print List
            </button>
            <a
              href={`/dashboard/box-office`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
            >
              Box Office
            </a>
          </div>
        </div>

        {/* Main stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <LiveStatCard label="Checked In" value={checkedIn} total={total} icon={<CheckCircle2 size={16} />} color="#2E7D32" />
          <LiveStatCard label="Remaining" value={activeCount} icon={<Clock size={16} />} color="#7C3AED" />
          <LiveStatCard label="Total Tickets" value={total} icon={<Users size={16} />} color="#4F46E5" />
          <LiveStatCard label="Comp Tickets" value={compCount} icon={<Gift size={16} />} color="#E65100" />
        </div>

        {/* Capacity bar */}
        {total > 0 && (
          <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: '#334155' }}>Check-in Progress</span>
              <span className="text-sm font-bold" style={{ color: '#2E7D32' }}>
                {Math.round((checkedIn / total) * 100)}%
              </span>
            </div>
            <div className="w-full rounded-full h-5 overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
              <div
                className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                style={{
                  width: `${Math.max(2, Math.round((checkedIn / total) * 100))}%`,
                  backgroundColor: '#2E7D32',
                }}
              >
                {checkedIn > 0 && (
                  <span className="text-[10px] font-bold text-white">{checkedIn}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: Gate Breakdown + Recent check-ins */}
          <div className="lg:col-span-1 space-y-5">
            {/* Gate breakdown */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <BarChart3 size={14} style={{ color: '#4F46E5' }} />
                <span className="text-sm font-semibold" style={{ color: '#334155' }}>Gate Breakdown</span>
              </div>
              <div className="p-4">
                {Object.keys(gateStats).length === 0 ? (
                  <div className="text-center text-sm py-4" style={{ color: '#94A3B8' }}>No check-ins yet</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(gateStats).sort((a, b) => b[1] - a[1]).map(([gate, count]) => (
                      <div key={gate} className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: '#334155' }}>{gate}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${checkedIn > 0 ? Math.round((count / checkedIn) * 100) : 0}%`, backgroundColor: '#4F46E5' }}
                            />
                          </div>
                          <span className="text-sm font-bold" style={{ color: '#4F46E5' }}>{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent check-ins */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <Activity size={14} style={{ color: '#2E7D32' }} />
                <span className="text-sm font-semibold" style={{ color: '#334155' }}>Recent Check-ins</span>
              </div>
              {recentCheckins.length === 0 ? (
                <div className="p-4 text-center text-sm" style={{ color: '#94A3B8' }}>No check-ins yet</div>
              ) : (
                <ul className="max-h-[400px] overflow-y-auto">
                  {recentCheckins.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid #F5EFE0' }}>
                      <CheckCircle2 size={14} style={{ color: '#2E7D32' }} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: '#334155' }}>{t.holder_name}</div>
                        <div className="text-[11px]" style={{ color: '#94A3B8' }}>
                          {t.gate ? `${t.gate} · ` : ''}
                          {t.checked_in_at ? new Date(t.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                          {t.checked_in_by ? ` · by ${t.checked_in_by}` : ''}
                        </div>
                      </div>
                      {t.is_comp && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>COMP</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#334155' }}>Quick Actions</div>
              <a href="/dashboard/box-office" className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-[#F5EFE0] transition-colors" style={{ color: '#4F46E5' }}>
                <Gift size={14} /> Issue Comp Ticket
              </a>
              <a href={`/checkin?event=${eventId}`} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-[#F5EFE0] transition-colors" style={{ color: '#4F46E5' }}>
                <UserCheck size={14} /> Open Check-in Scanner
              </a>
              <button onClick={() => setSortBy('status')} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-[#F5EFE0] transition-colors w-full text-left" style={{ color: '#4F46E5' }}>
                <AlertTriangle size={14} /> View No-Shows ({noShows.length})
              </button>
            </div>
          </div>

          {/* Right: Attendee list */}
          <div className="lg:col-span-2">
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
              <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2 flex-1">
                  <Users size={14} style={{ color: '#4F46E5' }} />
                  <span className="text-sm font-semibold" style={{ color: '#334155' }}>Attendees ({filteredTickets.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                      className="pl-8 pr-3 py-2 rounded-lg border text-sm w-full sm:w-48"
                      style={{ borderColor: '#E2E8F0', color: '#334155' }}
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2 py-2 rounded-lg border text-xs"
                    style={{ borderColor: '#E2E8F0', color: '#475569' }}
                  >
                    <option value="name">Sort: Name</option>
                    <option value="checkin">Sort: Check-in time</option>
                    <option value="status">Sort: Status</option>
                  </select>
                </div>
              </div>

              {sortedTickets.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: '#94A3B8' }}>No tickets found.</div>
              ) : (
                <ul className="max-h-[600px] overflow-y-auto">
                  {sortedTickets.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid #F5EFE0' }}>
                      {t.status === 'used' ? (
                        <CheckCircle2 size={16} style={{ color: '#2E7D32' }} className="flex-shrink-0" />
                      ) : t.status === 'active' ? (
                        <Clock size={16} style={{ color: '#7C3AED' }} className="flex-shrink-0" />
                      ) : (
                        <XCircle size={16} style={{ color: '#C62828' }} className="flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: '#334155' }}>{t.holder_name}</div>
                        <div className="text-xs truncate" style={{ color: '#94A3B8' }}>
                          {t.holder_email}
                          {t.ticket_number && <span className="font-mono ml-1">· {t.ticket_number}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {t.is_comp && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>
                            COMP
                          </span>
                        )}
                        {t.status === 'used' && t.checked_in_at && (
                          <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                            {new Date(t.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                        {t.gate && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E3F2FD', color: '#1565C0' }}>
                            {t.gate}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: t.status === 'used' ? '#D1FAE5' : t.status === 'active' ? '#FFF8E1' : '#FEE2E2',
                            color: t.status === 'used' ? '#2E7D32' : t.status === 'active' ? '#F57F17' : '#C62828',
                          }}
                        >
                          {t.status === 'used' ? 'Checked In' : t.status === 'active' ? 'Not Yet' : t.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function LiveStatCard({
  label, value, total, icon, color,
}: {
  label: string; value: number; total?: number; icon: React.ReactNode; color: string
}) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: '#94A3B8' }}>
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal" style={{ color: '#94A3B8' }}> / {total}</span>
        )}
      </div>
    </div>
  )
}
