/**
 * DELETE /api/events/[id] — Soft-delete an event by short ID.
 *
 * Sets deleted_at = now() instead of hard-deleting. Idempotent — calling
 * delete on an already-deleted event returns 200 with deleted: true.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getShortId } from '@/lib/constants'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex')
}

function err(error: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error, message }, { status })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // ── Auth ──────────────────────────────────────────────────────────
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return err('auth', 'Invalid or missing API key', 401)
  }

  const keyHash = hashKey(apiKey)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: keyRow } = await supabase
    .from('api_keys')
    .select('id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!keyRow || keyRow.revoked_at) {
    return err('auth', 'Invalid or missing API key', 401)
  }

  // ── Resolve short ID to full UUID ────────────────────────────────
  const shortId = params.id
  if (!shortId || shortId.length < 7) {
    return err('not_found', 'No event with this ID', 404)
  }

  // Range query — same pattern as src/app/e/[shortId]/page.tsx
  const lo = `${shortId}0-0000-0000-0000-000000000000`
  const hi = `${shortId}f-ffff-ffff-ffff-ffffffffffff`

  const { data: candidates } = await supabase
    .from('events')
    .select('id, deleted_at')
    .gte('id', lo)
    .lte('id', hi)
    .limit(16)

  if (!candidates?.length) {
    return err('not_found', 'No event with this ID', 404)
  }

  // Find the exact match
  const event = candidates.find((e) => getShortId(e.id) === shortId) || candidates[0]
  if (!event) {
    return err('not_found', 'No event with this ID', 404)
  }

  // ── Soft delete (idempotent) ─────────────────────────────────────
  if (!event.deleted_at) {
    const { error: updateError } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', event.id)

    if (updateError) {
      return err('delete_failed', `Soft delete failed: ${updateError.message}`, 500)
    }
  }

  return NextResponse.json({
    ok: true,
    event_id: getShortId(event.id),
    deleted: true,
  })
}
