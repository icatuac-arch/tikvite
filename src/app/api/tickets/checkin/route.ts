/**
 * Ticket check-in API — publisher-authenticated endpoint.
 * POST { qr_token, checked_in_by?, gate? }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { fireWebhooks } from '@/lib/webhook-dispatcher'

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

  const qrToken = (body.qr_token || '').toString().trim()
  const checkedInBy = (body.checked_in_by || '').toString().trim()
  const gate = (body.gate || '').toString().trim()
  const eventIdFromBody = (body.event_id || '').toString().trim()

  if (!qrToken) return json({ ok: false, error: 'Missing qr_token' }, 400)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch ticket
  const { data: ticket, error: ticketErr } = await service
    .from('tickets')
    .select('id, event_id, status, checked_in_at, checked_in_by, gate')
    .eq('qr_token', qrToken)
    .single()

  if (ticketErr || !ticket) {
    return json({ ok: false, error: 'Ticket not found' }, 404)
  }

  // Verify the ticket belongs to the event being checked into
  if (eventIdFromBody && ticket.event_id !== eventIdFromBody) {
    return json({ ok: false, error: 'Ticket does not belong to this event' }, 400)
  }

  // Auth: publisher must own the event or be admin
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return json({ ok: false, error: 'Not authenticated' }, 401)

  const { data: event } = await service
    .from('events')
    .select('id, publisher_id')
    .eq('id', ticket.event_id)
    .single()
  if (!event) return json({ ok: false, error: 'Event not found' }, 404)

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return json({ ok: false, error: 'Not authorized' }, 403)
  }

  // Handle based on current status
  if (ticket.status === 'active') {
    const now = new Date().toISOString()
    const { error: updateErr } = await service
      .from('tickets')
      .update({
        status: 'used',
        checked_in_at: now,
        checked_in_by: checkedInBy || user.email || user.id,
        gate: gate || null,
        updated_at: now,
      })
      .eq('id', ticket.id)

    if (updateErr) return json({ ok: false, error: updateErr.message }, 500)

    // Fire webhook (non-blocking)
    fireWebhooks(ticket.event_id, 'ticket.checked_in', {
      ticket_id: ticket.id,
      checked_in_at: now,
      checked_in_by: checkedInBy || user.email || user.id,
      gate: gate || null,
    }).catch(() => {})

    return json({ ok: true, checked_in_at: now })
  }

  if (ticket.status === 'used') {
    return json({ ok: true, already_checked_in: true, checked_in_at: ticket.checked_in_at, checked_in_by: ticket.checked_in_by, gate: ticket.gate })
  }

  // cancelled or revoked
  return json({ ok: false, error: 'ticket_invalid' })
}
