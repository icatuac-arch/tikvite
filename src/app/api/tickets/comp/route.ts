/**
 * Issue comp tickets — POST /api/tickets/comp
 * Body: { event_id, holder_name, holder_email, quantity, reason }
 * Creates RSVP + tickets without payment. Publisher/admin only.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateConfirmationCode } from '@/lib/rsvp'
import { generateTicketNumber, generateQrToken } from '@/lib/tickets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return json({ ok: false, error: 'Invalid JSON' }, 400) }

  const eventId = (body.event_id || '').toString().trim()
  const holderName = (body.holder_name || '').toString().trim()
  const holderEmail = (body.holder_email || '').toString().trim()
  const quantity = parseInt(body.quantity, 10) || 1
  const reason = (body.reason || 'VIP').toString().trim()
  const tierId = (body.tier_id || '').toString().trim() || null

  if (!eventId || !holderName || !holderEmail) {
    return json({ ok: false, error: 'Missing required fields: event_id, holder_name, holder_email' }, 400)
  }
  if (quantity < 1 || quantity > 20) {
    return json({ ok: false, error: 'Quantity must be 1-20' }, 400)
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Auth check — publisher must own event or be admin
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return json({ ok: false, error: 'Not authenticated' }, 401)

  const { data: event } = await service
    .from('events')
    .select('id, title, date, venue, address, city, state, publisher_id')
    .eq('id', eventId)
    .single()
  if (!event) return json({ ok: false, error: 'Event not found' }, 404)

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return json({ ok: false, error: 'Not authorized' }, 403)
  }

  // Create a comp RSVP
  const confirmCode = generateConfirmationCode()
  const { data: rsvp, error: rsvpErr } = await service
    .from('event_rsvps')
    .insert({
      event_id: eventId,
      tier_id: tierId,
      attendee_name: holderName,
      attendee_email: holderEmail,
      attendee_phone: '',
      quantity,
      payment_confirmation: `COMP-${reason}`,
      status: 'confirmed',
      notes: `Comp ticket: ${reason}`,
      confirmation_code: confirmCode,
    })
    .select('id')
    .single()

  if (rsvpErr || !rsvp) {
    return json({ ok: false, error: rsvpErr?.message || 'Failed to create RSVP' }, 500)
  }

  // Create comp tickets
  const ticketRows: any[] = []
  for (let i = 0; i < quantity; i++) {
    ticketRows.push({
      event_id: eventId,
      rsvp_id: rsvp.id,
      tier_id: tierId,
      holder_name: holderName,
      holder_email: holderEmail,
      ticket_number: generateTicketNumber(),
      qr_token: generateQrToken(),
      status: 'active',
      is_comp: true,
      comp_reason: reason,
    })
  }

  const { data: insertedTickets, error: ticketErr } = await service
    .from('tickets')
    .insert(ticketRows)
    .select('ticket_number, qr_token')

  if (ticketErr) {
    return json({ ok: false, error: ticketErr.message }, 500)
  }

  return json({
    ok: true,
    rsvp_id: rsvp.id,
    confirmation_code: confirmCode,
    tickets: (insertedTickets || []).map((t: any) => ({
      ticket_number: t.ticket_number,
    })),
    quantity,
    reason,
  })
}
