/**
 * Event passes / season passes CRUD.
 * GET: list passes (public or admin)
 * POST: create pass, purchase pass
 * DELETE: deactivate pass
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

async function requireAdmin(): Promise<{ error: string; status: number } | { service: any; userId: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Not authenticated', status: 401 }
  const service = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin') return { error: 'Admin access required', status: 403 }
  return { service, userId: user.id }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const showAll = url.searchParams.get('all') === '1'
  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  let query = service.from('event_passes').select('*').order('created_at', { ascending: false })
  if (!showAll) query = query.eq('is_active', true)

  const { data: passes } = await query

  // Get holder counts
  const { data: holders } = await service
    .from('pass_holders')
    .select('pass_id, status')

  const countMap: Record<string, { active: number; total: number }> = {}
  for (const h of holders || []) {
    if (!countMap[h.pass_id]) countMap[h.pass_id] = { active: 0, total: 0 }
    countMap[h.pass_id].total++
    if (h.status === 'active') countMap[h.pass_id].active++
  }

  // Fetch event titles for display
  const allEventIds = new Set<string>()
  for (const p of passes || []) {
    for (const eid of p.event_ids || []) allEventIds.add(eid)
  }
  const eventTitles: Record<string, string> = {}
  if (allEventIds.size > 0) {
    const { data: events } = await service
      .from('events')
      .select('id, title')
      .in('id', Array.from(allEventIds))
    for (const e of events || []) eventTitles[e.id] = e.title
  }

  const enriched = (passes || []).map((p: any) => ({
    ...p,
    holder_count: countMap[p.id]?.active || 0,
    total_holders: countMap[p.id]?.total || 0,
    event_titles: (p.event_ids || []).map((eid: string) => eventTitles[eid] || eid),
  }))

  return NextResponse.json({ ok: true, passes: enriched })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const action = body.action || 'create_pass'

  if (action === 'create_pass' || action === 'update_pass') {
    const auth = await requireAdmin()
    if ('error' in auth) return bad(auth.error, auth.status)

    const name = (body.name || '').toString().trim()
    if (!name) return bad('Name is required')
    const price = Math.max(0, Number(body.price) || 0)
    const description = (body.description || '').toString().trim()
    const eventIds = body.event_ids || []
    if (!eventIds.length) return bad('At least one event is required')
    const maxSold = body.max_sold ? Math.max(1, parseInt(body.max_sold, 10)) : null
    const validFrom = body.valid_from || null
    const validUntil = body.valid_until || null

    if (body.id) {
      const { data, error } = await auth.service
        .from('event_passes')
        .update({ name, price, description, event_ids: eventIds, max_sold: maxSold, valid_from: validFrom, valid_until: validUntil })
        .eq('id', body.id)
        .select()
        .single()
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true, pass: data })
    } else {
      const { data, error } = await auth.service
        .from('event_passes')
        .insert({ name, price, description, event_ids: eventIds, max_sold: maxSold, valid_from: validFrom, valid_until: validUntil })
        .select()
        .single()
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true, pass: data })
    }
  }

  if (action === 'purchase_pass') {
    const passId = body.pass_id
    const holderName = (body.holder_name || '').toString().trim()
    const holderEmail = (body.holder_email || '').toString().trim().toLowerCase()
    if (!passId || !holderName || !holderEmail) return bad('Missing pass_id, holder_name, or holder_email')

    const service = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Validate pass
    const { data: pass } = await service
      .from('event_passes')
      .select('*')
      .eq('id', passId)
      .eq('is_active', true)
      .single()
    if (!pass) return bad('Pass not found or inactive')

    // Check sold limit
    if (pass.max_sold && pass.sold_count >= pass.max_sold) {
      return bad('This pass is sold out')
    }

    // Check date range
    const now = new Date()
    if (pass.valid_from && new Date(pass.valid_from) > now) return bad('This pass is not yet available')
    if (pass.valid_until && new Date(pass.valid_until) < now) return bad('This pass has expired')

    // Create holder
    const { data: holder, error } = await service
      .from('pass_holders')
      .insert({ pass_id: passId, holder_name: holderName, holder_email: holderEmail })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return bad('You already have this pass')
      return bad(error.message, 500)
    }

    // Increment sold_count
    await service
      .from('event_passes')
      .update({ sold_count: (pass.sold_count || 0) + 1 })
      .eq('id', passId)

    return NextResponse.json({ ok: true, holder })
  }

  if (action === 'list_holders') {
    const auth = await requireAdmin()
    if ('error' in auth) return bad(auth.error, auth.status)
    const passId = body.pass_id
    if (!passId) return bad('Missing pass_id')
    const { data } = await auth.service
      .from('pass_holders')
      .select('*')
      .eq('pass_id', passId)
      .order('purchased_at', { ascending: false })
    return NextResponse.json({ ok: true, holders: data || [] })
  }

  return bad('Unknown action')
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return bad('Missing id')

  const auth = await requireAdmin()
  if ('error' in auth) return bad(auth.error, auth.status)

  const { error } = await auth.service
    .from('event_passes')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true })
}
