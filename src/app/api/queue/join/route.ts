/**
 * POST /api/queue/join — Join the virtual waiting room for a high-demand event.
 * Body: { event_id, session_token, email? }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return bad('Server not configured', 500)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const eventId = (body.event_id || '').toString().trim()
  const sessionToken = (body.session_token || '').toString().trim()
  const email = (body.email || '').toString().trim() || null

  if (!eventId) return bad('Missing event_id')
  if (!sessionToken) return bad('Missing session_token')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify event exists and has queue enabled
  const { data: event } = await supabase
    .from('events')
    .select('id, queue_enabled')
    .eq('id', eventId)
    .single()

  if (!event) return bad('Event not found', 404)
  if (!event.queue_enabled) return bad('Queue is not enabled for this event')

  // Check if already in queue
  const { data: existing } = await supabase
    .from('event_queue')
    .select('id, position, status')
    .eq('event_id', eventId)
    .eq('session_token', sessionToken)
    .single()

  if (existing) {
    return NextResponse.json({
      ok: true,
      position: existing.position,
      status: existing.status,
      already_joined: true,
    })
  }

  // Get the next position number
  const { data: maxPos } = await supabase
    .from('event_queue')
    .select('position')
    .eq('event_id', eventId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxPos?.position || 0) + 1

  const { data: entry, error } = await supabase
    .from('event_queue')
    .insert({
      event_id: eventId,
      session_token: sessionToken,
      email,
      position: nextPosition,
      status: 'waiting',
    })
    .select('id, position, status')
    .single()

  if (error) return bad(error.message, 500)

  return NextResponse.json({
    ok: true,
    position: entry!.position,
    status: entry!.status,
    already_joined: false,
  })
}
