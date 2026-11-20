/**
 * Event Reminder Opt-in
 * POST: { email } — upserts into event_reminder_optins
 * Public endpoint, no auth needed.
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const email = (body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad('A valid email is required')
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify event exists
  const { data: event } = await supabase
    .from('events')
    .select('id, title, date')
    .eq('id', eventId)
    .single()

  if (!event) return bad('Event not found', 404)

  // Check if event date is in the past
  const eventDate = new Date(event.date + 'T23:59:59')
  if (eventDate < new Date()) {
    return bad('This event has already passed')
  }

  // Upsert into event_reminder_optins
  const { error } = await supabase
    .from('event_reminder_optins')
    .upsert(
      { event_id: eventId, email, created_at: new Date().toISOString() },
      { onConflict: 'event_id,email' },
    )

  if (error) {
    console.error('[remind] upsert error:', error)
    return bad('Could not save reminder', 500)
  }

  return NextResponse.json({ ok: true, message: 'Reminder set successfully' })
}
