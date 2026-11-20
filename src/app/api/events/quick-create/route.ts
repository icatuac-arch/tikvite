import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  // Get authenticated user
  const cookieStore = cookies()
  const supabaseAuth = createServerClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Must be logged in to create events' }, { status: 401 })
  }

  const body = await request.json()
  const { title, date, time, location } = body

  if (!title?.trim() || !date) {
    return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Get user profile for publisher name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const eventData: Record<string, any> = {
    title: title.trim(),
    date,
    time: time || null,
    venue: location || '',
    city: '',
    state: '',
    category: 'festival',
    description: '',
    price: 'Free',
    status: 'published',
    rsvp_enabled: true,
    rsvp_capacity: 100,
    publisher_id: user.id,
    publisher_name: profile?.full_name || user.email?.split('@')[0] || 'Organizer',
    source: 'quick-create',
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert(eventData)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: `Failed to create event: ${error.message}` }, { status: 500 })
  }

  // Generate short ID (first 7 hex chars of UUID)
  const shortId = event.id.replace(/-/g, '').slice(0, 7)

  return NextResponse.json({
    ok: true,
    event_id: event.id,
    short_id: shortId,
  })
}
