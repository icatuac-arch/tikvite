/**
 * Ticket Exchange API — POST /api/tickets/exchange
 * Body: { ticket_number, new_tier_id?, new_event_id? }
 * Cancels old ticket and creates new one for different tier/event.
 * Organizer/admin only.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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

  const ticketNumber = (body.ticket_number || '').toString().trim()
  const newTierId = (body.new_tier_id || '').toString().trim() || null
  const newEventId = (body.new_event_id || '').toString().trim() || null

  if (!ticketNumber) {
    return json({ ok: false, error: 'Missing ticket_number' }, 400)
  }
  if (!newTierId && !newEventId) {
    return json({ ok: false, error: 'Must provide new_tier_id or new_event_id' }, 400)
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Auth check — must be publisher/admin
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return json({ ok: false, error: 'Not authenticated' }, 401)

  // Fetch old ticket
  const { data: oldTicket, error: ticketErr } = await service
    .from('tickets')
    .select('*')
    .eq('ticket_number', ticketNumber)
    .single()

  if (ticketErr || !oldTicket) {
    return json({ ok: false, error: 'Ticket not found' }, 404)
  }

  if (oldTicket.status !== 'active') {
    return json({ ok: false, error: `Cannot exchange ticket with status "${oldTicket.status}"` }, 400)
  }

  // Auth: publisher must own the event
  const { data: event } = await service
    .from('events')
    .select('id, publisher_id')
    .eq('id', oldTicket.event_id)
    .single()
  if (!event) return json({ ok: false, error: 'Event not found' }, 404)

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return json({ ok: false, error: 'Not authorized' }, 403)
  }

  // Determine new event/tier
  const targetEventId = newEventId || oldTicket.event_id
  const targetTierId = newTierId || oldTicket.tier_id

  // If changing event, verify it exists AND the publisher owns it
  if (newEventId) {
    const { data: newEvent } = await service.from('events').select('id, publisher_id').eq('id', newEventId).single()
    if (!newEvent) return json({ ok: false, error: 'Target event not found' }, 404)
    if (newEvent.publisher_id !== user.id) {
      const { data: profCheck } = await service.from('profiles').select('role').eq('id', user.id).single()
      if (profCheck?.role !== 'admin') {
        return json({ ok: false, error: 'Not authorized to exchange tickets to an event you do not own' }, 403)
      }
    }
  }

  // If changing tier, verify it exists
  if (newTierId) {
    const { data: newTier } = await service.from('event_tiers').select('id').eq('id', newTierId).single()
    if (!newTier) return json({ ok: false, error: 'Target tier not found' }, 404)
  }

  const now = new Date().toISOString()

  // Cancel old ticket
  const { error: cancelErr } = await service
    .from('tickets')
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', oldTicket.id)

  if (cancelErr) return json({ ok: false, error: cancelErr.message }, 500)

  // Create new ticket
  const newTicketNumber = generateTicketNumber()
  const newQrToken = generateQrToken()

  const { data: newTicket, error: insertErr } = await service
    .from('tickets')
    .insert({
      event_id: targetEventId,
      rsvp_id: oldTicket.rsvp_id,
      tier_id: targetTierId,
      holder_name: oldTicket.holder_name,
      holder_email: oldTicket.holder_email,
      ticket_number: newTicketNumber,
      qr_token: newQrToken,
      status: 'active',
      is_comp: oldTicket.is_comp || false,
      comp_reason: oldTicket.comp_reason || null,
    })
    .select('ticket_number')
    .single()

  if (insertErr || !newTicket) {
    return json({ ok: false, error: insertErr?.message || 'Failed to create new ticket' }, 500)
  }

  return json({
    ok: true,
    old_ticket_number: ticketNumber,
    new_ticket_number: newTicket.ticket_number,
    new_event_id: targetEventId,
    new_tier_id: targetTierId,
  })
}
