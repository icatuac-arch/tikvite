/**
 * GET  /api/rsvp-answers?rsvp_id=…&event_id=… — fetch answers for a specific RSVP (service role, organizer view)
 * POST /api/rsvp-answers — save custom question answers when RSVP is submitted
 * Body: { rsvp_id, answers: [{ question_id, answer_text }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

export async function GET(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return bad('Server not configured', 500)

  const { searchParams } = new URL(request.url)
  const rsvpId = (searchParams.get('rsvp_id') || '').trim()
  if (!rsvpId) return bad('Missing rsvp_id')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: answers, error } = await supabase
    .from('event_rsvp_answers')
    .select('question_id, answer_text')
    .eq('rsvp_id', rsvpId)

  if (error) return bad('Failed to fetch answers', 500)
  return NextResponse.json({ ok: true, answers: answers ?? [] })
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return bad('Server not configured', 500)

  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const rsvpId = (body?.rsvp_id || '').toString().trim()
  const answers: Array<{ question_id: string; answer_text: string }> = Array.isArray(body?.answers)
    ? body.answers
    : []

  if (!rsvpId) return bad('Missing rsvp_id')
  if (answers.length === 0) return NextResponse.json({ ok: true, saved: 0 })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify rsvp exists
  const { data: rsvp } = await supabase
    .from('event_rsvps')
    .select('id, event_id')
    .eq('id', rsvpId)
    .maybeSingle()
  if (!rsvp) return bad('RSVP not found', 404)

  // Verify all question_ids belong to this event
  const questionIds = Array.from(new Set(answers.map((a) => a.question_id).filter(Boolean)))
  if (questionIds.length === 0) return NextResponse.json({ ok: true, saved: 0 })

  const { data: validQuestions } = await supabase
    .from('event_rsvp_questions')
    .select('id')
    .eq('event_id', (rsvp as any).event_id)
    .in('id', questionIds)

  const validIds = new Set((validQuestions || []).map((q: any) => q.id))

  const rows = answers
    .filter((a) => a.question_id && validIds.has(a.question_id))
    .map((a) => ({
      rsvp_id: rsvpId,
      question_id: a.question_id,
      answer_text: (a.answer_text || '').toString().trim(),
    }))

  if (rows.length === 0) return NextResponse.json({ ok: true, saved: 0 })

  const { error } = await supabase
    .from('event_rsvp_answers')
    .upsert(rows, { onConflict: 'rsvp_id,question_id' })

  if (error) return bad('Failed to save answers', 500)
  return NextResponse.json({ ok: true, saved: rows.length })
}
