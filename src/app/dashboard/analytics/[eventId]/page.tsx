'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Download, TrendingUp, Users, DollarSign, CheckCircle,
  Ticket, XCircle, Gift, ArrowRightLeft, Clock, BarChart3, UserCheck, UserX,
} from 'lucide-react'

interface AnalyticsData {
  event: { id: string; title: string; date: string; time: string; venue: string; city: string; status: string }
  summary: {
    total_rsvps: number; confirmed_rsvps: number; waitlisted_rsvps: number; cancelled_rsvps: number
    total_tickets: number; active_tickets: number; checked_in: number; no_show: number
    checkin_rate: number; comp_tickets: number; transferred_tickets: number; cancelled_tickets: number
    total_capacity: number | null; total_sold: number; unsold: number | null
  }
  revenue: {
    gross: number; ticket_revenue: number; fees_collected: number; discounts_given: number
    refunded: number; net: number; paid_orders: number; refunded_orders: number
  }
  tier_breakdown: {
    tier_id: string; tier_name: string; price: number; capacity: number | null
    sold: number; unsold: number | null; waitlisted: number
    checked_in: number; no_show: number; cancelled: number; comp: number
  }[]
  sales_timeline: { date: string; count: number }[]
  revenue_timeline: { date: string; amount: number }[]
  checkin_timeline: { time: string; count: number }[]
  rsvp_by_status: Record<string, number>
  promo_performance: { code: string; discount_type: string; discount_value: number; used_count: number; max_uses: number | null; is_active: boolean; rsvps_using: number }[]
  funnel: { rsvps_started: number; rsvps_confirmed: number; tickets_issued: number; checked_in: number }
  attendees: { name: string; email: string; phone: string; tier: string; quantity: number; status: string; tickets: string; checked_in: string; checked_in_at: string; is_comp: string; created_at: string }[]
}

/* ── Chart components ── */

