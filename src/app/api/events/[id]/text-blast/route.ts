import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data } = await supabase
    .from('text_blasts')
    .select('*')
    .eq('event_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ blasts: data || [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const body = await request.json()
  const { message, segment = 'all' } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Count recipients based on segment
  let query = supabase
    .from('event_rsvps')
    .select('id, attendee_phone', { count: 'exact' })
    .eq('event_id', params.id)
    .neq('attendee_phone', '')

  if (segment === 'confirmed') query = query.eq('status', 'confirmed')
  else if (segment === 'waitlist') query = query.eq('status', 'waitlist')

  const { count } = await query

  // Save blast as draft (Twilio integration needed for actual sending)
  const { data, error } = await supabase
    .from('text_blasts')
    .insert({
      event_id: params.id,
      sender_id: '00000000-0000-0000-0000-000000000000', // TODO: get from auth
      message: message.trim(),
      segment,
      recipient_count: count || 0,
      status: 'draft', // Will be 'sending' once Twilio is configured
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    blast: data,
    note: 'Text blast saved. SMS delivery requires Twilio configuration.',
  })
}
