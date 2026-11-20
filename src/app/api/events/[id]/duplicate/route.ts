import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

  // Fetch tiers
  const { data: tiers } = await service
    .from('event_tiers')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true })

  // Build new event data — copy relevant fields, reset others
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
    title: `${event.title} (Copy)`,
    status: 'draft',
    date: null,
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
    return NextResponse.json(
      { ok: false, message: insertErr?.message || 'Failed to duplicate event' },
      { status: 500 }
    )
  }

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

  return NextResponse.json({ ok: true, newEventId: inserted.id })
}
