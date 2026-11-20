/**
 * POST /api/waitlist/claim — Claim a waitlist spot.
 * Validates token, checks expiry, promotes to confirmed, creates tickets.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTicketsForRsvp } from '@/lib/tickets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const token = (body.token || '').toString().trim()
  if (!token) return bad('Missing claim token')

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Find RSVP with this claim token
  const { data: rsvp } = await service
    .from('event_rsvps')
    .select('*')
    .eq('waitlist_claim_token', token)
    .single()

  if (!rsvp) return bad('Invalid or expired claim link', 404)

  // Check expiry
  if (rsvp.waitlist_claim_expires_at && new Date(rsvp.waitlist_claim_expires_at) < new Date()) {
    // Expired — revert to waitlist
    await service.from('event_rsvps').update({ status: 'waitlist', waitlist_claim_token: null, waitlist_claim_expires_at: null }).eq('id', rsvp.id)
    return bad('This claim link has expired. Your spot has been offered to the next person.')
  }

  if (rsvp.status === 'confirmed' || rsvp.status === 'attended') {
    return NextResponse.json({ ok: true, already_claimed: true, message: 'Already confirmed' })
  }

  // Promote to confirmed
  await service.from('event_rsvps').update({
    status: 'confirmed',
    waitlist_claim_token: null,
    waitlist_claim_expires_at: null,
  }).eq('id', rsvp.id)

  // Fetch event for ticket creation
  const { data: event } = await service
    .from('events')
    .select('title, date, publisher_name')
    .eq('id', rsvp.event_id)
    .single()

  // Create tickets
  const ticketRows = await createTicketsForRsvp(service, {
    eventId: rsvp.event_id,
    rsvpId: rsvp.id,
    tierId: rsvp.tier_id,
    holderName: rsvp.attendee_name,
    holderEmail: rsvp.attendee_email,
    quantity: rsvp.quantity,
    eventTitle: event?.title || '',
    eventDate: event?.date || '',
    eventVenue: event?.publisher_name || '',
  })

  return NextResponse.json({
    ok: true,
    claimed: true,
    ticket_numbers: ticketRows.map((t: any) => t.ticket_number),
  })
}
