/**
 * Validate a promo code and return the discount details.
 * Public endpoint — no auth required (attendees use this at checkout).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function bad(msg: string, status = 400) {
  return NextResponse.json({ valid: false, error: msg }, { status })
}

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return bad('Invalid JSON') }

  const { event_id, code, tier_id, quantity } = body
  if (!event_id || !code) return bad('Missing event_id or code')

  const normalizedCode = code.toString().toUpperCase().trim()
  const qty = Math.max(1, parseInt(quantity, 10) || 1)

  const service = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: promo } = await service
    .from('promo_codes')
    .select('*')
    .eq('event_id', event_id)
    .eq('code', normalizedCode)
    .eq('is_active', true)
    .single()

  if (!promo) return bad('Invalid promo code')

  // Check date range
  const now = new Date()
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return bad('This promo code is not yet active')
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return bad('This promo code has expired')
  }

  // Check max uses
  if (promo.max_uses && promo.used_count >= promo.max_uses) {
    return bad('This promo code has reached its usage limit')
  }

  // Check applicable tiers — if promo is tier-restricted, tier_id is required
  if (promo.applicable_tiers && promo.applicable_tiers.length > 0) {
    if (!tier_id) {
      return bad('Please select a ticket tier to use this promo code')
    }
    if (!promo.applicable_tiers.includes(tier_id)) {
      return bad('This promo code does not apply to the selected tier')
    }
  }

  // Check minimum quantity
  if (qty < promo.min_quantity) {
    return bad(`Minimum ${promo.min_quantity} tickets required for this promo code`)
  }

  // Calculate final price
  let tierPrice = 0
  if (tier_id) {
    const { data: tier } = await service
      .from('event_tiers')
      .select('price')
      .eq('id', tier_id)
      .single()
    tierPrice = tier ? Number(tier.price) : 0
  }

  const lineTotal = tierPrice * qty
  let discountAmount: number
  if (promo.discount_type === 'percentage') {
    discountAmount = Math.round(lineTotal * Number(promo.discount_value) / 100 * 100) / 100
  } else {
    discountAmount = Math.min(Number(promo.discount_value), lineTotal)
  }
  const finalPrice = Math.max(0, Math.round((lineTotal - discountAmount) * 100) / 100)

  return NextResponse.json({
    valid: true,
    promo_id: promo.id,
    discount_type: promo.discount_type,
    discount_value: Number(promo.discount_value),
    discount_amount: discountAmount,
    original_price: lineTotal,
    final_price: finalPrice,
  })
}
