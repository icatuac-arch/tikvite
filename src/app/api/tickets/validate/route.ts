/**
 * Ticket validation API — public endpoint for QR scanner.
 * GET /api/tickets/validate?t={qrToken}
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── IP-based rate limiting (10 requests per minute) ──────────────────
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  let timestamps = rateLimitMap.get(ip)
  if (!timestamps) {
    timestamps = []
    rateLimitMap.set(ip, timestamps)
  }
  // Remove timestamps outside the window
  while (timestamps.length > 0 && timestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
    timestamps.shift()
  }
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false
  }
  timestamps.push(now)
  return true
}

// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  rateLimitMap.forEach((timestamps, ip) => {
    while (timestamps.length > 0 && timestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
      timestamps.shift()
    }
    if (timestamps.length === 0) rateLimitMap.delete(ip)
  })
}, 5 * 60_000).unref?.()

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const qrToken = url.searchParams.get('t')

  if (!qrToken) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('ticket_number, holder_name, holder_email, status, checked_in_at, tier_id, event_id, events(title, date, time, venue, address, city, state), event_tiers(name)')
    .eq('qr_token', qrToken)
    .single()

  if (error || !ticket) {
    return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 })
  }

  const event = (ticket as any).events
  const tier = (ticket as any).event_tiers

  return NextResponse.json({
    ok: true,
    ticket_number: ticket.ticket_number,
    holder_name: ticket.holder_name,
    holder_email: ticket.holder_email,
    status: ticket.status,
    checked_in_at: ticket.checked_in_at,
    tier_name: tier?.name || null,
    event: {
      title: event?.title || '',
      date: event?.date || '',
      time: event?.time || '',
      venue: event?.venue || '',
      address: event?.address || '',
      city: event?.city || '',
      state: event?.state || '',
    },
  })
}
