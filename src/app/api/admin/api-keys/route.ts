/**
 * POST /api/admin/api-keys — Manage API keys (admin only).
 *
 * Actions:
 *   generate — Create a new API key (returns plaintext once)
 *   revoke   — Revoke a key by id
 *   list     — List all keys (label + status, no secrets)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Verify the caller is an admin via their auth session. */
async function verifyAdmin(): Promise<string | null> {
  const sb = createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return profile?.role === 'admin' ? user.id : null
}

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex')
}

export async function POST(req: NextRequest) {
  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()
  const action = body.action

  switch (action) {
    // ── Generate a new API key ────────────────────────────────────
    case 'generate': {
      const label = (body.label || '').toString().trim() || 'Unnamed Key'

      // Generate a 32-byte random key, base64url-encoded
      const rawBytes = crypto.randomBytes(32)
      const plaintext = 'ipk_' + rawBytes.toString('base64url')
      const hash = hashKey(plaintext)

      const { data, error } = await sb
        .from('api_keys')
        .insert({ key_hash: hash, label })
        .select('id, label, created_at')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        key: plaintext,       // ← shown only once
        id: data.id,
        label: data.label,
        created_at: data.created_at,
        message: 'Save this key — it will not be shown again.',
      })
    }

    // ── Revoke a key ──────────────────────────────────────────────
    case 'revoke': {
      const id = body.id
      if (!id) return NextResponse.json({ error: 'Missing key id' }, { status: 400 })

      const { error } = await sb
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    // ── List all keys ─────────────────────────────────────────────
    case 'list': {
      const { data, error } = await sb
        .from('api_keys')
        .select('id, label, created_at, revoked_at')
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        keys: (data || []).map((k) => ({
          id: k.id,
          label: k.label,
          created_at: k.created_at,
          status: k.revoked_at ? 'revoked' : 'active',
          revoked_at: k.revoked_at,
        })),
      })
    }

    default:
      return NextResponse.json(
        { error: 'Unknown action. Use: generate, revoke, list' },
        { status: 400 },
      )
  }
}
