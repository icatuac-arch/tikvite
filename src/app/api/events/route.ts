/**
 * POST /api/events — Authenticated event submission endpoint.
 *
 * Used by the KhojAI agent (and any future API consumers) to submit
 * events with proper auth, idempotency, and validation.  Events land
 * as status='published' (auto-approved for trusted API keys).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateGuestEditToken } from '@/lib/rsvp'
import { findMetroArea, getShortId } from '@/lib/constants'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Rate limiter (in-memory, per API-key hash) ──────────────────────
const rateBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60 // requests per minute

function checkRateLimit(keyHash: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  let bucket = rateBuckets.get(keyHash)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + 60_000 }
    rateBuckets.set(keyHash, bucket)
  }
  bucket.count++
  if (bucket.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    return { ok: false, retryAfter }
  }
  return { ok: true, retryAfter: 0 }
}

// ── Helpers ─────────────────────────────────────────────────────────
function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex')
}

function err(error: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, message }, { status, headers })
}

const ALLOWED_CATEGORIES = new Set([
  'dance', 'vocal', 'instrumental', 'standup', 'play',
  'movies', 'competition', 'poetry', 'festival',
])

// Normalize crawler-style slugs (e.g. 'bay-area') to METRO_AREAS keys (e.g. 'Bay Area')
const METRO_SLUG_MAP: Record<string, string> = {
  'bay-area': 'Bay Area', 'new-york': 'New York', 'los-angeles': 'LA', 'los angeles': 'LA',
  'dallas-fort-worth': 'Dallas', 'dallas': 'Dallas', 'washington-dc': 'DC',
  'san-diego': 'San Diego',
  'new-jersey': 'NJ', 'research-triangle': 'Research Triangle', 'tampa-bay': 'Tampa',
  'seattle': 'Seattle', 'houston': 'Houston', 'phoenix': 'Phoenix',
  'orlando': 'Orlando', 'austin': 'Austin', 'philadelphia': 'Philadelphia',
  'minneapolis': 'Minneapolis', 'atlanta': 'Atlanta', 'sacramento': 'Sacramento',
  'chicago': 'Chicago', 'boston': 'Boston', 'denver': 'Denver', 'tampa': 'Tampa',
  'detroit': 'Detroit', 'charlotte': 'Charlotte',
  'columbus': 'Columbus', 'raleigh': 'Research Triangle',
  'miami': 'Miami', 'nj': 'NJ',
  'san-antonio': 'San Antonio', 'san antonio': 'San Antonio',
  'pittsburgh': 'Pittsburgh', 'cleveland': 'Cleveland',
  'cincinnati': 'Cincinnati', 'indianapolis': 'Indianapolis',
  'milwaukee': 'Milwaukee', 'st-louis': 'St Louis', 'st louis': 'St Louis',
}

function normalizeMetro(raw: string): string {
  if (!raw) return ''
  const slug = raw.toLowerCase().trim()
  return METRO_SLUG_MAP[slug] || raw
}

function detectMetro(body: Record<string, string>): string {
  const raw = (body.metro_region || '').trim()
  const normalized = normalizeMetro(raw)
  if (normalized && normalized !== 'Other') return normalized

  const city = (body.city || '').trim()
  if (city) {
    const detected = findMetroArea(city)
    if (detected && detected !== 'Other') return detected
  }
  return normalized || 'Other'
}

/** Validate image magic bytes (JPEG FFD8, PNG 89504E47, WebP 52494646...WEBP) */
function validateImageMagicBytes(buffer: Buffer): { valid: boolean; ext: string } {
  if (buffer.length < 12) return { valid: false, ext: '' }

  // JPEG: starts with FF D8
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return { valid: true, ext: 'jpg' }
  }
  // PNG: starts with 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { valid: true, ext: 'png' }
  }
  // WebP: starts with RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, ext: 'webp' }
  }

  return { valid: false, ext: '' }
}

