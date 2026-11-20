import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Verify the caller is an admin via their auth session. */
async function verifyAdmin(): Promise<string | null> {
  const sb = createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? user.id : null
}

/**
 * GET /api/admin/events?type=pending|all|profiles
 * Reads via service role so RLS doesn't filter out pending/rejected rows.
 */
export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type') || 'all'

  if (type === 'pending') {
    const { data, error } = await getSupabaseAdmin()
      .from('events')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true })
      .limit(2000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'all') {
    const { data, error } = await getSupabaseAdmin()
      .from('events')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'profiles') {
    const role = req.nextUrl.searchParams.get('role') // optional filter
    let query = getSupabaseAdmin().from('profiles').select('*').order('joined_at', { ascending: false })
    if (role && role !== 'all') query = query.eq('role', role)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const withCounts = await Promise.all(
      (data || []).map(async (p: any) => {
        const { count } = await getSupabaseAdmin()
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('publisher_id', p.id)
        return { ...p, event_count: count ?? 0 }
      })
    )
    return NextResponse.json(withCounts)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

async function cleanImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return
  const parts = imageUrl.split('/storage/v1/object/public/')
  if (parts.length > 1) {
    const [bucket, ...pathParts] = parts[1].split('/')
    await getSupabaseAdmin().storage.from(bucket).remove([pathParts.join('/')])
  }
}

/**
 * PATCH /api/admin/events
 * Body: { action, id?, ids?, fields?, ... }
 *
 * Uses the service-role key so RLS does not block admin operations.
 */
export async function PATCH(req: NextRequest) {
  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body as { action: string }

  switch (action) {
    // ── Single event status change ──
    case 'set-status': {
      const { id, status } = body
      if (!id || !['rejected', 'published', 'pending'].includes(status)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }
      if (status === 'rejected') {
        const { data: event } = await getSupabaseAdmin().from('events').select('image_url').eq('id', id).single()
        await cleanImage(event?.image_url)
      }
      const patch: Record<string, string> = { status }
      if (status === 'rejected') patch.image_url = ''
      const { data, error } = await getSupabaseAdmin().from('events').update(patch).eq('id', id).select('id')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data?.length) return NextResponse.json({ error: 'No event found' }, { status: 404 })
      return NextResponse.json({ ok: true })
    }

    // ── Bulk status change ──
    case 'bulk-set-status': {
      const { ids, status } = body as { ids: string[]; status: string }
      if (!ids?.length || !['rejected', 'published', 'pending'].includes(status)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }
      if (status === 'rejected') {
        const { data: events } = await getSupabaseAdmin().from('events').select('image_url').in('id', ids)
        for (const e of events || []) await cleanImage(e.image_url)
      }
      const patch: Record<string, string> = { status }
      if (status === 'rejected') patch.image_url = ''
      const { error } = await getSupabaseAdmin().from('events').update(patch).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Delete event(s) ──
    case 'delete': {
      const { ids } = body as { ids: string[] }
      if (!ids?.length) return NextResponse.json({ error: 'No ids' }, { status: 400 })
      const { data: events } = await getSupabaseAdmin().from('events').select('image_url').in('id', ids)
      for (const e of events || []) await cleanImage(e.image_url)
      const { error } = await getSupabaseAdmin().from('events').delete().in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Restore soft-deleted event ──
    case 'restore': {
      const { id } = body as { id: string }
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const { error } = await getSupabaseAdmin()
        .from('events')
        .update({ deleted_at: null })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Edit event fields ──
    case 'edit': {
      const { id, fields } = body as { id: string; fields: Record<string, unknown> }
      if (!id || !fields) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      // Normalize metro_region slug if present
      if (typeof fields.metro_region === 'string') {
        const METRO_SLUG_MAP: Record<string, string> = {
          'bay-area': 'Bay Area', 'new-york': 'New York', 'los-angeles': 'LA', 'los angeles': 'LA',
          'dallas-fort-worth': 'Dallas', 'dallas': 'Dallas', 'washington-dc': 'DC',
          'san-diego': 'San Diego', 'salt-lake-city': 'Salt Lake City',
          'new-jersey': 'NJ', 'research-triangle': 'Raleigh', 'tampa-bay': 'Tampa',
          'seattle': 'Seattle', 'houston': 'Houston', 'phoenix': 'Phoenix',
          'orlando': 'Orlando', 'austin': 'Austin', 'philadelphia': 'Philadelphia',
          'minneapolis': 'Minneapolis', 'atlanta': 'Atlanta', 'sacramento': 'Sacramento',
          'chicago': 'Chicago', 'boston': 'Boston', 'denver': 'Denver', 'tampa': 'Tampa',
          'detroit': 'Detroit', 'charlotte': 'Charlotte', 'nashville': 'Nashville',
          'portland': 'Portland', 'columbus': 'Columbus', 'raleigh': 'Raleigh',
          'miami': 'Miami', 'nj': 'NJ',
        }
        const slug = (fields.metro_region as string).toLowerCase().trim()
        fields.metro_region = METRO_SLUG_MAP[slug] || fields.metro_region
      }
      const { error } = await getSupabaseAdmin().from('events').update(fields).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Suspend/reinstate profile ──
    case 'set-suspended': {
      const { profileId, suspended } = body as { profileId: string; suspended: boolean }
      if (!profileId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      const { error } = await getSupabaseAdmin().from('profiles').update({ suspended }).eq('id', profileId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Change user role ──
    case 'set-role': {
      const { profileId, role } = body as { profileId: string; role: string }
      if (!profileId || !['visitor', 'publisher', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid profileId or role' }, { status: 400 })
      }
      const { error } = await getSupabaseAdmin().from('profiles').update({ role }).eq('id', profileId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Update profile fields ──
    case 'edit-profile': {
      const { profileId, fields } = body as { profileId: string; fields: Record<string, unknown> }
      if (!profileId || !fields) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      // Only allow safe fields
      const allowed = ['name', 'email', 'slug', 'bio'] as const
      const safeFields: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in fields) safeFields[key] = fields[key]
      }
      if (Object.keys(safeFields).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
      const { error } = await getSupabaseAdmin().from('profiles').update(safeFields).eq('id', profileId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Directory listing status ──
    case 'directory-set-status': {
      const { id, ids, table, status } = body as { id?: string; ids?: string[]; table: string; status: string }
      if (!['directory_listings', 'directory_reviews'].includes(table)) {
        return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
      }
      if (ids?.length) {
        const { error } = await getSupabaseAdmin().from(table).update({ status }).in('id', ids)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else if (id) {
        const { error } = await getSupabaseAdmin().from(table).update({ status }).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        return NextResponse.json({ error: 'No id or ids' }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
