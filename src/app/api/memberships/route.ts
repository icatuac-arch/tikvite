/**
 * Membership CRUD — admin-only.
 * GET: list all memberships (+ subscriber counts)
 * POST: create or update a membership
 * DELETE: deactivate a membership
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

async function requireAdmin(): Promise<{ error: string; status: number } | { service: any; userId: string }> {
  const cookieStore = await cookies()
  const authed = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data } = await authed.auth.getUser()
  const user = data?.user
  if (!user) return { error: 'Not authenticated', status: 401 }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin') return { error: 'Admin access required', status: 403 }

  return { service, userId: user.id }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return bad(auth.error, auth.status)

  const { data: memberships } = await auth.service
    .from('memberships')
    .select('*')
    .order('created_at', { ascending: true })

  // Get subscriber counts per membership
  const { data: subs } = await auth.service
    .from('member_subscriptions')
    .select('membership_id, status')

  const countMap: Record<string, { active: number; total: number }> = {}
  for (const s of subs || []) {
    if (!countMap[s.membership_id]) countMap[s.membership_id] = { active: 0, total: 0 }
    countMap[s.membership_id].total++
    if (s.status === 'active') countMap[s.membership_id].active++
  }

  const enriched = (memberships || []).map((m: any) => ({
    ...m,
    subscriber_count: countMap[m.id]?.active || 0,
    total_subscribers: countMap[m.id]?.total || 0,
  }))

  return NextResponse.json({ ok: true, memberships: enriched })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const auth = await requireAdmin()
  if ('error' in auth) return bad(auth.error, auth.status)

  const action = body.action || 'upsert_membership'

  if (action === 'upsert_membership') {
    const name = (body.name || '').toString().trim()
    if (!name) return bad('Name is required')
    const price = Math.max(0, Number(body.price) || 0)
    const description = (body.description || '').toString().trim()
    const benefits = body.benefits || {}
    const maxMembers = body.max_members ? Math.max(1, parseInt(body.max_members, 10)) : null
    const isActive = body.is_active !== false

    if (body.id) {
      const { data, error } = await auth.service
        .from('memberships')
        .update({ name, price, description, benefits, max_members: maxMembers, is_active: isActive })
        .eq('id', body.id)
        .select()
        .single()
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true, membership: data })
    } else {
      const { data, error } = await auth.service
        .from('memberships')
        .insert({ name, price, description, benefits, max_members: maxMembers, is_active: isActive })
        .select()
        .single()
      if (error) return bad(error.message, 500)
      return NextResponse.json({ ok: true, membership: data })
    }
  }

  if (action === 'add_subscriber') {
    const membershipId = body.membership_id
    const email = (body.user_email || '').toString().trim().toLowerCase()
    const userName = (body.user_name || '').toString().trim()
    if (!membershipId || !email || !userName) return bad('Missing membership_id, user_email, or user_name')

    const expiresAt = body.expires_at || null
    const { data, error } = await auth.service
      .from('member_subscriptions')
      .upsert({
        membership_id: membershipId,
        user_email: email,
        user_name: userName,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: 'membership_id,user_email' })
      .select()
      .single()
    if (error) return bad(error.message, 500)
    return NextResponse.json({ ok: true, subscription: data })
  }

  if (action === 'update_subscriber') {
    const subId = body.subscription_id
    const status = body.status
    if (!subId || !status) return bad('Missing subscription_id or status')
    const { error } = await auth.service
      .from('member_subscriptions')
      .update({ status })
      .eq('id', subId)
    if (error) return bad(error.message, 500)
    return NextResponse.json({ ok: true })
  }

  if (action === 'list_subscribers') {
    const membershipId = body.membership_id
    if (!membershipId) return bad('Missing membership_id')
    const { data } = await auth.service
      .from('member_subscriptions')
      .select('*')
      .eq('membership_id', membershipId)
      .order('created_at', { ascending: false })
    return NextResponse.json({ ok: true, subscribers: data || [] })
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
    .from('memberships')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return bad(error.message, 500)
  return NextResponse.json({ ok: true })
}
