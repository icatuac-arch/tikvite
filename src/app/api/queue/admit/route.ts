/**
 * POST /api/queue/admit — Admin batch-admits the next N users from the queue.
 * Body: { event_id, count? } — count defaults to event's queue_admit_batch_size.
 * Requires authenticated publisher or admin.
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

const ADMIT_WINDOW_MINUTES = 15 // admitted users have 15 min to complete

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(request: Request) {
  // Auth check
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: userWrap } = await authed.auth.getUser()
  const user = userWrap?.user
  if (!user) return bad('Not authenticated', 401)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const eventId = (body.event_id || '').toString().trim()
  if (!eventId) return bad('Missing event_id')

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify event ownership
  const { data: event } = await service
    .from('events')
    .select('id, publisher_id, queue_enabled, queue_admit_batch_size')
    .eq('id', eventId)
    .single()

  if (!event) return bad('Event not found', 404)
  if (!event.queue_enabled) return bad('Queue is not enabled for this event')

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return bad('Not authorized', 403)
  }

  const batchSize = body.count || event.queue_admit_batch_size || 50

  // Get next batch of waiting users ordered by position
  const { data: toAdmit } = await service
    .from('event_queue')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .limit(batchSize)

  if (!toAdmit?.length) {
    return NextResponse.json({ ok: true, admitted: 0, message: 'No users waiting in queue' })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + ADMIT_WINDOW_MINUTES * 60 * 1000).toISOString()

  const ids = toAdmit.map((e) => e.id)

  const { error } = await service
    .from('event_queue')
    .update({
      status: 'admitted',
      admitted_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .in('id', ids)

  if (error) return bad(error.message, 500)

  return NextResponse.json({
    ok: true,
    admitted: ids.length,
    expires_at: expiresAt,
  })
}
