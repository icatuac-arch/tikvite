/**
 * GET /api/organizer/[slug] — fetch organizer profile + their upcoming events
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { slug } = params
  if (!slug) return NextResponse.json({ ok: false, message: 'Missing slug' }, { status: 400 })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: profile, error } = await supabase
    .from('organizer_profiles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !profile) {
    return NextResponse.json({ ok: false, message: 'Organizer not found' }, { status: 404 })
  }

  // Fetch upcoming published events for this organizer
  const today = new Date().toISOString().slice(0, 10)
  const { data: events } = await supabase
    .from('events')
    .select('id, title, date, time, venue, city, image_url, category, price, rsvp_enabled')
    .eq('publisher_id', (profile as any).user_id)
    .eq('is_published', true)
    .is('deleted_at', null)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(20)

  return NextResponse.json({
    ok: true,
    profile,
    events: events ?? [],
  })
}