// ── POST handler ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────
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

  // ── 2. Rate limit ────────────────────────────────────────────────
  const rl = checkRateLimit(keyHash)
  if (!rl.ok) {
    return err('rate_limited', `Too many requests. Retry after ${rl.retryAfter} seconds`, 429, {
      'Retry-After': String(rl.retryAfter),
    })
  }

  // ── 3. Parse multipart/form-data ─────────────────────────────────
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return err('bad_request', 'Content-Type must be multipart/form-data', 400)
  }

  let fd: FormData
  try {
    fd = await request.formData()
  } catch {
    return err('bad_request', 'Invalid multipart body', 400)
  }

  const field = (name: string) => (fd.get(name)?.toString() || '').trim()

  // ── 4. Validate fields ───────────────────────────────────────────
  const title = field('title')
  if (!title) return err('validation', 'title is required', 400)
  if (title.length > 120) return err('validation', 'title exceeds 120 characters', 400)

  const category = field('category').toLowerCase()
  if (!ALLOWED_CATEGORIES.has(category)) {
    return err('validation', `Invalid category. Allowed: ${Array.from(ALLOWED_CATEGORIES).join(', ')}`, 400)
  }

  const description = field('description')
  if (description.length > 2000) return err('validation', 'description exceeds 2000 characters', 400)

  const venue = field('venue')
  if (!venue) return err('validation', 'venue is required', 400)
  if (venue.length > 120) return err('validation', 'venue exceeds 120 characters', 400)

  const address = field('address')
  if (address.length > 200) return err('validation', 'address exceeds 200 characters', 400)

  const city = field('city')
  if (!city) return err('validation', 'city is required', 400)

  const state = field('state')
  if (!state) return err('validation', 'state is required', 400)

  const metroRegion = field('metro_region')
  if (!metroRegion) return err('validation', 'metro_region is required', 400)

  const zipCode = field('zip_code')

  const date = field('date')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('validation', 'date must be YYYY-MM-DD', 400)
  const d = new Date(date + 'T00:00:00')
  if (isNaN(d.getTime())) return err('validation', 'Invalid date', 400)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (d < today) return err('validation', 'Event date must be today or in the future', 400)

  const time = field('time')

  const ticketUrl = field('ticket_url')
  if (!ticketUrl) return err('validation', 'ticket_url is required', 400)
  try {
    const u = new URL(ticketUrl)
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
  } catch {
    return err('validation', 'ticket_url must be a valid http/https URL', 400)
  }

  const price = field('price')
  const language = field('language')

  const idempotencyKey = field('idempotency_key')
  if (!idempotencyKey) return err('validation', 'idempotency_key is required (UUID v4)', 400)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return err('validation', 'idempotency_key must be a valid UUID v4', 400)
  }

  // ── 5. Poster image ──────────────────────────────────────────────
  const posterFile = fd.get('poster')
  if (!posterFile || !(posterFile instanceof File) || posterFile.size === 0) {
    return err('validation', 'poster file is required (jpg/png/webp, max 5MB)', 400)
  }

  if (posterFile.size > 5 * 1024 * 1024) {
    return err('file_too_large', 'Poster file exceeds 5 MB limit', 413)
  }

  const posterBuffer = Buffer.from(await posterFile.arrayBuffer())
  const magic = validateImageMagicBytes(posterBuffer)
  if (!magic.valid) {
    return err('bad_image', 'File is not a valid image. Accepted formats: JPEG, PNG, WebP', 415)
  }

  // ── 6. Idempotency check ─────────────────────────────────────────
  const { data: existingByKey } = await supabase
    .from('events')
    .select('id, guest_edit_token')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingByKey) {
    const shortId = getShortId(existingByKey.id)
    const editUrl = `https://ticvite.com/g/${existingByKey.guest_edit_token}`
    return NextResponse.json({
      ok: true,
      event_id: shortId,
      edit_url: editUrl,
      duplicate: true,
    }, { status: 200 })
  }

  // ── 7. Duplicate detection (same title+date+venue, normalized) ────
  // Normalize: trim, lowercase, collapse whitespace for comparison
  const normalizedTitle = title.trim().replace(/\s+/g, ' ').toLowerCase()
  const normalizedVenue = venue.trim().replace(/\s+/g, ' ').toLowerCase()
  const { data: dupes } = await supabase
    .from('events')
    .select('id, title, venue')
    .eq('date', date)
    .is('deleted_at', null)

  const matchingDupes = (dupes || []).filter((e: any) => {
    const eTitle = (e.title || '').trim().replace(/\s+/g, ' ').toLowerCase()
    const eVenue = (e.venue || '').trim().replace(/\s+/g, ' ').toLowerCase()
    return eTitle === normalizedTitle && eVenue === normalizedVenue
  })

  if (matchingDupes.length > 0) {
    return NextResponse.json({
      ok: false,
      error: 'duplicate',
      message: `An event with the same title, date, and venue already exists`,
      existing_event_id: getShortId(matchingDupes[0].id),
    }, { status: 409 })
  }

  // ── 8. Upload poster ─────────────────────────────────────────────
  const filePath = `api/${Date.now()}-${Math.random().toString(36).slice(2)}.${magic.ext}`
  const { error: uploadError } = await supabase.storage
    .from('event-posters')
    .upload(filePath, posterBuffer, { contentType: `image/${magic.ext === 'jpg' ? 'jpeg' : magic.ext}` })

  if (uploadError) {
    return err('upload_failed', `Poster upload failed: ${uploadError.message}`, 500)
  }

  const { data: urlData } = supabase.storage
    .from('event-posters')
    .getPublicUrl(filePath)
  const imageUrl = urlData.publicUrl

  // ── 9. Insert event ──────────────────────────────────────────────
  const guestEditToken = generateGuestEditToken()
  const resolvedMetro = detectMetro({
    metro_region: metroRegion,
    city,
    state,
    address,
  })

  const insert = {
    title: title.substring(0, 120),
    category,
    description: description.substring(0, 2000),
    venue: venue.substring(0, 120),
    address: address.substring(0, 200),
    city: city.substring(0, 100),
    metro_region: resolvedMetro,
    state: state.substring(0, 100),
    zip_code: zipCode.substring(0, 20),
    date,
    time: time.substring(0, 50),
    ticket_url: ticketUrl.substring(0, 1000),
    price: price || 'Paid',
    language: language.substring(0, 200),
    image_url: imageUrl,
    status: 'published',
    source: 'api',
    publisher_name: 'KhojAI',
    publisher_id: process.env.CRAWLER_USER_ID || process.env.GUEST_USER_ID,
    guest_edit_token: guestEditToken,
    idempotency_key: idempotencyKey,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('events')
    .insert(insert)
    .select('id')
    .single()

  if (insertError || !inserted) {
    return err('insert_failed', `Event creation failed: ${insertError?.message || 'unknown'}`, 500)
  }

  const shortId = getShortId(inserted.id)
  const editUrl = `https://ticvite.com/g/${guestEditToken}`

  return NextResponse.json({
    ok: true,
    event_id: shortId,
    edit_url: editUrl,
    duplicate: false,
  }, { status: 201 })
}
