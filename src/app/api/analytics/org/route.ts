/**
 * GET /api/analytics/org — Org-level (publisher-wide) analytics.
 *
 * Query params:
 *   period = 'lifetime' | 'year' | 'ytd' | 'quarter' | 'month' | 'custom'
 *   date_from = YYYY-MM-DD (for custom)
 *   date_to   = YYYY-MM-DD (for custom)
 *
 * Returns aggregated stats across ALL events for the authenticated publisher.
 * Admin sees all events on the platform.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

function getDateRange(period: string, dateFrom?: string, dateTo?: string): { from: string; to: string; label: string } {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const today = now.toISOString().slice(0, 10)

  switch (period) {
    case 'month':
      return { from: `${yyyy}-${mm}-01`, to: today, label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3)
      const qStart = `${yyyy}-${String(q * 3 + 1).padStart(2, '0')}-01`
      return { from: qStart, to: today, label: `Q${q + 1} ${yyyy}` }
    }
    case 'ytd':
      return { from: `${yyyy}-01-01`, to: today, label: `${yyyy} Year to Date` }
    case 'year':
      return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31`, label: String(yyyy) }
    case 'custom':
      return {
        from: dateFrom || `${yyyy}-01-01`,
        to: dateTo || today,
        label: `${dateFrom || `${yyyy}-01-01`} to ${dateTo || today}`,
      }
    case 'lifetime':
    default:
      return { from: '2000-01-01', to: '2099-12-31', label: 'All Time' }
  }
}

export async function GET(request: Request) {
  // Auth
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return bad('Not authenticated', 401)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Check role
  const { data: profile } = await service.from('profiles').select('role, name').eq('id', user.id).single()
  if (!profile) return bad('Profile not found', 404)
  const isAdmin = profile.role === 'admin'

  // Parse period
  const url = new URL(request.url)
  const period = url.searchParams.get('period') || 'lifetime'
  const { from, to, label } = getDateRange(period, url.searchParams.get('date_from') || undefined, url.searchParams.get('date_to') || undefined)

  // Fetch events for this publisher (or all for admin)
  let eventsQuery = service
    .from('events')
    .select('id, title, date, city, status, category')
    .is('deleted_at', null)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  if (!isAdmin) {
    eventsQuery = eventsQuery.eq('publisher_id', user.id)
  }

  const { data: events } = await eventsQuery
  if (!events || events.length === 0) {
    return NextResponse.json({
      ok: true,
      period: { key: period, label, from, to },
      org: { name: profile.name, role: profile.role },
      summary: {
        total_events: 0, published_events: 0, draft_events: 0,
        total_tickets: 0, checked_in: 0, no_show: 0, checkin_rate: 0,
        total_attendees: 0, unique_attendees: 0,
        comp_tickets: 0, cancelled_tickets: 0, transferred_tickets: 0,
        gross_revenue: 0, discounts_given: 0, refunded: 0, net_revenue: 0,
        paid_orders: 0, free_rsvps: 0,
      },
      events_breakdown: [],
      monthly_trend: [],
      top_events: [],
      category_breakdown: [],
    })
  }

  const eventIds = events.map((e: any) => e.id)

  // Fetch all data in parallel
  const [rsvpsRes, ticketsRes, ordersRes, tiersRes, promosRes] = await Promise.all([
    service.from('event_rsvps').select('id, event_id, tier_id, attendee_email, status, quantity, promo_code_id, created_at').in('event_id', eventIds),
    service.from('tickets').select('id, event_id, rsvp_id, tier_id, status, is_comp, transferred_from_email, checked_in_at, created_at').in('event_id', eventIds),
    service.from('orders').select('id, event_id, tier_id, quantity, unit_price, amount, status, created_at').in('event_id', eventIds),
    service.from('event_tiers').select('id, event_id, name, price, capacity').in('event_id', eventIds),
    service.from('promo_codes').select('id, event_id, code, discount_type, discount_value, used_count').in('event_id', eventIds),
  ])

  const rsvps = rsvpsRes.data || []
  const tickets = ticketsRes.data || []
  const orders = ordersRes.data || []
  const tiers = tiersRes.data || []
  const promos = promosRes.data || []

  // ── ORG-LEVEL SUMMARY ──
  const publishedEvents = events.filter((e: any) => e.status === 'published').length
  const draftEvents = events.filter((e: any) => e.status === 'draft').length

  const activeTickets = tickets.filter((t: any) => t.status === 'active')
  const usedTickets = tickets.filter((t: any) => t.status === 'used')
  const cancelledTickets = tickets.filter((t: any) => t.status === 'cancelled' || t.status === 'revoked')
  const compTickets = tickets.filter((t: any) => t.is_comp)
  const transferredTickets = tickets.filter((t: any) => t.transferred_from_email)

  const checkedIn = usedTickets.length
  const noShow = activeTickets.length
  const checkinRate = tickets.length > 0 ? Math.round((checkedIn / tickets.length) * 100) : 0

  // Unique attendees by email
  const uniqueEmails = new Set(rsvps.map((r: any) => r.attendee_email?.toLowerCase()).filter(Boolean))

  // Revenue
  const paidOrders = orders.filter((o: any) => o.status === 'paid')
  const refundedOrders = orders.filter((o: any) => o.status === 'refunded')
  const grossRevenue = paidOrders.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0)
  const refundedAmount = refundedOrders.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0)

  // Ticket revenue vs fees
  const ticketRevenue = paidOrders.reduce((s: number, o: any) => s + (Number(o.unit_price) || 0) * (o.quantity || 0), 0)

  // Discount total
  const tierMap = new Map(tiers.map((t: any) => [t.id, t]))
  let totalDiscount = 0
  for (const o of paidOrders) {
    const tier = tierMap.get(o.tier_id)
    if (tier) {
      const full = Number(tier.price) * (o.quantity || 0)
      const actual = (Number(o.unit_price) || 0) * (o.quantity || 0)
      if (full > actual) totalDiscount += full - actual
    }
  }

  // Free RSVPs (tier price = 0)
  const freeRsvps = rsvps.filter((r: any) => {
    const tier = tierMap.get(r.tier_id)
    return tier && Number(tier.price) === 0
  }).length

  // ── PER-EVENT BREAKDOWN ──
  const eventsBreakdown = events.map((ev: any) => {
    const evTickets = tickets.filter((t: any) => t.event_id === ev.id)
    const evOrders = orders.filter((o: any) => o.event_id === ev.id && o.status === 'paid')
    const evRsvps = rsvps.filter((r: any) => r.event_id === ev.id)
    const evCheckedIn = evTickets.filter((t: any) => t.status === 'used').length
    const evActive = evTickets.filter((t: any) => t.status === 'active').length
    const evRevenue = evOrders.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0)
    const evComp = evTickets.filter((t: any) => t.is_comp).length
    const evCancelled = evTickets.filter((t: any) => t.status === 'cancelled' || t.status === 'revoked').length

    return {
      event_id: ev.id,
      title: ev.title,
      date: ev.date,
      city: ev.city,
      status: ev.status,
      category: ev.category,
      tickets_sold: evRsvps.filter((r: any) => r.status === 'confirmed' || r.status === 'attended').reduce((s: number, r: any) => s + r.quantity, 0),
      checked_in: evCheckedIn,
      no_show: evActive,
      checkin_rate: evTickets.length > 0 ? Math.round((evCheckedIn / evTickets.length) * 100) : 0,
      revenue: Math.round(evRevenue * 100) / 100,
      comp: evComp,
      cancelled: evCancelled,
    }
  })

  // ── TOP EVENTS ──
  const topByRevenue = [...eventsBreakdown].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const topByAttendance = [...eventsBreakdown].sort((a, b) => b.checked_in - a.checked_in).slice(0, 5)

  // ── MONTHLY TREND ──
  const monthlyData: Record<string, { events: number; tickets: number; revenue: number; checkedIn: number }> = {}
  for (const ev of events) {
    const month = ev.date.slice(0, 7) // YYYY-MM
    if (!monthlyData[month]) monthlyData[month] = { events: 0, tickets: 0, revenue: 0, checkedIn: 0 }
    monthlyData[month].events++
  }
  for (const t of tickets) {
    const month = (t.created_at || '').slice(0, 7)
    if (month && monthlyData[month]) monthlyData[month].tickets++
    if (t.status === 'used' && month && monthlyData[month]) monthlyData[month].checkedIn++
  }
  for (const o of paidOrders) {
    const month = (o.created_at || '').slice(0, 7)
    if (month && monthlyData[month]) monthlyData[month].revenue += Number(o.amount) || 0
  }
  const monthlyTrend = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, ...d, revenue: Math.round(d.revenue * 100) / 100 }))

  // ── CATEGORY BREAKDOWN ──
  const catData: Record<string, { events: number; tickets: number; revenue: number }> = {}
  for (const ev of events) {
    const cat = ev.category || 'Other'
    if (!catData[cat]) catData[cat] = { events: 0, tickets: 0, revenue: 0 }
    catData[cat].events++
  }
  for (const eb of eventsBreakdown) {
    const cat = eb.category || 'Other'
    if (catData[cat]) {
      catData[cat].tickets += eb.tickets_sold
      catData[cat].revenue += eb.revenue
    }
  }
  const categoryBreakdown = Object.entries(catData)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .map(([category, d]) => ({ category, ...d, revenue: Math.round(d.revenue * 100) / 100 }))

  return NextResponse.json({
    ok: true,
    period: { key: period, label, from, to },
    org: { name: profile.name, role: profile.role },
    summary: {
      total_events: events.length,
      published_events: publishedEvents,
      draft_events: draftEvents,
      total_tickets: tickets.length,
      checked_in: checkedIn,
      no_show: noShow,
      checkin_rate: checkinRate,
      total_attendees: rsvps.reduce((s: number, r: any) => s + r.quantity, 0),
      unique_attendees: uniqueEmails.size,
      comp_tickets: compTickets.length,
      cancelled_tickets: cancelledTickets.length,
      transferred_tickets: transferredTickets.length,
      gross_revenue: Math.round(grossRevenue * 100) / 100,
      discounts_given: Math.round(totalDiscount * 100) / 100,
      refunded: Math.round(refundedAmount * 100) / 100,
      net_revenue: Math.round((grossRevenue - refundedAmount) * 100) / 100,
      paid_orders: paidOrders.length,
      free_rsvps: freeRsvps,
    },
    events_breakdown: eventsBreakdown,
    monthly_trend: monthlyTrend,
    top_events: { by_revenue: topByRevenue, by_attendance: topByAttendance },
    category_breakdown: categoryBreakdown,
  })
}
