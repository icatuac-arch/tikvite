/**
 * GET /api/cron/release-holds — release expired seat holds
 *
 * Schedule: every minute via vercel.json cron
 * Auth:     Authorization: Bearer ${CRON_SECRET}
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`
  if (!process.env.CRON_SECRET || authHeader !== expected) return unauthorized()

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const { data, error, count } = await supabase
    .from('session_seats')
    .update({
      status: 'available',
      hold_expires_at: null,
      held_by: null,
      updated_at: new Date().toISOString(),
    }, { count: 'exact' })
    .eq('status', 'held')
    .lt('hold_expires_at', new Date().toISOString())

  if (error) {
    console.error('[release-holds] Error:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const released = count || 0
  if (released > 0) {
    console.log(`[release-holds] Released ${released} expired seat holds`)
  }

  return NextResponse.json({ ok: true, released })
}
