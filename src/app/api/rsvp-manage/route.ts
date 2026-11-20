/**
 * Unified RSVP management endpoint.
 *
 * One route handles every publisher-side mutation — updating an RSVP's
 * status, editing a tier, and toggling the event's RSVP config. Auth is
 * dual-mode:
 *
 *   1. Guest publisher — payload includes `token`. We look up the event
 *      by `guest_edit_token` and, if it matches, run the mutation with
 *      the service-role key.
 *
 *   2. Registered publisher — no token needed. We verify the caller is
 *      authenticated (SSR cookie) and owns the event (publisher_id =
 *      auth.uid()) or is an admin.
 *
 * Both paths converge on the same DB writes.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { generateTicketNumber, generateQrToken, buildTicketQrUrl, generateQrDataUrl } from '@/lib/tickets'
import { sendEmail, renderTicketEmail } from '@/lib/email'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const VALID_STATUSES = new Set(['pending', 'confirmed', 'cancelled', 'attended', 'waitlist'])

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

/** Resolve event_id from either a guest token or authenticated caller. */
async function authorize(body: any): Promise<{ eventId: string; supabase: any } | { error: string; status: number }> {
  const eventId: string | undefined = body?.event_id
  const token: string | undefined = body?.token

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  if (token) {
    // Guest — validate token → event.
    const { data: event } = await service
      .from('events')
      .select('id, guest_edit_token')
      .eq('guest_edit_token', token)
      .single()
    if (!event) return { error: 'Invalid or expired management link', status: 401 }
    if (eventId && event.id !== eventId) return { error: 'Token / event mismatch', status: 403 }
    return { eventId: event.id, supabase: service }
  }

  if (!eventId) return { error: 'Missing event_id', status: 400 }

  // Registered path — SSR auth via cookies.
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => { /* read-only in this route */ },
    },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return { error: 'Not authenticated', status: 401 }

  const { data: event } = await service
    .from('events')
    .select('id, publisher_id')
    .eq('id', eventId)
    .single()
  if (!event) return { error: 'Event not found', status: 404 }

  if (event.publisher_id !== user.id) {
    // Admin escape hatch.
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return { error: 'Not the event publisher', status: 403 }
  }

  return { eventId, supabase: service }
}

