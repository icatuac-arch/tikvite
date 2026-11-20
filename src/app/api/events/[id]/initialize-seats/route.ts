/**
 * POST /api/events/[id]/initialize-seats
 *
 * Creates session_seat rows for every layout_seat in the event's layout.
 * Idempotent: skips if session_seats already exist for this event.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authSupabase = createServerSupabaseClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user) return bad('Unauthorized', 401)

  const eventId = params.id
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch event to get layout_id
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, layout_id, seating_mode')
    .eq('id', eventId)
    .single()

  if (evErr || !event) return bad('Event not found', 404)
  if (!event.layout_id) return bad('Event has no layout assigned')
  if (event.seating_mode !== 'reserved') return bad('Event is not reserved seating')

  // Check idempotency — skip if seats already initialized
  const { count } = await supabase
    .from('session_seats')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (count && count > 0) {
    return NextResponse.json({ ok: true, message: 'Already initialized', count })
  }

  // Fetch all layout seats
  const { data: layoutSeats, error: lsErr } = await supabase
    .from('layout_seats')
    .select('id, seat_type')
    .eq('layout_id', event.layout_id)

  if (lsErr) return bad(`Failed to fetch layout seats: ${lsErr.message}`, 500)
  if (!layoutSeats || layoutSeats.length === 0) {
    return bad('Layout has no seats defined')
  }

  // Build session_seat rows
  const rows = layoutSeats.map((seat: any) => ({
    event_id: eventId,
    seat_id: seat.id,
    layout_id: event.layout_id,
    status: seat.seat_type === 'blocked' ? 'blocked' : 'available',
  }))

  // Insert in batches
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error: insErr } = await supabase.from('session_seats').insert(batch)
    if (insErr) return bad(`Insert failed: ${insErr.message}`, 500)
    inserted += batch.length
  }

  return NextResponse.json({ ok: true, initialized: inserted })
}
