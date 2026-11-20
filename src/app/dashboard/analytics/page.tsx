'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Download, Calendar, Users, DollarSign, Ticket,
  UserCheck, UserX, Gift, XCircle, TrendingUp, BarChart3, ArrowRight, Target,
} from 'lucide-react'

interface OrgData {
  period: { key: string; label: string; from: string; to: string }
  org: { name: string; role: string }
  summary: {
    total_events: number; published_events: number; draft_events: number
    total_tickets: number; checked_in: number; no_show: number; checkin_rate: number
    total_attendees: number; unique_attendees: number
    comp_tickets: number; cancelled_tickets: number; transferred_tickets: number
    gross_revenue: number; discounts_given: number; refunded: number; net_revenue: number
    paid_orders: number; free_rsvps: number
  }
  events_breakdown: {
    event_id: string; title: string; date: string; city: string; status: string; category: string
    tickets_sold: number; checked_in: number; no_show: number; checkin_rate: number
    revenue: number; comp: number; cancelled: number
  }[]
  monthly_trend: { month: string; events: number; tickets: number; revenue: number; checkedIn: number }[]
  top_events: {
    by_revenue: { title: string; revenue: number; date: string }[]
    by_attendance: { title: string; checked_in: number; date: string }[]
  }
  category_breakdown: { category: string; events: number; tickets: number; revenue: number }[]
}

const PERIODS = [
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'year', label: 'Full Year' },
  { key: 'lifetime', label: 'All Time' },
]