/** GET — refresh the tiers + rsvps for an event. Same auth as POST. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const body = {
    event_id: url.searchParams.get('event_id') || '',
    token: url.searchParams.get('token') || '',
  }
  const auth = await authorize(body)
  if ('error' in auth) return bad(auth.error, auth.status)
  const { eventId, supabase } = auth
  const [{ data: tiers }, { data: rsvps }, { data: orders }] = await Promise.all([
    supabase.from('event_tiers').select('*').eq('event_id', eventId).order('sort_order', { ascending: true }),
    supabase.from('event_rsvps').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('orders').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
  ])
  return NextResponse.json({ ok: true, tiers: tiers || [], rsvps: rsvps || [], orders: orders || [] })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON body') }

  const auth = await authorize(body)
  if ('error' in auth) return bad(auth.error, auth.status)
  const { eventId, supabase } = auth
  const action = (body.action || '').toString()

  switch (action) {
    case 'set_rsvp_status': {
      const rsvpId = (body.rsvp_id || '').toString()
      const status = (body.status || '').toString()
      if (!rsvpId) return bad('Missing rsvp_id')
      if (!VALID_STATUSES.has(status)) return bad('Invalid status')
      const patch: any = { status }
      if (status === 'attended') patch.checked_in_at = new Date().toISOString()
      if (status !== 'attended') patch.checked_in_at = null
      const { error } = await supabase
        .from('event_rsvps')
        .update(patch)
        .eq('id', rsvpId)
        .eq('event_id', eventId)
      if (error) return bad(error.message, 500)

      // Ticket sync: generate tickets when confirmed, cancel when cancelled
      if (status === 'confirmed') {
        // Re-check capacity before confirming (prevents over-selling from waitlist)
        const { data: rsvpForCap } = await supabase
          .from('event_rsvps')
          .select('quantity, tier_id')
          .eq('id', rsvpId)
          .single()
        if (rsvpForCap) {
          const { data: allRsvps } = await supabase
            .from('event_rsvps')
            .select('quantity, status, tier_id')
            .eq('event_id', eventId)
            .neq('id', rsvpId)
          const activeRsvps = (allRsvps || []).filter(
            (r: any) => r.status === 'confirmed' || r.status === 'attended' || r.status === 'pending'
          )
          // Check tier capacity
          if (rsvpForCap.tier_id) {
            const { data: tier } = await supabase
              .from('event_tiers')
              .select('capacity')
              .eq('id', rsvpForCap.tier_id)
              .single()
            if (tier?.capacity != null) {
              const tierTaken = activeRsvps
                .filter((r: any) => r.tier_id === rsvpForCap.tier_id)
                .reduce((s: number, r: any) => s + r.quantity, 0)
              if (tierTaken + rsvpForCap.quantity > tier.capacity) {
                return bad('Cannot confirm — tier is at capacity')
              }
            }
          }
          // Check event capacity
          const { data: eventData } = await supabase
            .from('events')
            .select('rsvp_capacity')
            .eq('id', eventId)
            .single()
          if (eventData?.rsvp_capacity != null) {
            const eventTaken = activeRsvps.reduce((s: number, r: any) => s + r.quantity, 0)
            if (eventTaken + rsvpForCap.quantity > eventData.rsvp_capacity) {
              return bad('Cannot confirm — event is at capacity')
            }
          }
        }

        // Check if tickets already exist for this RSVP
        const { data: existingTickets } = await supabase
          .from('tickets')
          .select('id')
          .eq('rsvp_id', rsvpId)
          .limit(1)
        if (!existingTickets?.length) {
          // Fetch RSVP details to generate tickets
          const { data: rsvp } = await supabase
            .from('event_rsvps')
            .select('attendee_name, attendee_email, quantity, tier_id')
            .eq('id', rsvpId)
            .single()
          if (rsvp) {
            const ticketRows = []
            for (let i = 0; i < (rsvp.quantity || 1); i++) {
              ticketRows.push({
                event_id: eventId,
                rsvp_id: rsvpId,
                tier_id: rsvp.tier_id || null,
                holder_name: rsvp.attendee_name,
                holder_email: rsvp.attendee_email,
                ticket_number: generateTicketNumber(),
                qr_token: generateQrToken(),
                status: 'active',
              })
            }
            if (ticketRows.length > 0) {
              await supabase.from('tickets').insert(ticketRows)
            }
          }
        }
      } else if (status === 'cancelled') {
        // Cancel all tickets for this RSVP
        await supabase
          .from('tickets')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('rsvp_id', rsvpId)

        // Auto-promote waitlist: fetch the cancelled RSVP's tier, then promote next in line
        const { data: cancelledRsvp } = await supabase
          .from('event_rsvps')
          .select('tier_id')
          .eq('id', rsvpId)
          .single()

        if (cancelledRsvp?.tier_id) {
          // Fire-and-forget waitlist promotion
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
          fetch(`${siteUrl}/api/waitlist/promote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId, tier_id: cancelledRsvp.tier_id }),
          }).catch(() => {})
        }
      }

      return NextResponse.json({ ok: true })
    }

    case 'upsert_tier': {
      const t = body.tier || {}
      if (!t.name) return bad('Tier needs a name')
      const price = Math.max(0, Number(t.price) || 0)
      const capacity = t.capacity == null || t.capacity === '' ? null : Math.max(1, parseInt(t.capacity, 10) || 1)
      const sort_order = Number(t.sort_order) || 0
      const stripe_enabled = !!t.stripe_enabled
      if (t.id) {
        const { error } = await supabase.from('event_tiers').update({
          name: String(t.name).substring(0, 200),
          price,
          capacity,
          sort_order,
          stripe_enabled,
        }).eq('id', t.id).eq('event_id', eventId)
        if (error) return bad(error.message, 500)
      } else {
        const { error } = await supabase.from('event_tiers').insert({
          event_id: eventId,
          name: String(t.name).substring(0, 200),
          price,
          capacity,
          sort_order,
          stripe_enabled,
        })
        if (error) return bad(error.message, 500)
      }
      return NextResponse.json({ ok: true })
    }

    case 'delete_tier': {
      const tierId = (body.tier_id || '').toString()
      if (!tierId) return bad('Missing tier_id')
      const { error } = await supabase
        .from('event_tiers')
        .delete()
        .eq('id', tierId)
        .eq('event_id', eventId)
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true })
    }

    case 'cancel_rsvp_and_tickets': {
      const rsvpId = (body.rsvp_id || '').toString()
      if (!rsvpId) return bad('Missing rsvp_id')

      // Fetch the RSVP to get attendee info
      const { data: rsvpRow } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('id', rsvpId)
        .eq('event_id', eventId)
        .single()
      if (!rsvpRow) return bad('RSVP not found', 404)

      // 1. Set RSVP status to cancelled
      const { error: rsvpErr } = await supabase
        .from('event_rsvps')
        .update({ status: 'cancelled' })
        .eq('id', rsvpId)
        .eq('event_id', eventId)
      if (rsvpErr) return bad(rsvpErr.message, 500)

      // 2. Cancel all tickets for this RSVP
      await supabase
        .from('tickets')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('rsvp_id', rsvpId)

      // 3. Send cancellation email (fire-and-forget)
      if (rsvpRow.attendee_email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
        const { data: eventRow } = await supabase
          .from('events')
          .select('title')
          .eq('id', eventId)
          .single()
        fetch(`${siteUrl}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: rsvpRow.attendee_email,
            subject: `Your RSVP for ${eventRow?.title || 'an event'} has been cancelled`,
            html: `<p>Hi ${rsvpRow.attendee_name || ''},</p>
              <p>Your RSVP (confirmation code: <strong>${rsvpRow.confirmation_code}</strong>) for <strong>${eventRow?.title || 'the event'}</strong> has been cancelled by the organizer.</p>
              <p>All associated tickets have been revoked.</p>
              <p>If you have any questions, please contact the event organizer.</p>`,
          }),
        }).catch(() => {})
      }

      // 4. Promote next waitlisted attendee
      if (rsvpRow.tier_id) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
        fetch(`${siteUrl}/api/waitlist/promote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, tier_id: rsvpRow.tier_id }),
        }).catch(() => {})
      }

      return NextResponse.json({ ok: true })
    }

    case 'update_event_rsvp_config': {
      const cfg: any = {}
      if ('rsvp_enabled' in body) cfg.rsvp_enabled = !!body.rsvp_enabled
      if ('rsvp_deadline' in body) cfg.rsvp_deadline = body.rsvp_deadline || null
      if ('rsvp_capacity' in body) cfg.rsvp_capacity = body.rsvp_capacity == null || body.rsvp_capacity === '' ? null : Math.max(1, parseInt(body.rsvp_capacity, 10) || 1)
      if ('payment_link' in body) cfg.payment_link = String(body.payment_link || '').substring(0, 1000)
      if ('payment_instructions' in body) cfg.payment_instructions = String(body.payment_instructions || '').substring(0, 5000)
      if ('reminder_enabled' in body) cfg.reminder_enabled = body.reminder_enabled !== false
      if ('allow_self_cancel' in body) cfg.allow_self_cancel = !!body.allow_self_cancel
      const { error } = await supabase.from('events').update(cfg).eq('id', eventId)
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true })
    }

    case 'refund_order': {
      const orderId = (body.order_id || '').toString()
      if (!orderId) return bad('Missing order_id')

      // Fetch order
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('event_id', eventId)
        .single()
      if (!order) return bad('Order not found', 404)
      if (order.status !== 'paid') return bad('Only paid orders can be refunded')
      if (!order.stripe_payment_intent_id) return bad('No Stripe payment intent found for this order')

      // Issue Stripe refund
      try {
        const stripe = getStripe()
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
        })
      } catch (err: any) {
        return bad(`Stripe refund failed: ${err?.message || 'unknown'}`, 500)
      }

      // Update order status
      await supabase.from('orders').update({
        status: 'refunded',
        updated_at: new Date().toISOString(),
      }).eq('id', orderId)

      // Cancel linked RSVP
      if (order.rsvp_id) {
        await supabase.from('event_rsvps').update({
          status: 'cancelled',
        }).eq('id', order.rsvp_id)

        // Cancel linked tickets
        await supabase.from('tickets').update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        }).eq('rsvp_id', order.rsvp_id)
      }

      return NextResponse.json({ ok: true })
    }

    case 'resend_ticket_email': {
      const rsvpId = (body.rsvp_id || '').toString()
      if (!rsvpId) return bad('Missing rsvp_id')

      // Fetch RSVP
      const { data: rsvpRow } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('id', rsvpId)
        .eq('event_id', eventId)
        .single()
      if (!rsvpRow) return bad('RSVP not found', 404)

      // Fetch tickets
      const { data: rsvpTickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('rsvp_id', rsvpId)
        .in('status', ['active', 'used'])
      if (!rsvpTickets || rsvpTickets.length === 0) return bad('No active tickets for this RSVP')

      // Fetch event details for the email
      const { data: eventRow } = await supabase
        .from('events')
        .select('title, date, venue')
        .eq('id', eventId)
        .single()

      try {
        const ticketEmailData = await Promise.all(
          rsvpTickets.map(async (t: any) => ({
            ticketNumber: t.ticket_number,
            qrDataUrl: await generateQrDataUrl(buildTicketQrUrl(t.qr_token)),
          }))
        )
        const html = renderTicketEmail({
          eventTitle: eventRow?.title || '',
          eventDate: eventRow?.date || '',
          eventVenue: eventRow?.venue || '',
          tickets: ticketEmailData,
        })
        await sendEmail({
          to: rsvpRow.attendee_email,
          subject: `Your Tickets — ${eventRow?.title || 'Event'}`,
          html,
        })
      } catch (e: any) {
        return bad(`Email failed: ${e?.message}`, 500)
      }

      return NextResponse.json({ ok: true })
    }

    case 'edit_attendee': {
      const rsvpId = (body.rsvp_id || '').toString()
      if (!rsvpId) return bad('Missing rsvp_id')

      const patch: any = {}
      if (body.attendee_name !== undefined) patch.attendee_name = String(body.attendee_name).substring(0, 200)
      if (body.attendee_email !== undefined) patch.attendee_email = String(body.attendee_email).substring(0, 300)
      if (body.attendee_phone !== undefined) patch.attendee_phone = String(body.attendee_phone).substring(0, 30)

      if (Object.keys(patch).length === 0) return bad('No fields to update')

      const { error: rsvpErr } = await supabase
        .from('event_rsvps')
        .update(patch)
        .eq('id', rsvpId)
        .eq('event_id', eventId)
      if (rsvpErr) return bad(rsvpErr.message, 500)

      // Also update tickets if name or email changed
      const ticketPatch: any = {}
      if (patch.attendee_name) ticketPatch.holder_name = patch.attendee_name
      if (patch.attendee_email) ticketPatch.holder_email = patch.attendee_email
      if (Object.keys(ticketPatch).length > 0) {
        await supabase
          .from('tickets')
          .update(ticketPatch)
          .eq('rsvp_id', rsvpId)
      }

      return NextResponse.json({ ok: true })
    }

    default:
      return bad('Unknown action')
  }
}
