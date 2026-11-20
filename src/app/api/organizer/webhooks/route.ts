/**
 * Organizer webhook management — CRUD.
 * GET  /api/organizer/webhooks?event_id=...  — list webhooks + recent deliveries
 * POST /api/organizer/webhooks              — create a webhook
 * DELETE /api/organizer/webhooks?id=...     — delete a webhook
 *
 * All endpoints require authenticated publisher who owns the event.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

async function getUser() {
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: userWrap } = await authed.auth.getUser()
  return userWrap?.user || null
}

async function verifyOwnership(service: any, userId: string, eventId: string): Promise<boolean> {
  const { data: event } = await service
    .from('events')
    .select('publisher_id')
    .eq('id', eventId)
    .single()
  if (!event) return false
  if (event.publisher_id === userId) return true
  const { data: prof } = await service.from('profiles').select('role').eq('id', userId).single()
  return prof?.role === 'admin'
}

// GET — list webhooks for an event
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return bad('Not authenticated', 401)

  const url = new URL(request.url)
  const eventId = url.searchParams.get('event_id')
  if (!eventId) return bad('Missing event_id')

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)
  if (!(await verifyOwnership(service, user.id, eventId))) return bad('Not authorized', 403)

  const { data: webhooks } = await service
    .from('organizer_webhooks')
    .select('id, url, events, is_active, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  // Get recent deliveries for all webhooks
  const webhookIds = (webhooks || []).map((w: any) => w.id)
  let deliveries: any[] = []
  if (webhookIds.length) {
    const { data } = await service
      .from('webhook_deliveries')
      .select('id, webhook_id, event_type, response_status, success, delivered_at')
      .in('webhook_id', webhookIds)
      .order('delivered_at', { ascending: false })
      .limit(50)
    deliveries = data || []
  }

  return NextResponse.json({ ok: true, webhooks: webhooks || [], deliveries })
}

// POST — create a webhook
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return bad('Not authenticated', 401)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const eventId = (body.event_id || '').toString().trim()
  const url = (body.url || '').toString().trim()
  const events: string[] = body.events || []

  if (!eventId) return bad('Missing event_id')
  if (!url) return bad('Missing url')
  try { new URL(url) } catch { return bad('Invalid URL') }
  if (!events.length) return bad('Select at least one event type')

  const validEvents = [
    'ticket.created', 'ticket.checked_in', 'ticket.transferred',
    'ticket.cancelled', 'order.paid', 'rsvp.created', '*',
  ]
  for (const e of events) {
    if (!validEvents.includes(e)) return bad(`Invalid event type: ${e}`)
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)
  if (!(await verifyOwnership(service, user.id, eventId))) return bad('Not authorized', 403)

  const secret = `whsec_${randomBytes(24).toString('base64url')}`

  const { data, error } = await service
    .from('organizer_webhooks')
    .insert({
      event_id: eventId,
      url,
      events,
      secret,
      is_active: true,
    })
    .select('id, url, events, secret, is_active, created_at')
    .single()

  if (error) return bad(error.message, 500)

  return NextResponse.json({ ok: true, webhook: data })
}

// DELETE — remove a webhook
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return bad('Not authenticated', 401)

  const url = new URL(request.url)
  const webhookId = url.searchParams.get('id')
  if (!webhookId) return bad('Missing webhook id')

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Get webhook to verify ownership
  const { data: webhook } = await service
    .from('organizer_webhooks')
    .select('id, event_id')
    .eq('id', webhookId)
    .single()

  if (!webhook) return bad('Webhook not found', 404)
  if (!(await verifyOwnership(service, user.id, webhook.event_id))) return bad('Not authorized', 403)

  await service.from('organizer_webhooks').delete().eq('id', webhookId)

  return NextResponse.json({ ok: true })
}
