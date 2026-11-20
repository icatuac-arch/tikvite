/**
 * POST   /api/organizer/[slug]/follow — follow organizer
 * DELETE /api/organizer/[slug]/follow — unfollow organizer
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOrganizer(supabase: SupabaseClient<any>, slug: string) {
  const { data } = await supabase
    .from('organizer_profiles')
    .select('id, followers_count')
    .eq('slug', slug)
    .maybeSingle()
  return data as { id: string; followers_count: number } | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { slug } = params
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const followerEmail = (body?.follower_email || '').toString().trim().toLowerCase()
  const followerName = (body?.follower_name || '').toString().trim()
  const notifyNewEvents = body?.notify_new_events !== false

  if (!followerEmail) return bad('follower_email is required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(followerEmail)) return bad('Invalid email')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const organizer = await resolveOrganizer(supabase, slug)
  if (!organizer) return bad('Organizer not found', 404)

  // Upsert follower row
  const { error } = await supabase
    .from('organizer_followers')
    .upsert(
      {
        organizer_id: organizer.id,
        follower_email: followerEmail,
        follower_name: followerName,
        notify_new_events: notifyNewEvents,
      },
      { onConflict: 'organizer_id,follower_email' },
    )

  if (error) return bad('Failed to follow', 500)

  // Update followers_count
  const { count } = await supabase
    .from('organizer_followers')
    .select('id', { count: 'exact', head: true })
    .eq('organizer_id', organizer.id)

  await supabase
    .from('organizer_profiles')
    .update({ followers_count: count ?? organizer.followers_count + 1 })
    .eq('id', organizer.id)

  return NextResponse.json({ ok: true, following: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { slug } = params
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const followerEmail = (body?.follower_email || '').toString().trim().toLowerCase()
  if (!followerEmail) return bad('follower_email is required')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const organizer = await resolveOrganizer(supabase, slug)
  if (!organizer) return bad('Organizer not found', 404)

  const { error } = await supabase
    .from('organizer_followers')
    .delete()
    .eq('organizer_id', organizer.id)
    .eq('follower_email', followerEmail)

  if (error) return bad('Failed to unfollow', 500)

  // Update followers_count
  const { count } = await supabase
    .from('organizer_followers')
    .select('id', { count: 'exact', head: true })
    .eq('organizer_id', organizer.id)

  await supabase
    .from('organizer_profiles')
    .update({ followers_count: count ?? Math.max(0, organizer.followers_count - 1) })
    .eq('id', organizer.id)

  return NextResponse.json({ ok: true, following: false })
}
