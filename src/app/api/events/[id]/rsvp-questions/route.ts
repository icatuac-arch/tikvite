/**
 * GET  /api/events/[id]/rsvp-questions — fetch questions for event (sorted by sort_order)
 * POST /api/events/[id]/rsvp-questions — full-replace questions (requires auth, event publisher)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function err(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id: eventId } = params
  if (!eventId) return err('Missing event id', 400)

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await service
    .from('event_rsvp_questions')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })

  if (error) return err('Failed to fetch questions', 500)
  return NextResponse.json({ ok: true, questions: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id: eventId } = params
  if (!eventId) return err('Missing event id', 400)

  // Auth
  const authed = createServerSupabaseClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return err('Not authenticated', 401)

  const service = createServiceClient(SUPABASE_URL, SERVICE_ROLE)

  // Ownership check
  const { data: event } = await service
    .from('events')
    .select('publisher_id')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return err('Event not found', 404)

  if ((event as any).publisher_id !== user.id) {
    const { data: prof } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role !== 'admin') return err('Not authorized', 403)
  }

  let body: any
  try { body = await request.json() } catch { return err('Invalid JSON') }

  const questions: Array<{
    question_text: string
    question_type: string
    options?: string[] | null
    is_required: boolean
    sort_order: number
  }> = Array.isArray(body?.questions) ? body.questions : []

  // Validate types
  const VALID_TYPES = new Set(['text', 'textarea', 'select', 'multiselect', 'checkbox', 'number'])
  for (const q of questions) {
    if (!q.question_text?.trim()) return err('Each question must have text')
    if (!VALID_TYPES.has(q.question_type)) return err(`Invalid question type: ${q.question_type}`)
  }

  // Full replace: delete existing, re-insert
  const { error: delError } = await service
    .from('event_rsvp_questions')
    .delete()
    .eq('event_id', eventId)
  if (delError) return err('Failed to clear existing questions', 500)

  if (questions.length > 0) {
    const rows = questions.map((q, i) => ({
      event_id: eventId,
      question_text: q.question_text.trim(),
      question_type: q.question_type,
      options: q.options ?? null,
      is_required: Boolean(q.is_required),
      sort_order: typeof q.sort_order === 'number' ? q.sort_order : i,
    }))

    const { data: inserted, error: insError } = await service
      .from('event_rsvp_questions')
      .insert(rows)
      .select()
    if (insError) return err('Failed to save questions', 500)
    return NextResponse.json({ ok: true, questions: inserted })
  }

  return NextResponse.json({ ok: true, questions: [] })
}
