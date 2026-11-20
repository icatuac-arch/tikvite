/**
 * Attendee RSVP submission endpoint.
 *
 * Public — anyone can POST. We validate the input, check the tier /
 * event capacity to decide whether the RSVP is confirmed, pending, or
 * waitlisted, mint a short confirmation code, and email the attendee.
 * All DB work uses the service-role key so we don't rely on RLS
 * insert-with-check to compute status correctly (it can't do the
 * capacity join).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decideRsvpStatus, generateConfirmationCode, EventTier, EventRsvp } from '@/lib/rsvp'
import { sendEmail, renderEmail, escapeHtml } from '@/lib/email'
import { createTicketsForRsvp } from '@/lib/tickets'
import { fireWebhooks } from '@/lib/webhook-dispatcher'
import { resolveTemplate } from '@/lib/email-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return bad('Server not configured', 500)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON body') }

  const eventId = (body.event_id || '').toString().trim()
  const tierId = (body.tier_id || '').toString().trim() || null
  const attendeeName = (body.attendee_name || '').toString().trim()
  const attendeeEmail = (body.attendee_email || '').toString().trim()
  const attendeePhone = (body.attendee_phone || '').toString().trim()
  const quantity = Math.max(1, Math.min(20, parseInt(body.quantity || '1', 10) || 1))
  const paymentConfirmation = (body.payment_confirmation || '').toString().trim()
  const notes = (body.notes || '').toString().trim()
  const promoCode = (body.promo_code || '').toString().trim()
  const guestNames: string[] = Array.isArray(body.guest_names) ? body.guest_names.map((n: any) => String(n).trim()).filter(Boolean) : []
  const dietaryNotes = (body.dietary_notes || '').toString().trim()
  const accessibilityNotes = (body.accessibility_notes || '').toString().trim()

  if (!eventId) return bad('Missing event')
  if (!attendeeName) return bad('Please provide your name')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail)) return bad('Please provide a valid email')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch the event + verify RSVP is enabled + not past deadline.
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, title, rsvp_enabled, rsvp_deadline, rsvp_capacity, payment_link, payment_instructions, date, time, venue, city, publisher_name, email_templates')
    .eq('id', eventId)
    .single()
  if (evErr || !event) return bad('Event not found', 404)
  if (!event.rsvp_enabled) return bad('RSVP is not open for this event')
  if (event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date()) {
    return bad('RSVP deadline has passed')
  }

  // Load tier + validate.
  let tier: EventTier | null = null
  if (tierId) {
    const { data: t } = await supabase
      .from('event_tiers')
      .select('*')
      .eq('id', tierId)
      .eq('event_id', eventId)
      .single()
    tier = (t as any) as EventTier
    if (!tier) return bad('Invalid ticket tier')
  } else {
    // If no tier is provided but tiers exist, force user to pick.
    const { data: existing } = await supabase.from('event_tiers').select('id').eq('event_id', eventId).limit(1)
    if (existing?.length) return bad('Please select a ticket tier')
    // No tiers means a free single-tier event — synthesize an implicit tier.
    tier = { id: '', event_id: eventId, name: 'General', price: 0, capacity: null, sort_order: 0 }
  }

  const isPaid = Number(tier.price) > 0
  if (isPaid && !paymentConfirmation) {
    return bad('Please enter your payment confirmation number after paying at the link.')
  }

  // Current occupancy — for waitlist decision.
  const { data: rsvps } = await supabase
    .from('event_rsvps')
    .select('*')
    .eq('event_id', eventId)
  const currentTierTaken = ((rsvps as EventRsvp[] | null) || [])
    .filter((r) => r.tier_id === tier!.id && (r.status === 'confirmed' || r.status === 'attended' || r.status === 'pending'))
    .reduce((sum, r) => sum + r.quantity, 0)
  const currentEventTaken = ((rsvps as EventRsvp[] | null) || [])
    .filter((r) => r.status === 'confirmed' || r.status === 'attended' || r.status === 'pending')
    .reduce((sum, r) => sum + r.quantity, 0)

  const status = decideRsvpStatus({
    tier,
    quantity,
    paymentConfirmation,
    eventCapacity: event.rsvp_capacity,
    currentTierTaken,
    currentEventTaken,
  })

  const confirmationCode = generateConfirmationCode()

  // Build attendee details JSON (guest names, dietary, accessibility)
  const attendeeDetails: Record<string, any> = {}
  if (guestNames.length > 0) attendeeDetails.guest_names = guestNames.slice(0, 19)
  if (dietaryNotes) attendeeDetails.dietary = dietaryNotes.substring(0, 500)
  if (accessibilityNotes) attendeeDetails.accessibility = accessibilityNotes.substring(0, 500)

  const { data: insertedRsvp, error: insErr } = await supabase.from('event_rsvps').insert({
    event_id: eventId,
    tier_id: tier.id || null,
    attendee_name: attendeeName.substring(0, 200),
    attendee_email: attendeeEmail.substring(0, 200),
    attendee_phone: attendeePhone.substring(0, 40),
    quantity,
    payment_confirmation: paymentConfirmation.substring(0, 200),
    status,
    notes: notes.substring(0, 2000),
    confirmation_code: confirmationCode,
    ...(Object.keys(attendeeDetails).length > 0 ? { attendee_details: attendeeDetails } : {}),
  }).select('id, confirmation_code, status').single()
  if (insErr || !insertedRsvp) return bad(`RSVP failed: ${insErr?.message || 'unknown'}`, 500)

  // Increment promo code used_count if a promo code was applied
  if (promoCode) {
    const { data: promo } = await supabase
      .from('promo_codes')
      .select('id, used_count')
      .eq('code', promoCode)
      .eq('event_id', eventId)
      .single()
    if (promo) {
      // Check if this email has already used this promo code
      const { data: existingPromoUse } = await supabase
        .from('event_rsvps')
        .select('id')
        .eq('event_id', eventId)
        .eq('attendee_email', attendeeEmail)
        .eq('promo_code_id', promo.id)
        .neq('id', insertedRsvp.id) // exclude the one we just inserted
        .limit(1)
      if (existingPromoUse?.length) {
        // Roll back the RSVP we just inserted
        await supabase.from('event_rsvps').delete().eq('id', insertedRsvp.id)
        return bad('You have already used this promo code')
      }
      // Store promo_code_id on the RSVP for future duplicate checks
      await supabase.from('event_rsvps').update({ promo_code_id: promo.id }).eq('id', insertedRsvp.id)
      await supabase
        .from('promo_codes')
        .update({ used_count: (promo.used_count || 0) + 1 })
        .eq('id', promo.id)
    }
  }

  // Auto-generate tickets for confirmed RSVPs
  let ticketNumbers: string[] = []
  if (status === 'confirmed') {
    const ticketRows = await createTicketsForRsvp(supabase, {
      eventId,
      rsvpId: insertedRsvp.id,
      tierId: tier.id || null,
      holderName: attendeeName,
      holderEmail: attendeeEmail,
      quantity,
      eventTitle: event.title,
      eventDate: event.date,
      eventVenue: event.publisher_name || '',
      guestNames,
    })
    ticketNumbers = ticketRows.map(t => t.ticket_number)
  }

  // Confirmation email for non-confirmed statuses (confirmed already gets ticket email above).
  if (status !== 'confirmed') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'
    const templateVars = {
      event_title: event.title,
      event_date: event.date,
      event_time: event.time || '',
      venue: event.venue || '',
      city: event.city || '',
      attendee_name: attendeeName.split(' ')[0] || attendeeName,
      ticket_number: '',
      confirmation_code: confirmationCode,
      ticket_url: '',
    }
    const customSubject = resolveTemplate(event.email_templates, 'confirmation_subject', templateVars)
    const customBody = resolveTemplate(event.email_templates, 'confirmation_body', templateVars)

    const statusLine = {
      confirmed: '<strong>Confirmed.</strong> You\'re on the list.',
      pending:   '<strong>Pending.</strong> We received your RSVP but still need your payment confirmation. Reply to this email once paid.',
      waitlist:  '<strong>Waitlist.</strong> The event or your chosen tier is full — we\'ll notify you if a spot opens.',
      cancelled: '<strong>Cancelled.</strong>',
      attended:  '<strong>Checked in.</strong>',
    }[status]
    const html = renderEmail('Your RSVP', `
      <p>${escapeHtml(customBody).replace(/\n/g, '<br/>')}</p>
      <p>${statusLine}</p>
      <p>Tier: ${escapeHtml(tier.name)} × ${quantity}${tier.price > 0 ? ` — $${(tier.price * quantity).toFixed(2)}` : ''}</p>
      <p style="background:#F1F5F9;padding:12px 16px;border-radius:10px;font-family:ui-monospace,monospace;font-size:16px;letter-spacing:0.08em;text-align:center;">
        Confirmation code: <strong>${confirmationCode}</strong>
      </p>
      <p>Show this code at the door.</p>
    `)
    sendEmail({
      to: attendeeEmail,
      subject: customSubject,
      html,
    }).catch(() => { /* swallow */ })
  }

  // Fire webhooks (non-blocking)
  fireWebhooks(eventId, 'rsvp.created', {
    rsvp_id: insertedRsvp.id,
    confirmation_code: confirmationCode,
    attendee_name: attendeeName,
    attendee_email: attendeeEmail,
    tier_name: tier.name,
    quantity,
    status,
  }).catch(() => {})

  if (status === 'confirmed') {
    fireWebhooks(eventId, 'ticket.created', {
      rsvp_id: insertedRsvp.id,
      holder_name: attendeeName,
      holder_email: attendeeEmail,
      tier_name: tier.name,
      quantity,
    }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    confirmation_code: confirmationCode,
    status,
    ticket_numbers: ticketNumbers,
  })
}
