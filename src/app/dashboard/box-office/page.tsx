'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronDown,
  Users,
  Gift,
  Search,
  UserPlus,
  DollarSign,
  BarChart3,
  CheckCircle2,
  XCircle,
  Ticket,
  LogIn,
  Loader2,
} from 'lucide-react'

interface EventOption {
  id: string
  title: string
  date: string
}

type Tab = 'comp' | 'willcall' | 'walkin' | 'cash' | 'stats'

const COMP_REASONS = ['VIP', 'Sponsor', 'Press', 'Volunteer', 'Staff', 'Other']

export default function BoxOfficePage() {
  const supabase = createClient()

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('comp')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Comp form
  const [compName, setCompName] = useState('')
  const [compEmail, setCompEmail] = useState('')
  const [compQty, setCompQty] = useState(1)
  const [compReason, setCompReason] = useState('VIP')
  const [compSubmitting, setCompSubmitting] = useState(false)

  // Will-call search
  const [wcQuery, setWcQuery] = useState('')
  const [wcResults, setWcResults] = useState<any[]>([])
  const [wcSearching, setWcSearching] = useState(false)

  // Walk-in form
  const [wiName, setWiName] = useState('')
  const [wiEmail, setWiEmail] = useState('')
  const [wiSubmitting, setWiSubmitting] = useState(false)

  // Cash payment form
  const [cashName, setCashName] = useState('')
  const [cashEmail, setCashEmail] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [cashQty, setCashQty] = useState(1)
  const [cashSubmitting, setCashSubmitting] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    checkedIn: 0,
    compCount: 0,
    revenue: 0,
    cashRevenue: 0,
  })

  // Auth check
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthed(false); return }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || (profile.role !== 'publisher' && profile.role !== 'admin')) {
        setAuthed(false)
        return
      }
      setAuthed(true)

      let query = supabase.from('events').select('id, title, date').eq('status', 'published').order('date', { ascending: false })
      if (profile.role !== 'admin') query = query.eq('publisher_id', user.id)

      const { data: evts } = await query
      if (evts && evts.length > 0) {
        setEvents(evts as EventOption[])
        setSelectedEventId((evts[0] as any).id)
      }
    })()
  }, [])

  // Fetch stats when event changes
  const fetchStats = useCallback(async () => {
    if (!selectedEventId) return
    const { data: tickets } = await supabase
      .from('tickets')
      .select('status, is_comp')
      .eq('event_id', selectedEventId)
    const { data: orders } = await supabase
      .from('orders')
      .select('amount, status, payment_method')
      .eq('event_id', selectedEventId)

    if (tickets) {
      const total = tickets.length
      const checkedIn = tickets.filter((t: any) => t.status === 'used').length
      const compCount = tickets.filter((t: any) => t.is_comp).length
      const paidOrders = (orders || []).filter((o: any) => o.status === 'paid')
      const revenue = paidOrders.filter((o: any) => o.payment_method !== 'cash').reduce((s: number, o: any) => s + Number(o.amount), 0)
      const cashRevenue = paidOrders.filter((o: any) => o.payment_method === 'cash').reduce((s: number, o: any) => s + Number(o.amount), 0)
      setStats({ total, checkedIn, compCount, revenue, cashRevenue })
    }
  }, [selectedEventId])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Flash feedback
  const flash = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Issue comp tickets
  const handleComp = async () => {
    if (!compName.trim() || !compEmail.trim()) { flash('error', 'Name and email required'); return }
    setCompSubmitting(true)
    try {
      const resp = await fetch('/api/tickets/comp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEventId,
          holder_name: compName.trim(),
          holder_email: compEmail.trim(),
          quantity: compQty,
          reason: compReason,
        }),
      })
      const data = await resp.json()
      if (data.ok) {
        flash('success', `${compQty} comp ticket(s) issued to ${compName}`)
        setCompName(''); setCompEmail(''); setCompQty(1)
        fetchStats()
      } else {
        flash('error', data.error || 'Failed to issue comp tickets')
      }
    } catch {
      flash('error', 'Network error')
    } finally {
      setCompSubmitting(false)
    }
  }

  // Will-call lookup
  const handleWillCall = async () => {
    if (!wcQuery.trim()) return
    setWcSearching(true)
    setWcResults([])
    try {
      const q = wcQuery.trim().toLowerCase()
      // Search tickets by name, email, or ticket number
      const { data: tickets } = await supabase
        .from('tickets')
        .select('ticket_number, holder_name, holder_email, status, checked_in_at, is_comp, comp_reason')
        .eq('event_id', selectedEventId)
        .or(`holder_name.ilike.%${q}%,holder_email.ilike.%${q}%,ticket_number.ilike.%${q}%`)
        .limit(20)

      // Also search RSVPs by confirmation code
      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select('attendee_name, attendee_email, confirmation_code, status, quantity')
        .eq('event_id', selectedEventId)
        .or(`confirmation_code.ilike.%${q}%,attendee_name.ilike.%${q}%,attendee_email.ilike.%${q}%`)
        .limit(10)

      const results: any[] = []
      for (const t of (tickets || [])) {
        results.push({ type: 'ticket', ...t })
      }
      for (const r of (rsvps || [])) {
        // Don't duplicate if already found via ticket
        if (!results.some(res => res.holder_email === r.attendee_email)) {
          results.push({ type: 'rsvp', holder_name: r.attendee_name, holder_email: r.attendee_email, confirmation_code: r.confirmation_code, status: r.status, quantity: r.quantity })
        }
      }
      setWcResults(results)
    } catch {
      flash('error', 'Search failed')
    } finally {
      setWcSearching(false)
    }
  }

  // Walk-in registration
  const handleWalkin = async () => {
    if (!wiName.trim() || !wiEmail.trim()) { flash('error', 'Name and email required'); return }
    setWiSubmitting(true)
    try {
      const resp = await fetch('/api/tickets/comp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEventId,
          holder_name: wiName.trim(),
          holder_email: wiEmail.trim(),
          quantity: 1,
          reason: 'Walk-in',
        }),
      })
      const data = await resp.json()
      if (data.ok) {
        flash('success', `Walk-in ticket created for ${wiName}`)
        setWiName(''); setWiEmail('')
        fetchStats()
      } else {
        flash('error', data.error || 'Failed to create walk-in ticket')
      }
    } catch {
      flash('error', 'Network error')
    } finally {
      setWiSubmitting(false)
    }
  }

  // Cash payment
  const handleCash = async () => {
    if (!cashName.trim() || !cashEmail.trim() || !cashAmount) { flash('error', 'All fields required'); return }
    setCashSubmitting(true)
    try {
      // Create comp ticket first
      const ticketResp = await fetch('/api/tickets/comp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEventId,
          holder_name: cashName.trim(),
          holder_email: cashEmail.trim(),
          quantity: cashQty,
          reason: 'Cash',
        }),
      })
      const ticketData = await ticketResp.json()
      if (!ticketData.ok) {
        flash('error', ticketData.error || 'Failed to create ticket')
        return
      }

      // Record cash payment as an order
      const { error: orderErr } = await supabase.from('orders').insert({
        event_id: selectedEventId,
        rsvp_id: ticketData.rsvp_id,
        attendee_name: cashName.trim(),
        attendee_email: cashEmail.trim(),
        attendee_phone: '',
        quantity: cashQty,
        unit_price: parseFloat(cashAmount) / cashQty,
        amount: parseFloat(cashAmount),
        currency: 'usd',
        status: 'paid',
        payment_method: 'cash',
        notes: 'Cash payment at box office',
      })

      if (orderErr) {
        flash('error', 'Ticket created but failed to record payment')
      } else {
        flash('success', `Cash payment of $${parseFloat(cashAmount).toFixed(2)} recorded for ${cashName}`)
        setCashName(''); setCashEmail(''); setCashAmount(''); setCashQty(1)
        fetchStats()
      }
    } catch {
      flash('error', 'Network error')
    } finally {
      setCashSubmitting(false)
    }
  }

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
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>Box Office</h1>
          <p className="text-sm mb-6" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>Please log in as a publisher to access the box office.</p>
          <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}>
            <LogIn size={16} /> Log In
          </a>
        </main>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'comp', label: 'Comp Tickets', icon: <Gift size={16} /> },
    { key: 'willcall', label: 'Will-Call', icon: <Search size={16} /> },
    { key: 'walkin', label: 'Walk-In', icon: <UserPlus size={16} /> },
    { key: 'cash', label: 'Cash Payment', icon: <DollarSign size={16} /> },
    { key: 'stats', label: 'Stats', icon: <BarChart3 size={16} /> },
  ]

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid #E2E8F0',
    fontSize: 14,
    color: '#334155',
    background: '#fff',
    fontFamily: 'Inter, sans-serif',
  } as const

  const btnPrimary = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    padding: '14px 24px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: '#F8FAFC',
    backgroundColor: '#4F46E5',
    border: 'none',
    cursor: 'pointer' as const,
    fontFamily: 'Inter, sans-serif',
    width: '100%',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>
          Box Office
        </h1>

        {/* Event selector */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>Event</label>
          <div className="relative">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border appearance-none text-sm font-medium pr-10"
              style={{ backgroundColor: '#fff', borderColor: '#E2E8F0', color: '#334155' }}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.title} — {e.date}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} icon={<Ticket size={14} />} />
          <StatCard label="Checked In" value={stats.checkedIn} icon={<CheckCircle2 size={14} />} />
          <StatCard label="Comp" value={stats.compCount} icon={<Gift size={14} />} />
          <StatCard label="Revenue" value={`$${stats.revenue.toFixed(0)}`} icon={<DollarSign size={14} />} />
          <StatCard label="Cash" value={`$${stats.cashRevenue.toFixed(0)}`} icon={<DollarSign size={14} />} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-5" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
              style={{
                backgroundColor: activeTab === t.key ? '#4F46E5' : '#fff',
                color: activeTab === t.key ? '#F8FAFC' : '#475569',
                border: activeTab === t.key ? 'none' : '1px solid #E2E8F0',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Feedback toast */}
        {feedback && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm font-semibold"
            style={{
              backgroundColor: feedback.type === 'success' ? '#D1FAE5' : '#FEE2E2',
              color: feedback.type === 'success' ? '#2E7D32' : '#C62828',
            }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {feedback.msg}
          </div>
        )}

        {/* Tab content */}
        <div className="rounded-xl p-5 sm:p-6" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>

          {/* COMP TICKETS */}
          {activeTab === 'comp' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold" style={{ color: '#334155', fontFamily: 'Plus Jakarta Sans, serif' }}>Issue Comp Tickets</h2>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Generate tickets without payment for VIPs, sponsors, press, volunteers.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="Full name" style={inputStyle} />
                <input value={compEmail} onChange={(e) => setCompEmail(e.target.value)} placeholder="Email" type="email" style={inputStyle} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="relative">
                  <select
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                    className="appearance-none pr-10"
                    style={inputStyle}
                  >
                    {COMP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                </div>
                <input value={compQty} onChange={(e) => setCompQty(Math.max(1, parseInt(e.target.value) || 1))} type="number" min={1} max={20} placeholder="Quantity" style={inputStyle} />
              </div>
              <button onClick={handleComp} disabled={compSubmitting} style={{ ...btnPrimary, opacity: compSubmitting ? 0.6 : 1 }}>
                {compSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
                {compSubmitting ? 'Issuing...' : 'Issue Comp Tickets'}
              </button>
            </div>
          )}

          {/* WILL-CALL */}
          {activeTab === 'willcall' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold" style={{ color: '#334155', fontFamily: 'Plus Jakarta Sans, serif' }}>Will-Call Lookup</h2>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Search by name, email, ticket number, or confirmation code.</p>
              <div className="flex gap-2">
                <input
                  value={wcQuery}
                  onChange={(e) => setWcQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWillCall()}
                  placeholder="Search attendee..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleWillCall} disabled={wcSearching} style={{ ...btnPrimary, width: 'auto', padding: '12px 20px' }}>
                  {wcSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>

              {wcResults.length > 0 && (
                <ul className="divide-y" style={{ borderColor: '#E2E8F0' }}>
                  {wcResults.map((r, i) => (
                    <li key={i} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#334155' }}>{r.holder_name || r.attendee_name}</div>
                        <div className="text-xs truncate" style={{ color: '#94A3B8' }}>{r.holder_email || r.attendee_email}</div>
                        {r.ticket_number && <div className="text-xs font-mono mt-0.5" style={{ color: '#4F46E5' }}>{r.ticket_number}</div>}
                        {r.confirmation_code && <div className="text-xs font-mono mt-0.5" style={{ color: '#7C3AED' }}>Code: {r.confirmation_code}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.is_comp && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>COMP</span>
                        )}
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: r.status === 'active' || r.status === 'confirmed' ? '#D1FAE5' : r.status === 'used' || r.status === 'attended' ? '#E3F2FD' : '#FEE2E2',
                            color: r.status === 'active' || r.status === 'confirmed' ? '#2E7D32' : r.status === 'used' || r.status === 'attended' ? '#1565C0' : '#C62828',
                          }}
                        >
                          {r.status === 'active' ? 'Active' : r.status === 'used' ? 'Checked In' : r.status === 'confirmed' ? 'Confirmed' : r.status === 'attended' ? 'Attended' : r.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {wcResults.length === 0 && wcQuery && !wcSearching && (
                <div className="text-center py-6 text-sm" style={{ color: '#94A3B8' }}>No results found.</div>
              )}
            </div>
          )}

          {/* WALK-IN */}
          {activeTab === 'walkin' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold" style={{ color: '#334155', fontFamily: 'Plus Jakarta Sans, serif' }}>Walk-In Registration</h2>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Quick register and create a ticket for someone at the door.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={wiName} onChange={(e) => setWiName(e.target.value)} placeholder="Full name" style={inputStyle} />
                <input value={wiEmail} onChange={(e) => setWiEmail(e.target.value)} placeholder="Email" type="email" style={inputStyle} />
              </div>
              <button onClick={handleWalkin} disabled={wiSubmitting} style={{ ...btnPrimary, opacity: wiSubmitting ? 0.6 : 1 }}>
                {wiSubmitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {wiSubmitting ? 'Registering...' : 'Register Walk-In'}
              </button>
            </div>
          )}

          {/* CASH PAYMENT */}
          {activeTab === 'cash' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold" style={{ color: '#334155', fontFamily: 'Plus Jakarta Sans, serif' }}>Cash Payment</h2>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Record a cash or manual payment at the door. Creates ticket + records the payment.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={cashName} onChange={(e) => setCashName(e.target.value)} placeholder="Full name" style={inputStyle} />
                <input value={cashEmail} onChange={(e) => setCashEmail(e.target.value)} placeholder="Email" type="email" style={inputStyle} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Amount ($)" type="number" min="0" step="0.01" style={inputStyle} />
                <input value={cashQty} onChange={(e) => setCashQty(Math.max(1, parseInt(e.target.value) || 1))} type="number" min={1} max={20} placeholder="Quantity" style={inputStyle} />
              </div>
              <button onClick={handleCash} disabled={cashSubmitting} style={{ ...btnPrimary, opacity: cashSubmitting ? 0.6 : 1 }}>
                {cashSubmitting ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                {cashSubmitting ? 'Processing...' : 'Record Cash Payment'}
              </button>
            </div>
          )}

          {/* STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold" style={{ color: '#334155', fontFamily: 'Plus Jakarta Sans, serif' }}>Event Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <BigStat label="Total Tickets" value={stats.total} />
                <BigStat label="Checked In" value={stats.checkedIn} />
                <BigStat label="Comp Tickets" value={stats.compCount} />
                <BigStat label="Not Checked In" value={Math.max(0, stats.total - stats.checkedIn)} />
                <BigStat label="Stripe Revenue" value={`$${stats.revenue.toFixed(2)}`} />
                <BigStat label="Cash Revenue" value={`$${stats.cashRevenue.toFixed(2)}`} />
              </div>
              {stats.total > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Check-in Progress</div>
                  <div className="w-full rounded-full h-4 overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((stats.checkedIn / stats.total) * 100)}%`,
                        backgroundColor: '#2E7D32',
                      }}
                    />
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                    {Math.round((stats.checkedIn / stats.total) * 100)}% checked in
                  </div>
                </div>
              )}
              <div className="pt-2">
                <a
                  href={`/dashboard/event-day/${selectedEventId}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: '#4F46E5' }}
                >
                  <BarChart3 size={14} /> Open Live Event Day Dashboard
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center gap-1 text-xs mb-0.5" style={{ color: '#94A3B8' }}>{icon} {label}</div>
      <div className="text-lg font-bold" style={{ color: '#4F46E5' }}>{value}</div>
    </div>
  )
}

function BigStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#F5EFE0' }}>
      <div className="text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: '#334155' }}>{value}</div>
    </div>
  )
}
