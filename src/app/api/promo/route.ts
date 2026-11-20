/**
 * Promo code CRUD — GET (list), POST (create), DELETE (deactivate).
 * Auth: publisher must own the event, or admin.
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

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

async function getAuthUser() {
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data } = await authed.auth.getUser()
  return data?.user || null
}

async function authorizeEvent(eventId: string): Promise<{ error: string; status: number } | { service: any; userId: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated', status: 401 }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: event } = await service
    .from('events')
    .select('id, publisher_id')
    .eq('id', eventId)
    .single()
  if (!event) return { error: 'Event not found', status: 404 }

  if (event.publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return { error: 'Not authorized', status: 403 }
  }

  return { service, userId: user.id }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const eventId = url.searchParams.get('event_id')
  if (!eventId) return bad('Missing event_id')

  const auth = await authorizeEvent(eventId)
  if ('error' in auth) return bad(auth.error, auth.status)

  const { data } = await auth.service
    .from('promo_codes')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ ok: true, promo_codes: data || [] })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const eventId = body.event_id
  if (!eventId) return bad('Missing event_id')

  const auth = await authorizeEvent(eventId)
  if ('error' in auth) return bad(auth.error, auth.status)

  const code = (body.code || '').toString().toUpperCase().trim()
  if (!code || code.length < 2 || code.length > 30) return bad('Code must be 2-30 characters')

  const discountType = body.discount_type === 'fixed' ? 'fixed' : 'percentage'
  const discountValue = Math.max(0, Number(body.discount_value) || 0)
  if (discountValue <= 0) return bad('Discount value must be > 0')
  if (discountType === 'percentage' && discountValue > 100) return bad('Percentage discount cannot exceed 100')

  const maxUses = body.max_uses ? Math.max(1, parseInt(body.max_uses, 10)) : null
  const validFrom = body.valid_from || null
  const validUntil = body.valid_until || null
  const applicableTiers = body.applicable_tiers?.length ? body.applicable_tiers : null
  const minQuantity = Math.max(1, parseInt(body.min_quantity, 10) || 1)

  const { data, error } = await auth.service.from('promo_codes').insert({
    event_id: eventId,
    code,
    discount_type: discountType,
    discount_value: discountValue,
    max_uses: maxUses,
    valid_from: validFrom,
    valid_until: validUntil,
    applicable_tiers: applicableTiers,
    min_quantity: minQuantity,
  }).select().single()

  if (error) {
    if (error.code === '23505') return bad('A promo code with this name already exists for this event')
    return bad(error.message, 500)
  }

  return NextResponse.json({ ok: true, promo_code: data })
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const promoId = url.searchParams.get('id')
  const eventId = url.searchParams.get('event_id')
  if (!promoId || !eventId) return bad('Missing id or event_id')

  const auth = await authorizeEvent(eventId)
  if ('error' in auth) return bad(auth.error, auth.status)

  const { error } = await auth.service
    .from('promo_codes')
    .update({ is_active: false })
    .eq('id', promoId)
    .eq('event_id', eventId)

  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true })
}
