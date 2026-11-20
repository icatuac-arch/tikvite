/**
 * Stripe Checkout session creation endpoint.
 *
 * Creates an order row (pending) then redirects the attendee to Stripe
 * Checkout. The webhook handler marks the order as paid and creates the
 * RSVP + tickets on completion.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { getShortId } from '@/lib/constants'
import type { EventTier } from '@/lib/rsvp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
// Platform fee per ticket in USD (set via env var, 0 = no fee)
const PLATFORM_FEE_PER_TICKET = Number(process.env.PLATFORM_FEE_PER_TICKET || '0')

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return bad('Server not configured', 500)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON body') }

  const eventId = (body.event_id || '').toString().trim()
  const tierId = (body.tier_id || '').toString().trim()
  const attendeeName = (body.attendee_name || '').toString().trim()
  const attendeeEmail = (body.attendee_email || '').toString().trim()
  const attendeePhone = (body.attendee_phone || '').toString().trim()
  const quantity = Math.max(1, Math.min(20, parseInt(body.quantity || '1', 10) || 1))
  const notes = (body.notes || '').toString().trim()
  const seatIds: string[] = Array.isArray(body.seat_ids) ? body.seat_ids : []
  const buyerSession = (body.buyer_session || '').toString().trim()

  if (!eventId) return bad('Missing event')
  if (!tierId) return bad('Missing tier')
  if (!attendeeName) return bad('Please provide your name')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail)) return bad('Please provide a valid email')
  if (seatIds.length > 0 && seatIds.length !== quantity) {
    return bad(`Seat count (${seatIds.length}) does not match quantity (${quantity})`)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch event
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, title, rsvp_enabled, rsvp_deadline, rsvp_capacity, status, date, venue, city, fee_pass_to_buyer')
    .eq('id', eventId)
    .single()
  if (evErr || !event) return bad('Event not found', 404)
  if (event.status !== 'published') return bad('Event is not published')
  if (!event.rsvp_enabled) return bad('RSVP is not open for this event')
  if (event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date()) {
    return bad('RSVP deadline has passed')
  }

  // Fetch tier
  const { data: tier } = await supabase
    .from('event_tiers')
    .select('*')
    .eq('id', tierId)
    .eq('event_id', eventId)
    .single()
  if (!tier) return bad('Invalid ticket tier')
  const t = tier as EventTier & { stripe_enabled?: boolean }
  if (Number(t.price) <= 0) return bad('This tier is free — use the standard RSVP flow')
  if (!t.stripe_enabled) return bad('Online payment is not enabled for this tier')

  // Capacity check
  const { data: rsvps } = await supabase
    .from('event_rsvps')
    .select('quantity, status, tier_id')
    .eq('event_id', eventId)
  const allRsvps = (rsvps || []) as { quantity: number; status: string; tier_id: string | null }[]
  const activeCond = (r: any) => r.status === 'confirmed' || r.status === 'attended' || r.status === 'pending'

  if (t.capacity != null) {
    const tierTaken = allRsvps.filter(r => r.tier_id === tierId && activeCond(r)).reduce((s, r) => s + r.quantity, 0)
    if (tierTaken + quantity > t.capacity) return bad('This tier is sold out')
  }
  if (event.rsvp_capacity != null) {
    const eventTaken = allRsvps.filter(activeCond).reduce((s, r) => s + r.quantity, 0)
    if (eventTaken + quantity > event.rsvp_capacity) return bad('Event is at capacity')
  }

  // If seat_ids provided, verify they are held by this buyer
  if (seatIds.length > 0) {
    if (!buyerSession) return bad('Missing buyer_session for seat reservation')
    const { data: heldSeats } = await supabase
      .from('session_seats')
      .select('seat_id, status, held_by, hold_expires_at')
      .eq('event_id', eventId)
      .in('seat_id', seatIds)

    if (!heldSeats || heldSeats.length !== seatIds.length) {
      return bad('Some seats not found in session inventory')
    }
    const now = new Date()
    for (const hs of heldSeats) {
      if (hs.status !== 'held' || hs.held_by !== buyerSession) {
        return bad('One or more seats are not held by you')
      }
      if (hs.hold_expires_at && new Date(hs.hold_expires_at) < now) {
        return bad('Your seat hold has expired — please select seats again')
      }
    }
  }

  // Re-verify seat holds are still valid right before order creation (prevents race condition)
  if (seatIds.length > 0) {
    const { data: recheck } = await supabase
      .from('session_seats')
      .select('seat_id, status, held_by, hold_expires_at')
      .eq('event_id', eventId)
      .in('seat_id', seatIds)

    if (!recheck || recheck.length !== seatIds.length) {
      return bad('Some seats are no longer available — please select seats again')
    }
    const now = new Date()
    for (const seat of recheck) {
      if (seat.status !== 'held' || seat.held_by !== buyerSession) {
        return bad('One or more of your held seats have been released — please select seats again')
      }
      if (seat.hold_expires_at && new Date(seat.hold_expires_at) < now) {
        return bad('Your seat hold has expired — please select seats again')
      }
    }
  }

  // Promo code discount (validated on client, re-validated here)
  const promoCodeId = (body.promo_code_id || '').toString().trim()
  const clientDiscountAmount = Number(body.discount_amount || 0)
  let unitPrice = Number(t.price)
  let promoDiscount = 0

  if (promoCodeId && clientDiscountAmount > 0) {
    // Re-validate promo code server-side
    const { data: promo } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('id', promoCodeId)
      .eq('event_id', eventId)
      .eq('is_active', true)
      .single()

    if (promo) {
      const now = new Date()
      const validFrom = promo.valid_from ? new Date(promo.valid_from) <= now : true
      const validUntil = promo.valid_until ? new Date(promo.valid_until) >= now : true
      const underMax = promo.max_uses == null || (promo.used_count || 0) < promo.max_uses
      const meetsMin = quantity >= (promo.min_quantity || 1)
      const tierOk = !promo.applicable_tiers || promo.applicable_tiers.length === 0 || promo.applicable_tiers.includes(tierId)

      if (validFrom && validUntil && underMax && meetsMin && tierOk) {
        if (promo.discount_type === 'percentage') {
          promoDiscount = Math.round(unitPrice * quantity * (promo.discount_value / 100) * 100) / 100
        } else {
          promoDiscount = Math.min(promo.discount_value * quantity, unitPrice * quantity)
        }
      }
    }
  }

  const ticketTotal = Math.max(0, unitPrice * quantity - promoDiscount)

  // If promo makes total zero, reject — should use the free RSVP flow instead
  if (ticketTotal <= 0) {
    return bad('Promo code makes this ticket free. Please use the standard RSVP form instead of checkout.')
  }

  // Recalculate effective unit price for Stripe line items
  const effectiveUnitPrice = ticketTotal / quantity
  const feePassToBuyer = !!(event as any).fee_pass_to_buyer

  // Platform fee: fixed per ticket (set by admin via PLATFORM_FEE_PER_TICKET env var)
  const platformFee = feePassToBuyer ? PLATFORM_FEE_PER_TICKET * quantity : 0

  // Stripe processing fee: 2.9% + $0.30 (calculated on total after promo discount + platform fee)
  const subtotalBeforeStripe = ticketTotal + platformFee
  const stripeFee = feePassToBuyer && subtotalBeforeStripe > 0
    ? Math.round((subtotalBeforeStripe * 0.029 + 0.30) * 100) / 100
    : 0
  const amount = ticketTotal + platformFee + stripeFee

  // Create order row
  const { data: order, error: ordErr } = await supabase.from('orders').insert({
    event_id: eventId,
    tier_id: tierId,
    attendee_name: attendeeName.substring(0, 200),
    attendee_email: attendeeEmail.substring(0, 200),
    attendee_phone: attendeePhone.substring(0, 40),
    quantity,
    unit_price: unitPrice,
    amount,
    notes: notes.substring(0, 2000),
    status: 'pending',
    seat_info: seatIds.length > 0 ? { seat_ids: seatIds, buyer_session: buyerSession } : null,
  }).select('id').single()
  if (ordErr || !order) return bad(`Order creation failed: ${ordErr?.message || 'unknown'}`, 500)

  // Create Stripe Checkout Session
  try {
    const stripe = getStripe()
    const shortId = getShortId(event.id)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: attendeeEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(effectiveUnitPrice * 100), // cents (after promo discount)
            product_data: {
              name: `${t.name} — ${event.title}`,
              description: promoDiscount > 0
                ? `${event.date} · ${event.venue || event.city} (promo applied)`
                : `${event.date} · ${event.venue || event.city}`,
            },
          },
          quantity,
        },
        ...(platformFee > 0 ? [{
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(PLATFORM_FEE_PER_TICKET * 100),
            product_data: {
              name: 'Service Fee',
              description: 'Ticvite service fee',
            },
          },
          quantity,
        }] : []),
        ...(stripeFee > 0 ? [{
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(stripeFee * 100),
            product_data: {
              name: 'Processing Fee',
              description: 'Card processing fee',
            },
          },
          quantity: 1,
        }] : []),
      ],
      metadata: {
        order_id: order.id,
        event_id: eventId,
        tier_id: tierId,
        quantity: String(quantity),
        attendee_name: attendeeName.substring(0, 200),
        attendee_email: attendeeEmail.substring(0, 200),
        attendee_phone: attendeePhone.substring(0, 40),
        ...(seatIds.length > 0 ? { seat_ids: JSON.stringify(seatIds) } : {}),
        ...(promoCodeId ? { promo_code_id: promoCodeId, promo_discount: String(promoDiscount) } : {}),
      },
      success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/e/${shortId}/rsvp?cancelled=1`,
    })

    // Update order with session ID
    await supabase.from('orders').update({
      stripe_checkout_session_id: session.id,
    }).eq('id', order.id)

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err: any) {
    console.error('[checkout] Stripe error', err?.message)
    // Clean up the pending order
    await supabase.from('orders').delete().eq('id', order.id)
    return bad(`Payment setup failed: ${err?.message || 'unknown'}`, 500)
  }
}
