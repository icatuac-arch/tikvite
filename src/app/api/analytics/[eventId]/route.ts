/**
 * GET /api/analytics/[eventId] — Comprehensive event analytics & reporting.
 * Requires authenticated publisher who owns the event, or admin.
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

export async function GET(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  const { eventId } = params
  if (!eventId) return bad('Missing eventId')

  // Auth
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return bad('Not authenticated', 401)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify ownership
  const { data: event } = await service
    .from('events')
    .select('id, title, publisher_id, date, time, venue, city, state, rsvp_capacity, status, fee_pass_to_buyer')
    .eq('id', eventId)
    .is('deleted_at', null)
    .single()

  if (!event) return bad('Event not found', 404)

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return bad('Not authorized', 403)
  }

  // Fetch all data in parallel
  const [rsvpsRes, ticketsRes, ordersRes, tiersRes, promosRes] = await Promise.all([
    service.from('event_rsvps').select('*').eq('event_id', eventId),
    service.from('tickets').select('*').eq('event_id', eventId),
    service.from('orders').select('*').eq('event_id', eventId),
    service.from('event_tiers').select('*').eq('event_id', eventId).order('sort_order'),
    service.from('promo_codes').select('*').eq('event_id', eventId),
  ])

  const rsvps = rsvpsRes.data || []
  const tickets = ticketsRes.data || []
  const orders = ordersRes.data || []
  const tiers = tiersRes.data || []
  const promos = promosRes.data || []

  // ── TICKET INVENTORY ──
  const activeTickets = tickets.filter((t: any) => t.status === 'active')
  const usedTickets = tickets.filter((t: any) => t.status === 'used')
  const cancelledTickets = tickets.filter((t: any) => t.status === 'cancelled')
  const revokedTickets = tickets.filter((t: any) => t.status === 'revoked')
  const compTickets = tickets.filter((t: any) => t.is_comp === true)
  const transferredTickets = tickets.filter((t: any) => t.transferred_from_email)

  // Total capacity across all tiers
  let totalCapacity: number | null = null
  const hasCapacity = tiers.some((t: any) => t.capacity != null)
  if (hasCapacity) {
    totalCapacity = tiers.reduce((sum: number, t: any) => sum + (t.capacity || 0), 0)
  }

  // Per-tier breakdown
  const tierMap = new Map(tiers.map((t: any) => [t.id, t]))
  const tierBreakdown = tiers.map((t: any) => {
    const tierTickets = tickets.filter((tk: any) => tk.tier_id === t.id)
    const tierRsvps = rsvps.filter((r: any) => r.tier_id === t.id)
    const sold = tierRsvps
      .filter((r: any) => r.status === 'confirmed' || r.status === 'attended' || r.status === 'pending')
      .reduce((s: number, r: any) => s + (r.quantity || 0), 0)
    const waitlisted = tierRsvps
      .filter((r: any) => r.status === 'waitlist')
      .reduce((s: number, r: any) => s + (r.quantity || 0), 0)
    const checkedIn = tierTickets.filter((tk: any) => tk.status === 'used').length
    const cancelled = tierTickets.filter((tk: any) => tk.status === 'cancelled' || tk.status === 'revoked').length
    const comp = tierTickets.filter((tk: any) => tk.is_comp).length

    return {
      tier_id: t.id,
      tier_name: t.name,
      price: Number(t.price),
      capacity: t.capacity,
      sold,
      unsold: t.capacity != null ? Math.max(0, t.capacity - sold) : null,
      waitlisted,
      checked_in: checkedIn,
      no_show: sold - checkedIn > 0 ? sold - checkedIn : 0,
      cancelled,
      comp,
    }
  })

  // ── ATTENDANCE ──
  const totalSold = tierBreakdown.reduce((s, t) => s + t.sold, 0)
  const totalCheckedIn = usedTickets.length
  const noShowCount = Math.max(0, activeTickets.length) // active = not checked in, not cancelled
  const checkinRate = tickets.length > 0 ? Math.round((totalCheckedIn / tickets.length) * 100) : 0

  // ── REVENUE ──
  const paidOrders = orders.filter((o: any) => o.status === 'paid')
  const refundedOrders = orders.filter((o: any) => o.status === 'refunded')
  const grossRevenue = paidOrders.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0)
  const refundedAmount = refundedOrders.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0)

  // Estimate platform fees and Stripe fees from paid orders
  const ticketRevenue = paidOrders.reduce((s: number, o: any) => {
    return s + (Number(o.unit_price) || 0) * (o.quantity || 0)
  }, 0)
  const feesCollected = grossRevenue - ticketRevenue

  // Promo discount total (estimate from difference between full price and actual charged)
  let totalDiscount = 0
  for (const o of paidOrders) {
    const tier = tierMap.get(o.tier_id)
    if (tier) {
      const fullPrice = Number(tier.price) * (o.quantity || 0)
      const actualTicketAmount = (Number(o.unit_price) || 0) * (o.quantity || 0)
      if (fullPrice > actualTicketAmount) {
        totalDiscount += fullPrice - actualTicketAmount
      }
    }
  }

  // ── RSVP STATUS BREAKDOWN ──
  const rsvpByStatus: Record<string, number> = {}
  for (const r of rsvps) {
    rsvpByStatus[r.status] = (rsvpByStatus[r.status] || 0) + 1
  }

  // ── SALES TIMELINE (by day) ──
  const salesByDay: Record<string, number> = {}
  for (const t of tickets) {
    const day = (t.created_at || '').slice(0, 10)
    if (day) salesByDay[day] = (salesByDay[day] || 0) + 1
  }
  const salesTimeline = Object.entries(salesByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // ── REVENUE TIMELINE (by day) ──
  const revenueByDay: Record<string, number> = {}
  for (const o of paidOrders) {
    const day = (o.created_at || '').slice(0, 10)
    if (day) revenueByDay[day] = (revenueByDay[day] || 0) + (Number(o.amount) || 0)
  }
  const revenueTimeline = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))

  // ── CHECK-IN TIMELINE (by hour) ──
  const checkinByHour: Record<string, number> = {}
  for (const t of tickets) {
    if (t.checked_in_at) {
      const hour = t.checked_in_at.slice(0, 13) + ':00'
      checkinByHour[hour] = (checkinByHour[hour] || 0) + 1
    }
  }
  const checkinTimeline = Object.entries(checkinByHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }))

  // ── PROMO PERFORMANCE ──
  const promoPerformance = promos.map((p: any) => {
    // Calculate total discount given by this promo
    const promoRsvps = rsvps.filter((r: any) => r.promo_code_id === p.id)
    return {
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      used_count: p.used_count || 0,
      max_uses: p.max_uses,
      is_active: p.is_active,
      rsvps_using: promoRsvps.length,
    }
  })

  // ── CONVERSION FUNNEL ──
  const totalRsvps = rsvps.length
  const confirmedRsvps = rsvps.filter((r: any) => r.status === 'confirmed' || r.status === 'attended').length
  const waitlistedRsvps = rsvps.filter((r: any) => r.status === 'waitlist').length
  const cancelledRsvps = rsvps.filter((r: any) => r.status === 'cancelled').length

  // ── ATTENDEE LIST (for CSV export) ──
  const attendees = rsvps.map((r: any) => {
    const tierName = tierMap.get(r.tier_id)?.name || 'General'
    const rsvpTickets = tickets.filter((t: any) => t.rsvp_id === r.id)
    const checkedInTickets = rsvpTickets.filter((t: any) => t.status === 'used')
    return {
      name: r.attendee_name,
      email: r.attendee_email,
      phone: r.attendee_phone || '',
      tier: tierName,
      quantity: r.quantity,
      status: r.status,
      tickets: rsvpTickets.map((t: any) => t.ticket_number).join(', '),
      checked_in: checkedInTickets.length > 0 ? 'Yes' : 'No',
      checked_in_at: checkedInTickets[0]?.checked_in_at || '',
      is_comp: rsvpTickets.some((t: any) => t.is_comp) ? 'Yes' : 'No',
      created_at: r.created_at,
    }
  })

  return NextResponse.json({
    ok: true,
    event: {
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      venue: event.venue,
      city: event.city,
      status: event.status,
    },
    // ── Summary cards ──
    summary: {
      total_rsvps: totalRsvps,
      confirmed_rsvps: confirmedRsvps,
      waitlisted_rsvps: waitlistedRsvps,
      cancelled_rsvps: cancelledRsvps,
      total_tickets: tickets.length,
      active_tickets: activeTickets.length,
      checked_in: totalCheckedIn,
      no_show: noShowCount,
      checkin_rate: checkinRate,
      comp_tickets: compTickets.length,
      transferred_tickets: transferredTickets.length,
      cancelled_tickets: cancelledTickets.length + revokedTickets.length,
      total_capacity: totalCapacity,
      total_sold: totalSold,
      unsold: totalCapacity != null ? Math.max(0, totalCapacity - totalSold) : null,
    },
    // ── Revenue ──
    revenue: {
      gross: grossRevenue,
      ticket_revenue: ticketRevenue,
      fees_collected: Math.round(feesCollected * 100) / 100,
      discounts_given: Math.round(totalDiscount * 100) / 100,
      refunded: refundedAmount,
      net: Math.round((grossRevenue - refundedAmount) * 100) / 100,
      paid_orders: paidOrders.length,
      refunded_orders: refundedOrders.length,
    },
    // ── Tier breakdown ──
    tier_breakdown: tierBreakdown,
    // ── Timelines ──
    sales_timeline: salesTimeline,
    revenue_timeline: revenueTimeline,
    checkin_timeline: checkinTimeline,
    // ── RSVP status breakdown ──
    rsvp_by_status: rsvpByStatus,
    // ── Promo codes ──
    promo_performance: promoPerformance,
    // ── Funnel ──
    funnel: {
      rsvps_started: totalRsvps,
      rsvps_confirmed: confirmedRsvps,
      tickets_issued: tickets.length,
      checked_in: totalCheckedIn,
    },
    // ── Attendee list ──
    attendees,
  })
}
