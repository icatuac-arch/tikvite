/**
 * POST /api/seats/hold — hold seats for a buyer
 *
 * Body: { event_id, seat_ids: string[], buyer_session: string }
 * Calls the hold_seats RPC for atomic seat locking with a 5-minute hold.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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
  const seatIds: string[] = Array.isArray(body.seat_ids) ? body.seat_ids : []

  if (!eventId) return bad('Missing event_id')
  if (seatIds.length === 0) return bad('No seats selected')
  if (seatIds.length > 20) return bad('Maximum 20 seats per hold')

  // Generate a cryptographically secure session token server-side
  // (ignore any client-provided buyer_session to prevent forgery)
  const buyerSession = crypto.randomUUID()

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data, error } = await supabase.rpc('hold_seats', {
    p_event_id: eventId,
    p_seat_ids: seatIds,
    p_held_by: buyerSession,
    p_hold_minutes: 5,
  })

  if (error) {
    console.error('[hold] RPC error:', error.message)
    return bad(`Hold failed: ${error.message}`, 500)
  }

  const results = data as { seat_id: string; success: boolean }[]
  const allSuccess = results.every((r) => r.success)

  if (!allSuccess) {
    const failed = results.filter((r) => !r.success).map((r) => r.seat_id)
    return NextResponse.json({
      ok: false,
      error: 'Some seats are no longer available',
      conflicting_seat_ids: failed,
    }, { status: 409 })
  }

  const holdExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  return NextResponse.json({
    ok: true,
    held: seatIds.length,
    hold_expires_at: holdExpiry,
    seat_ids: seatIds,
    buyer_session: buyerSession,
  })
}