function LineChart({ data, width = 500, height = 180, color = '#4F46E5' }: {
  data: { label: string; value: number }[]; width?: number; height?: number; color?: string
}) {
  if (!data.length) return <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 20 }}>No data</div>
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const pad = { top: 20, right: 20, bottom: 36, left: 50 }
  const cw = width - pad.left - pad.right, ch = height - pad.top - pad.bottom
  const pts = data.map((d, i) => ({
    x: pad.left + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw),
    y: pad.top + ch - (d.value / maxVal) * ch, label: d.label,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = pathD + ` L ${pts[pts.length - 1].x} ${pad.top + ch} L ${pts[0].x} ${pad.top + ch} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.5, 1].map(f => { const y = pad.top + ch - f * ch; return (
        <g key={f}><line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#E2E8F0" strokeWidth="1" />
        <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="10">{Math.round(maxVal * f)}</text></g>
      )})}
      <path d={areaD} fill={color} opacity="0.08" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />)}
      {pts.length <= 12 && pts.map((p, i) => <text key={i} x={p.x} y={pad.top + ch + 14} textAnchor="middle" fill="#94A3B8" fontSize="9">{p.label.slice(2)}</text>)}
    </svg>
  )
}

export default function OrgAnalyticsPage() {
  const [data, setData] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('lifetime')
  const [revenueGoal, setRevenueGoal] = useState<number | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const [showGoalInput, setShowGoalInput] = useState(false)

  // Load revenue goal from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`revenue-goal-${period}`)
    if (saved) setRevenueGoal(Number(saved))
    else setRevenueGoal(null)
    setShowGoalInput(false)
    setGoalInput('')
  }, [period])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/org?period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  const exportCsv = () => {
    if (!data) return
    const s = data.summary
    const rows = [
      ['ORG ANALYTICS REPORT'], [data.org.name], [data.period.label], [''],
      ['SUMMARY'],
      ['Total Events', String(s.total_events)],
      ['Total Attendees', String(s.total_attendees)],
      ['Unique Attendees', String(s.unique_attendees)],
      ['Tickets Issued', String(s.total_tickets)],
      ['Checked In', String(s.checked_in)],
      ['No Show', String(s.no_show)],
      ['Check-in Rate', `${s.checkin_rate}%`],
      ['Comp Tickets', String(s.comp_tickets)],
      ['Cancelled', String(s.cancelled_tickets)],
      ['Gross Revenue', `$${s.gross_revenue.toFixed(2)}`],
      ['Discounts Given', `$${s.discounts_given.toFixed(2)}`],
      ['Refunded', `$${s.refunded.toFixed(2)}`],
      ['Net Revenue', `$${s.net_revenue.toFixed(2)}`],
      [''],
      ['EVENT BREAKDOWN'],
      ['Event', 'Date', 'City', 'Sold', 'Checked In', 'No Show', 'Rate', 'Revenue', 'Comp', 'Cancelled'],
      ...data.events_breakdown.map(e => [
        e.title, e.date, e.city, String(e.tickets_sold), String(e.checked_in),
        String(e.no_show), `${e.checkin_rate}%`, `$${e.revenue.toFixed(2)}`,
        String(e.comp), String(e.cancelled),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `org-report-${data.period.key}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" style={{ color: '#4F46E5' }}><ArrowLeft size={20} /></Link>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif', margin: 0 }}>
                {data?.org.role === 'admin' ? 'Platform Analytics' : 'My Analytics'}
              </h1>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{data?.org.name || ''} &middot; {data?.period.label || ''}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={exportCsv} disabled={!data} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#4F46E5', color: '#F8FAFC', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <Download size={13} /> Export Report
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: period === p.key ? '#4F46E5' : '#fff',
                color: period === p.key ? '#F8FAFC' : '#475569',
                boxShadow: period === p.key ? 'none' : '0 0 0 1px #E2E8F0',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>No data available</div>
        ) : (
          <>
            {/* ── SUMMARY CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Events', value: String(data.summary.total_events), icon: Calendar, color: '#4F46E5' },
                { label: 'Total Attendees', value: String(data.summary.total_attendees), sub: `${data.summary.unique_attendees} unique`, icon: Users, color: '#475569' },
                { label: 'Checked In', value: String(data.summary.checked_in), sub: `${data.summary.checkin_rate}%`, icon: UserCheck, color: '#2E7D32' },
                { label: 'No Show', value: String(data.summary.no_show), icon: UserX, color: '#7C3AED' },
                { label: 'Net Revenue', value: `$${data.summary.net_revenue.toFixed(2)}`, icon: DollarSign, color: '#1565C0' },
                { label: 'Discounts', value: `$${data.summary.discounts_given.toFixed(2)}`, icon: Ticket, color: '#7C3AED' },
                { label: 'Refunded', value: `$${data.summary.refunded.toFixed(2)}`, icon: XCircle, color: '#C62828' },
                { label: 'Comp Tickets', value: String(data.summary.comp_tickets), icon: Gift, color: '#4F46E5' },
              ].map(c => (
                <div key={c.label} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.icon size={16} style={{ color: c.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{c.value}</div>
                    {'sub' in c && c.sub && <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* ── REVENUE GOAL ── */}
            <div style={{ ...card, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#4F46E512', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Target size={18} style={{ color: '#4F46E5' }} />
              </div>
              {revenueGoal !== null ? (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                      Revenue: ${data.summary.net_revenue.toFixed(2)} of ${revenueGoal.toLocaleString()} goal ({Math.min(100, Math.round((data.summary.net_revenue / revenueGoal) * 100))}%)
                    </span>
                    <button
                      onClick={() => { localStorage.removeItem(`revenue-goal-${period}`); setRevenueGoal(null); setShowGoalInput(false) }}
                      style={{ fontSize: 11, color: '#94A3B8', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ width: '100%', height: 10, borderRadius: 6, background: '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, (data.summary.net_revenue / revenueGoal) * 100)}%`,
                      height: '100%', borderRadius: 6,
                      background: data.summary.net_revenue >= revenueGoal
                        ? 'linear-gradient(90deg, #2E7D32, #4CAF50)'
                        : 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              ) : showGoalInput ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>$</span>
                  <input
                    type="number"
                    placeholder="Enter revenue target"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && goalInput) {
                        const val = Number(goalInput)
                        if (val > 0) { localStorage.setItem(`revenue-goal-${period}`, String(val)); setRevenueGoal(val); setShowGoalInput(false) }
                      }
                    }}
                    autoFocus
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, color: '#334155', outline: 'none', maxWidth: 200 }}
                  />
                  <button
                    onClick={() => {
                      const val = Number(goalInput)
                      if (val > 0) { localStorage.setItem(`revenue-goal-${period}`, String(val)); setRevenueGoal(val); setShowGoalInput(false) }
                    }}
                    style={{ padding: '8px 16px', borderRadius: 10, background: '#4F46E5', color: '#F8FAFC', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Set
                  </button>
                  <button
                    onClick={() => setShowGoalInput(false)}
                    style={{ padding: '8px 12px', borderRadius: 10, background: 'none', border: '1px solid #E2E8F0', color: '#475569', fontSize: 12, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowGoalInput(true)}
                  style={{ fontSize: 13, color: '#4F46E5', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                >
                  Set a revenue target for {data.period.label.toLowerCase()}
                </button>
              )}
            </div>

            {/* ── MONTHLY TRENDS ── */}
            {data.monthly_trend.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={card}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 12 }}>Tickets by Month</h3>
                  <LineChart data={data.monthly_trend.map(m => ({ label: m.month, value: m.tickets }))} />
                </div>
                <div style={card}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 12 }}>Revenue by Month</h3>
                  <LineChart data={data.monthly_trend.map(m => ({ label: m.month, value: m.revenue }))} color="#1565C0" />
                </div>
              </div>
            )}

            {/* ── TOP EVENTS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div style={card}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 12 }}>Top Events by Revenue</h3>
                {data.top_events.by_revenue.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>No paid events</div>
                ) : data.top_events.by_revenue.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: 13 }}>
                    <div style={{ color: '#334155' }}>
                      <span style={{ fontWeight: 600, color: '#94A3B8', marginRight: 8 }}>#{i + 1}</span>
                      {e.title}
                    </div>
                    <span style={{ fontWeight: 700, color: '#1565C0' }}>${e.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={card}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 12 }}>Top Events by Attendance</h3>
                {data.top_events.by_attendance.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>No check-ins</div>
                ) : data.top_events.by_attendance.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E2E8F0', fontSize: 13 }}>
                    <div style={{ color: '#334155' }}>
                      <span style={{ fontWeight: 600, color: '#94A3B8', marginRight: 8 }}>#{i + 1}</span>
                      {e.title}
                    </div>
                    <span style={{ fontWeight: 700, color: '#2E7D32' }}>{e.checked_in} checked in</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CATEGORY BREAKDOWN ── */}
            {data.category_breakdown.length > 0 && (
              <div style={{ ...card, marginBottom: 24, overflowX: 'auto' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 12 }}>By Category</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                      {['Category', 'Events', 'Tickets Sold', 'Revenue'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Category' ? 'left' : 'right', padding: '8px 10px', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.category_breakdown.map(c => (
                      <tr key={c.category} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '10px', fontWeight: 600, color: '#4F46E5' }}>{c.category}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>{c.events}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>{c.tickets}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#1565C0' }}>${c.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── ALL EVENTS TABLE ── */}
            <div style={{ ...card, overflowX: 'auto' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 12 }}>
                All Events ({data.events_breakdown.length})
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                    {['Event', 'Date', 'Sold', 'Checked In', 'No Show', 'Rate', 'Revenue', 'Comp', 'Cancelled', ''].map(h => (
                      <th key={h} style={{ textAlign: h === 'Event' ? 'left' : 'right', padding: '6px 8px', color: '#94A3B8', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.events_breakdown.map(e => (
                    <tr key={e.event_id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px', fontWeight: 500, color: '#0F172A', maxWidth: 200 }}>
                        <div className="truncate">{e.title}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{e.city}</div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{e.date}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>{e.tickets_sold}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#2E7D32' }}>{e.checked_in}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: e.no_show > 0 ? '#7C3AED' : '#94A3B8' }}>{e.no_show}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#475569' }}>{e.checkin_rate}%</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: e.revenue > 0 ? '#1565C0' : '#94A3B8' }}>
                        {e.revenue > 0 ? `$${e.revenue.toFixed(2)}` : 'Free'}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: e.comp > 0 ? '#4F46E5' : '#94A3B8' }}>{e.comp}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: e.cancelled > 0 ? '#C62828' : '#94A3B8' }}>{e.cancelled}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <Link href={`/dashboard/analytics/${e.event_id}`} style={{ color: '#4F46E5', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Details <ArrowRight size={10} style={{ display: 'inline' }} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      
    </div>
  )
}
