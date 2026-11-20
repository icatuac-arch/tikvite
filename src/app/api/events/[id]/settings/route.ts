import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ALLOWED_FIELDS = new Set([
  'title', 'description', 'date', 'time', 'venue', 'address',
  'city', 'state', 'metro_region', 'ticket_url', 'image_url',
  'category', 'publisher_name', 'zip_code', 'price', 'email_templates',
])

export async function PATCH(
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
  const { data: event } = await service.from('events').select('publisher_id').eq('id', id).maybeSingle()
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

  // Filter to allowed fields only
  const updates: Record<string, any> = {}
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key) && value !== undefined) {
      updates[key] = typeof value === 'string' ? value.trim() : value
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, message: 'No valid fields to update' }, { status: 400 })
  }

  const { data: updated, error } = await service
    .from('events')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, event: updated })
}