function LineChart({ data, width = 500, height = 200, color = '#4F46E5' }: {
  data: { label: string; value: number }[]; width?: number; height?: number; color?: string
}) {
  if (!data.length) return <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 20 }}>No data yet</div>
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const pad = { top: 20, right: 20, bottom: 40, left: 50 }
  const cw = width - pad.left - pad.right, ch = height - pad.top - pad.bottom
  const pts = data.map((d, i) => ({
    x: pad.left + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw),
    y: pad.top + ch - (d.value / maxVal) * ch, label: d.label, value: d.value,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = pathD + ` L ${pts[pts.length - 1].x} ${pad.top + ch} L ${pts[0].x} ${pad.top + ch} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.top + ch - f * ch
        return (<g key={f}><line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#E2E8F0" strokeWidth="1" />
          <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="Inter">{Math.round(maxVal * f)}</text></g>)
      })}
      <path d={areaD} fill={color} opacity="0.08" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke={color} strokeWidth="2" />)}
      {pts.length <= 14 && pts.map((p, i) => <text key={i} x={p.x} y={pad.top + ch + 16} textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="Inter">{p.label.slice(5)}</text>)}
    </svg>
  )
}

function FunnelChart({ steps }: { steps: { label: string; value: number }[] }) {
  const maxVal = Math.max(...steps.map(s => s.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((step, i) => {
        const pct = Math.round((step.value / maxVal) * 100)
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#334155', marginBottom: 4, fontWeight: 500 }}>
              <span>{step.label}</span>
              <span>{step.value} ({pct}%)</span>
            </div>
            <div style={{ background: '#E2E8F0', borderRadius: 6, height: 24, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 6, background: `linear-gradient(90deg, #4F46E5 ${100 - i * 20}%, #7C3AED)`, width: `${Math.max(2, pct)}%`, transition: 'width 0.5s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Main page ── */

export default function AnalyticsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/analytics/${eventId}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); else setError(d.error || 'Failed'); setLoading(false) })
      .catch(() => { setError('Network error'); setLoading(false) })
  }, [eventId])

  const exportCsv = () => {
    if (!data) return
    const rows = [
      ['Attendee Name', 'Email', 'Phone', 'Tier', 'Qty', 'Status', 'Tickets', 'Checked In', 'Check-in Time', 'Comp', 'RSVP Date'],
      ...data.attendees.map(a => [
        a.name, a.email, a.phone, a.tier, String(a.quantity), a.status,
        a.tickets, a.checked_in, a.checked_in_at, a.is_comp, a.created_at?.slice(0, 10) || '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `attendees-${data.event.title.replace(/[^a-zA-Z0-9]/g, '-')}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const exportReportCsv = () => {
    if (!data) return
    const s = data.summary; const r = data.revenue
    const rows = [
      ['EVENT REPORT'], [data.event.title], [`${data.event.date} · ${data.event.venue}, ${data.event.city}`], [''],
      ['TICKET INVENTORY'],
      ['Total Capacity', s.total_capacity != null ? String(s.total_capacity) : 'Unlimited'],
      ['Tickets Sold', String(s.total_sold)],
      ['Unsold', s.unsold != null ? String(s.unsold) : 'N/A'],
      ['Comp Tickets', String(s.comp_tickets)],
      ['Cancelled / Revoked', String(s.cancelled_tickets)],
      ['Transferred', String(s.transferred_tickets)],
      [''],
      ['ATTENDANCE'],
      ['Checked In', String(s.checked_in)],
      ['No Show (Active, Not Checked In)', String(s.no_show)],
      ['Check-in Rate', `${s.checkin_rate}%`],
      [''],
      ['REVENUE'],
      ['Gross Revenue', `$${r.gross.toFixed(2)}`],
      ['Ticket Revenue (excl. fees)', `$${r.ticket_revenue.toFixed(2)}`],
      ['Fees Collected', `$${r.fees_collected.toFixed(2)}`],
      ['Discounts Given', `$${r.discounts_given.toFixed(2)}`],
      ['Refunded', `$${r.refunded.toFixed(2)}`],
      ['Net Revenue', `$${r.net.toFixed(2)}`],
      ['Paid Orders', String(r.paid_orders)],
      ['Refunded Orders', String(r.refunded_orders)],
      [''],
      ['TIER BREAKDOWN'],
      ['Tier', 'Price', 'Capacity', 'Sold', 'Unsold', 'Waitlist', 'Checked In', 'No Show', 'Cancelled', 'Comp'],
      ...data.tier_breakdown.map(t => [
        t.tier_name, `$${t.price.toFixed(2)}`, t.capacity != null ? String(t.capacity) : 'Unlimited',
        String(t.sold), t.unsold != null ? String(t.unsold) : 'N/A', String(t.waitlisted),
        String(t.checked_in), String(t.no_show), String(t.cancelled), String(t.comp),
      ]),
      [''],
      ['PROMO CODES'],
      ['Code', 'Type', 'Value', 'Times Used', 'Max Uses', 'Active'],
      ...data.promo_performance.map(p => [
        p.code, p.discount_type, String(p.discount_value), String(p.used_count),
        p.max_uses != null ? String(p.max_uses) : 'Unlimited', p.is_active ? 'Yes' : 'No',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `report-${data.event.title.replace(/[^a-zA-Z0-9]/g, '-')}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, color: '#C62828', fontFamily: 'Plus Jakarta Sans, serif' }}>{error || 'Not available'}</h1>
        <Link href="/dashboard" style={{ color: '#4F46E5', fontSize: 14, marginTop: 16, display: 'inline-block' }}>Back to Dashboard</Link>
      </main>
      
    </div>
  )

  const s = data.summary
  const r = data.revenue
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }
  const isPast = data.event.date < new Date().toISOString().slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" style={{ color: '#4F46E5' }}><ArrowLeft size={20} /></Link>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif', margin: 0 }}>
                {isPast ? 'Post-Event Report' : 'Live Event Dashboard'}
              </h1>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{data.event.title} &middot; {data.event.date}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportReportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#4F46E5', color: '#F8FAFC', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <Download size={13} /> Full Report
            </button>
            <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#fff', color: '#4F46E5', border: '1px solid #E2E8F0', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <Download size={13} /> Attendee List
            </button>
          </div>
        </div>

        {/* ── SUMMARY CARDS (2 rows) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Tickets Sold', value: String(s.total_sold), sub: s.total_capacity != null ? `of ${s.total_capacity}` : '', icon: Ticket, color: '#4F46E5' },
            { label: 'Checked In', value: String(s.checked_in), sub: `${s.checkin_rate}%`, icon: UserCheck, color: '#2E7D32' },
            { label: 'No Show', value: String(s.no_show), sub: '', icon: UserX, color: '#7C3AED' },
            { label: 'Net Revenue', value: `$${r.net.toFixed(2)}`, sub: r.refunded > 0 ? `$${r.refunded.toFixed(2)} refunded` : '', icon: DollarSign, color: '#1565C0' },
            { label: 'Comp Tickets', value: String(s.comp_tickets), sub: '', icon: Gift, color: '#4F46E5' },
            { label: 'Cancelled', value: String(s.cancelled_tickets), sub: '', icon: XCircle, color: '#C62828' },
            { label: 'Transferred', value: String(s.transferred_tickets), sub: '', icon: ArrowRightLeft, color: '#475569' },
            { label: 'Waitlisted', value: String(s.waitlisted_rsvps), sub: '', icon: Clock, color: '#7C3AED' },
          ].map(c => (
            <div key={c.label} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <c.icon size={18} style={{ color: c.color }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{c.value}</div>
                {c.sub && <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.sub}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* ── TIER BREAKDOWN TABLE ── */}
        <div style={{ ...card, marginBottom: 24, overflowX: 'auto' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 16 }}>
            Ticket Breakdown by Tier
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                {['Tier', 'Price', 'Capacity', 'Sold', 'Unsold', 'Waitlist', 'Checked In', 'No Show', 'Cancelled', 'Comp'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Tier' ? 'left' : 'right', padding: '8px 10px', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.tier_breakdown.map(t => (
                <tr key={t.tier_id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#4F46E5' }}>{t.tier_name}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>{t.price > 0 ? `$${t.price.toFixed(2)}` : 'Free'}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>{t.capacity ?? '∞'}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>{t.sold}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: t.unsold != null && t.unsold <= 5 ? '#C62828' : '#475569' }}>
                    {t.unsold ?? '∞'}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', color: t.waitlisted > 0 ? '#7C3AED' : '#94A3B8' }}>{t.waitlisted}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#2E7D32' }}>{t.checked_in}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: t.no_show > 0 ? '#7C3AED' : '#94A3B8' }}>{t.no_show}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: t.cancelled > 0 ? '#C62828' : '#94A3B8' }}>{t.cancelled}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: t.comp > 0 ? '#4F46E5' : '#94A3B8' }}>{t.comp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── REVENUE BREAKDOWN ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 16 }}>
              Revenue Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Ticket Revenue', value: `$${r.ticket_revenue.toFixed(2)}`, color: '#2E7D32' },
                { label: 'Fees Collected', value: `$${r.fees_collected.toFixed(2)}`, color: '#475569' },
                { label: 'Discounts Given', value: `-$${r.discounts_given.toFixed(2)}`, color: '#7C3AED' },
                { label: 'Refunded', value: `-$${r.refunded.toFixed(2)}`, color: '#C62828' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 0', borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#334155' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: item.color }}>{item.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, padding: '12px 0', borderTop: '2px solid #E2E8F0', fontWeight: 700 }}>
                <span style={{ color: '#0F172A' }}>Net Revenue</span>
                <span style={{ color: '#4F46E5' }}>${r.net.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div style={card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 16 }}>
              Conversion Funnel
            </h3>
            <FunnelChart steps={[
              { label: 'RSVPs Started', value: data.funnel.rsvps_started },
              { label: 'Confirmed', value: data.funnel.rsvps_confirmed },
              { label: 'Tickets Issued', value: data.funnel.tickets_issued },
              { label: 'Checked In', value: data.funnel.checked_in },
            ]} />
          </div>
        </div>

        {/* ── CHARTS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 16 }}>Ticket Sales Over Time</h3>
            <LineChart data={data.sales_timeline.map(s => ({ label: s.date, value: s.count }))} />
          </div>
          <div style={card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 16 }}>Revenue Over Time</h3>
            <LineChart data={data.revenue_timeline.map(s => ({ label: s.date, value: s.amount }))} color="#1565C0" />
          </div>
        </div>

        {isPast && data.checkin_timeline.length > 0 && (
          <div style={{ ...card, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 16 }}>Check-in Timeline</h3>
            <LineChart
              data={data.checkin_timeline.map(c => ({
                label: new Date(c.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                value: c.count,
              }))}
              color="#2E7D32"
            />
          </div>
        )}

        {/* ── PROMO CODES ── */}
        {data.promo_performance.length > 0 && (
          <div style={{ ...card, marginBottom: 24, overflowX: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', marginBottom: 16 }}>Promo Code Performance</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  {['Code', 'Discount', 'Times Used', 'Max Uses', 'RSVPs Using', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Code' ? 'left' : 'right', padding: '8px 10px', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.promo_performance.map(p => (
                  <tr key={p.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px', fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: '#4F46E5' }}>{p.code}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>
                      {p.discount_type === 'percentage' ? `${p.discount_value}%` : `$${p.discount_value}`}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>{p.used_count}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>{p.max_uses ?? '∞'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>{p.rsvps_using}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: p.is_active ? '#D1FAE5' : '#FEE2E2', color: p.is_active ? '#2E7D32' : '#C62828' }}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ATTENDEE LIST (last 20) ── */}
        <div style={{ ...card, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif', margin: 0 }}>
              Attendees ({data.attendees.length})
            </h3>
            <button onClick={exportCsv} style={{ fontSize: 12, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
              Export Full List
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                {['Name', 'Email', 'Tier', 'Qty', 'Status', 'Checked In', 'Comp'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#94A3B8', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.attendees.slice(0, 50).map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '8px', fontWeight: 500, color: '#0F172A' }}>{a.name}</td>
                  <td style={{ padding: '8px', color: '#475569' }}>{a.email}</td>
                  <td style={{ padding: '8px', color: '#334155' }}>{a.tier}</td>
                  <td style={{ padding: '8px', color: '#334155' }}>{a.quantity}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      padding: '1px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                      background: a.status === 'confirmed' ? '#D1FAE5' : a.status === 'cancelled' ? '#FEE2E2' : a.status === 'waitlist' ? '#FFF3E0' : '#F3E8FF',
                      color: a.status === 'confirmed' ? '#2E7D32' : a.status === 'cancelled' ? '#C62828' : a.status === 'waitlist' ? '#7C3AED' : '#475569',
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: a.checked_in === 'Yes' ? '#2E7D32' : '#94A3B8', fontWeight: a.checked_in === 'Yes' ? 600 : 400 }}>
                    {a.checked_in}
                  </td>
                  <td style={{ padding: '8px', color: a.is_comp === 'Yes' ? '#4F46E5' : '#94A3B8' }}>{a.is_comp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.attendees.length > 50 && (
            <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12 }}>
              Showing first 50 of {data.attendees.length} attendees. Export CSV for the full list.
            </p>
          )}
        </div>

      </main>
      
    </div>
  )
}
