import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/events/[id]/recurring — Clone event for multiple dates
 * Body: { frequency: 'weekly' | 'biweekly' | 'monthly', count: number }
 * Creates N copies with incremented dates. Auth: publisher/admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  // Auth
  const authed = createServerSupabaseClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { frequency, count } = body
  if (!['weekly', 'biweekly', 'monthly'].includes(frequency)) {
    return NextResponse.json({ ok: false, message: 'frequency must be weekly, biweekly, or monthly' }, { status: 400 })
  }
  if (!count || typeof count !== 'number' || count < 1 || count > 52) {
    return NextResponse.json({ ok: false, message: 'count must be between 1 and 52' }, { status: 400 })
  }

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch original event
  const { data: event } = await service.from('events').select('*').eq('id', id).maybeSingle()
  if (!event) {
    return NextResponse.json({ ok: false, message: 'Event not found' }, { status: 404 })
  }

  // Ownership check
  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Not authorized' }, { status: 403 })
    }
  }

  if (!event.date) {
    return NextResponse.json({ ok: false, message: 'Original event must have a date set' }, { status: 400 })
  }

  // Fetch tiers
  const { data: tiers } = await service
    .from('event_tiers')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true })

  // Helper: increment date
  function addInterval(dateStr: string, freq: string, n: number): string {
    const d = new Date(dateStr + 'T00:00:00')
    if (freq === 'weekly') {
      d.setDate(d.getDate() + 7 * n)
    } else if (freq === 'biweekly') {
      d.setDate(d.getDate() + 14 * n)
    } else if (freq === 'monthly') {
      d.setMonth(d.getMonth() + n)
    }
    return d.toISOString().split('T')[0]
  }

  const createdIds: string[] = []

  for (let i = 1; i <= count; i++) {
    const newDate = addInterval(event.date, frequency, i)
    const newGuestToken = randomBytes(24).toString('base64url')

    const {
      id: _id,
      submitted_at: _submitted,
      guest_edit_token: _token,
      created_at: _created,
      deleted_at: _deleted,
      reminder_1day_sent: _r1,
      reminder_3hr_sent: _r3,
      reminder_followup_sent: _rf,
      ...rest
    } = event

    const newEvent = {
      ...rest,
      title: `${event.title} (#${i + 1})`,
      status: 'draft',
      date: newDate,
      submitted_at: new Date().toISOString(),
      guest_edit_token: newGuestToken,
      publisher_id: user.id,
    }

    const { data: inserted, error: insertErr } = await service
      .from('events')
      .insert(newEvent)
      .select('id')
      .single()

    if (insertErr || !inserted) {
      continue // skip failed inserts, keep going
    }

    createdIds.push(inserted.id)

    // Copy tiers
    if (tiers && tiers.length > 0) {
      const newTiers = tiers.map((t: any) => ({
        event_id: inserted.id,
        name: t.name,
        price: t.price,
        capacity: t.capacity,
        sort_order: t.sort_order,
        stripe_enabled: t.stripe_enabled || false,
      }))
      await service.from('event_tiers').insert(newTiers)
    }
  }

  return NextResponse.json({
    ok: true,
    created: createdIds.length,
    eventIds: createdIds,
  })
}
