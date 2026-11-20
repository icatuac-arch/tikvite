/**
 * GET /api/queue/status?event_id=...&session_token=...
 * Returns current queue position, status, and whether admitted.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  const url = new URL(request.url)
  const eventId = url.searchParams.get('event_id') || ''
  const sessionToken = url.searchParams.get('session_token') || ''

  if (!eventId || !sessionToken) {
    return NextResponse.json({ ok: false, error: 'Missing event_id or session_token' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Get this user's queue entry
  const { data: entry } = await supabase
    .from('event_queue')
    .select('id, position, status, admitted_at, expires_at')
    .eq('event_id', eventId)
    .eq('session_token', sessionToken)
    .single()

  if (!entry) {
    return NextResponse.json({ ok: false, error: 'Not in queue', in_queue: false }, { status: 404 })
  }

  // Check if admission has expired
  if (entry.status === 'admitted' && entry.expires_at) {
    if (new Date(entry.expires_at) < new Date()) {
      await supabase
        .from('event_queue')
        .update({ status: 'expired' })
        .eq('id', entry.id)
      entry.status = 'expired'
    }
  }

  // Count how many people are ahead (waiting with lower position)
  const { count: aheadCount } = await supabase
    .from('event_queue')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'waiting')
    .lt('position', entry.position)

  // Count total waiting
  const { count: totalWaiting } = await supabase
    .from('event_queue')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'waiting')

  // Estimate wait time: ~2 minutes per batch of 50
  const estimatedMinutes = Math.max(1, Math.ceil((aheadCount || 0) / 50) * 2)

  return NextResponse.json({
    ok: true,
    in_queue: true,
    position: entry.position,
    ahead: aheadCount || 0,
    total_waiting: totalWaiting || 0,
    status: entry.status,
    admitted_at: entry.admitted_at,
    expires_at: entry.expires_at,
    estimated_wait_minutes: entry.status === 'waiting' ? estimatedMinutes : 0,
  })
}
