import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getEventChecklist } from '@/lib/event-checklist'
import type { Event } from '@/lib/types'
import type { EventTier } from '@/lib/rsvp'

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

  // Fetch event
  const { data: event } = await service.from('events').select('*').eq('id', id).maybeSingle()
  if (!event) {
    return NextResponse.json({ ok: false, message: 'Event not found' }, { status: 404 })
  }

  // Ownership check
  if ((event as any).publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Not authorized' }, { status: 403 })
    }
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action || 'publish'

  if (action === 'unpublish') {
    await service.from('events').update({ status: 'draft' }).eq('id', id)
    return NextResponse.json({ ok: true, status: 'draft' })
  }

  // Publish: check readiness
  const { data: tiers } = await service.from('event_tiers').select('*').eq('event_id', id)
  const checklist = getEventChecklist(event as Event, (tiers as EventTier[]) || [])

  if (!checklist.ready) {
    const incomplete = checklist.items
      .filter(i => i.required && !i.complete)
      .map(i => i.label)
    return NextResponse.json(
      {
        ok: false,
        message: `Event is not ready. Missing: ${incomplete.join(', ')}`,
        incomplete,
      },
      { status: 400 }
    )
  }

  await service.from('events').update({ status: 'published' }).eq('id', id)
  return NextResponse.json({ ok: true, status: 'published' })
}
