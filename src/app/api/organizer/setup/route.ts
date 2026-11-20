/**
 * POST /api/organizer/setup — create or update organizer profile (requires auth)
 * Body: { display_name, slug, bio, avatar_url, cover_image_url, website, instagram, twitter }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function POST(request: NextRequest) {
  // Auth
  const authed = createServerSupabaseClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return bad('Not authenticated', 401)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const displayName = (body?.display_name || '').toString().trim()
  if (!displayName) return bad('display_name is required')

  const rawSlug = (body?.slug || slugify(displayName)).toString().trim()
  const slug = slugify(rawSlug)
  if (!slug) return bad('Could not generate a valid slug from display_name')

  const bio = (body?.bio || '').toString().trim()
  const avatarUrl = (body?.avatar_url || '').toString().trim()
  const coverImageUrl = (body?.cover_image_url || '').toString().trim()
  const website = (body?.website || '').toString().trim()
  const instagram = (body?.instagram || '').toString().trim()
  const twitter = (body?.twitter || '').toString().trim()

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Check slug uniqueness (allow own slug)
  const { data: existing } = await service
    .from('organizer_profiles')
    .select('id, user_id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing && (existing as any).user_id !== user.id) {
    return bad('This slug is already taken. Please choose another.', 409)
  }

  // Check if the user already has a profile
  const { data: ownProfile } = await service
    .from('organizer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const profileData = {
    user_id: user.id,
    slug,
    display_name: displayName,
    bio,
    avatar_url: avatarUrl,
    cover_image_url: coverImageUrl,
    website,
    instagram,
    twitter,
    updated_at: new Date().toISOString(),
  }

  let result: any
  if (ownProfile) {
    const { data, error } = await service
      .from('organizer_profiles')
      .update(profileData)
      .eq('id', (ownProfile as any).id)
      .select()
      .single()
    if (error) return bad('Failed to update profile', 500)
    result = data
  } else {
    const { data, error } = await service
      .from('organizer_profiles')
      .insert(profileData)
      .select()
      .single()
    if (error) return bad('Failed to create profile', 500)
    result = data
  }

  return NextResponse.json({ ok: true, profile: result })
}
