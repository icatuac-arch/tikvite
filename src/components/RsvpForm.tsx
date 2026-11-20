'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { EventTier } from '@/lib/rsvp'
import PromoCodeInput from '@/components/PromoCodeInput'
import RsvpCustomQuestions from '@/components/RsvpCustomQuestions'
import { Ticket, Users, Minus, Plus, CheckCircle2, Mail, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface RsvpFormProps {
  eventId: string
  eventTitle: string
  eventShortId: string
  paymentLink: string
  paymentInstructions: string
  tiers: EventTier[]
  occupancyMap?: Record<string, { seatsLeft: number | null; seatsTaken: number; waitlistCount: number }>
  feePassToBuyer?: boolean
  platformFeePerTicket?: number
}

export default function RsvpForm({
  eventId,
  eventTitle,
  eventShortId,
  paymentLink,
  paymentInstructions,
  tiers,
  occupancyMap = {},
  feePassToBuyer = false,
  platformFeePerTicket = 0,
}: RsvpFormProps) {
  const [selectedTierId, setSelectedTierId] = useState<string>(tiers.length > 0 ? tiers[0].id : '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [guestNames, setGuestNames] = useState<string[]>([])
  const [dietaryNotes, setDietaryNotes] = useState('')
  const [accessibilityNotes, setAccessibilityNotes] = useState('')
  const [paymentConfirmation, setPaymentConfirmation] = useState('')
  const [notes, setNotes] = useState('')
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<{ code: string; status: string; ticketNumbers?: string[] } | null>(null)
  const [promoResult, setPromoResult] = useState<{
    promo_id?: string
    discount_type?: string
    discount_value?: number
    discount_amount?: number
    final_price?: number
  } | null>(null)

  const tier = tiers.find((t) => t.id === selectedTierId) || null
  const todayStr = new Date().toISOString().slice(0, 10)
  const earlyBirdActive = tier?.early_bird_price != null && tier?.early_bird_until != null && todayStr <= String(tier.early_bird_until).slice(0, 10)
  const effectivePrice = tier ? (earlyBirdActive ? Number(tier.early_bird_price) : Number(tier.price)) : 0
  const isPaid = effectivePrice > 0
  const isStripe = tier ? !!tier.stripe_enabled && isPaid : false
  const lineTotal = effectivePrice * quantity
  const displayTotal = promoResult?.final_price != null ? promoResult.final_price : lineTotal

  // Sync guest names array with quantity
  useEffect(() => {
    const needed = Math.max(0, quantity - 1)
    setGuestNames(prev => {
      if (prev.length === needed) return prev
      const updated = [...prev]
      while (updated.length < needed) updated.push('')
      return updated.slice(0, needed)
    })
  }, [quantity])

  const occ = selectedTierId ? occupancyMap[selectedTierId] : null
  const seatsLeft = occ?.seatsLeft
  const isSoldOut = seatsLeft != null && seatsLeft <= 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSubmitting(true)
    try {
      if (isStripe) {
        const resp = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            tier_id: selectedTierId,
            attendee_name: name,
            attendee_email: email,
            attendee_phone: phone,
            quantity,
            notes,
            ...(promoResult?.promo_id ? {
              promo_code_id: promoResult.promo_id,
              discount_amount: promoResult.discount_amount,
            } : {}),
          }),
        })
        const data = await resp.json()
        if (!resp.ok || !data?.ok) {
          setErrorMsg(data?.error || 'Payment setup failed. Please try again.')
          setSubmitting(false)
          return
        }
        window.location.href = data.url
        return
      }

      const resp = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          tier_id: selectedTierId || null,
          attendee_name: name,
          attendee_email: email,
          attendee_phone: phone,
          quantity,
          payment_confirmation: paymentConfirmation,
          notes,
          guest_names: guestNames.filter(g => g.trim()),
          dietary_notes: dietaryNotes.trim() || undefined,
          accessibility_notes: accessibilityNotes.trim() || undefined,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data?.ok) {
        setErrorMsg(data?.error || 'RSVP failed. Please try again.')
        setSubmitting(false)
        return
      }
      // Save custom question answers if any
      const answerEntries = Object.entries(customAnswers).filter(([, v]) => v.trim())
      if (data.rsvp_id && answerEntries.length > 0) {
        fetch('/api/rsvp-answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rsvp_id: data.rsvp_id,
            answers: answerEntries.map(([question_id, answer_text]) => ({ question_id, answer_text })),
          }),
        }).catch(() => {}) // best-effort, don't block UX
      }
      setResult({
        code: data.confirmation_code,
        status: data.status,
        ticketNumbers: data.ticket_numbers,
      })
    } catch {
      setErrorMsg('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Confirmation state ── */
  if (result) {
    const isConfirmed = result.status === 'confirmed'
    const isWaitlist = result.status === 'waitlist'
    const isPending = result.status === 'pending'

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-6 sm:p-8 space-y-5"
        style={{
          backgroundColor: isConfirmed ? '#F0FAF0' : isWaitlist ? '#FFF8E1' : '#FFFFFF',
          borderColor: isConfirmed ? '#D1FAE5' : isWaitlist ? '#FEF3C7' : '#E2E8F0',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div className="text-center space-y-3">
          {isConfirmed && <CheckCircle2 size={48} className="mx-auto" style={{ color: '#2D7A3A' }} />}
          {isWaitlist && <Clock size={48} className="mx-auto" style={{ color: '#7C3AED' }} />}
          {isPending && <Mail size={48} className="mx-auto" style={{ color: '#4F46E5' }} />}

          <h2
            className="text-xl sm:text-2xl font-bold"
            style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}
          >
            {isConfirmed && "You're all set!"}
            {isWaitlist && "You're on the waitlist"}
            {isPending && 'RSVP received'}
            {!isConfirmed && !isWaitlist && !isPending && 'RSVP recorded'}
          </h2>

          <p className="text-sm" style={{ color: '#475569' }}>
            {isConfirmed && 'Your tickets have been confirmed. Check your email for details.'}
            {isWaitlist && "This tier is currently full. We'll notify you if a spot opens up."}
            {isPending && 'Complete your payment and we\'ll confirm your tickets.'}
          </p>
        </div>

        {/* Confirmation code */}
        <div
          className="mx-auto max-w-sm px-5 py-4 rounded-xl text-center border"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
        >
          <div className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>
            Confirmation Code
          </div>
          <div
            className="text-2xl font-mono font-bold tracking-widest"
            style={{ color: '#4F46E5' }}
          >
            {result.code}
          </div>
        </div>

        {/* What's next */}
        <div
          className="rounded-xl p-4 space-y-2.5"
          style={{ backgroundColor: 'rgba(253,248,240,0.7)', border: '1px solid #E2E8F0' }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4F46E5' }}>
            What&apos;s next
          </div>
          <ul className="space-y-2 text-sm" style={{ color: '#334155' }}>
            <li className="flex items-start gap-2">
              <Mail size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#4F46E5' }} />
              Check your email ({email}) for your ticket{quantity > 1 ? 's' : ''} and QR code
            </li>
            <li className="flex items-start gap-2">
              <Ticket size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#4F46E5' }} />
              Show your QR code at the door for check-in
            </li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {result.ticketNumbers?.[0] && (
            <Link
              href={`/ticket/${result.ticketNumbers[0]}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
            >
              <Ticket size={16} />
              View My Ticket{quantity > 1 ? 's' : ''}
            </Link>
          )}
          <Link
            href={`/e/${eventShortId}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border"
            style={{ borderColor: '#E2E8F0', color: '#475569' }}
          >
            Back to Event
          </Link>
        </div>
      </motion.div>
    )
  }

  /* ── Form ── */

  // Compute grand total for Stripe with fees
  function computeGrandTotal(): number {
    if (!isStripe || displayTotal <= 0) return displayTotal
    if (!feePassToBuyer) return displayTotal
    const pFee = platformFeePerTicket * quantity
    const subtotal = displayTotal + pFee
    const stripeFee = Math.round((subtotal * 0.029 + 0.30) * 100) / 100
    return subtotal + stripeFee
  }

  const grandTotal = computeGrandTotal()

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
    >
      {/* Form header */}
      <div
        className="px-6 py-4 border-b"
        style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}
      >
        <h2
          className="text-lg font-bold"
          style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}
        >
          {isPaid ? 'Get Tickets' : 'Register for Free'}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
          {isPaid ? 'Select your tickets and complete checkout' : 'Reserve your spot — it only takes a minute'}
        </p>
      </div>

      <form onSubmit={submit} className="p-6 space-y-5" style={{ fontFamily: 'Inter, sans-serif' }}>

        {/* ── Step 1: Select Tickets ── */}
        {tiers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
              >
                1
              </div>
              <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                Select Tickets
              </span>
            </div>

            <div className="space-y-2">
              {tiers.map((t) => {
                const isSelected = selectedTierId === t.id
                const tOcc = occupancyMap[t.id]
                const left = tOcc?.seatsLeft
                const soldOut = left != null && left <= 0
                const lowStock = left != null && left > 0 && left <= 10
                const originalPrice = Number(t.price)

                // Early bird pricing (compare date strings to avoid timezone issues)
                const hasEarlyBird = t.early_bird_price != null && t.early_bird_until != null
                const ebActive = hasEarlyBird && todayStr <= String(t.early_bird_until).slice(0, 10)
                const price = ebActive ? Number(t.early_bird_price) : originalPrice

                // Format early bird deadline
                const earlyBirdDateStr = ebActive ? (() => {
                  try {
                    const ebDate = String(t.early_bird_until).slice(0, 10)
                    const diffMs = new Date(ebDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
                    if (diffDays <= 0) return 'Ends today'
                    if (diffDays === 1) return 'Ends tomorrow'
                    return `Ends in ${diffDays} days`
                  } catch { return '' }
                })() : ''

                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => { if (!soldOut) { setSelectedTierId(t.id); setQuantity(1); setPromoResult(null) } }}
                    disabled={soldOut}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      soldOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'
                    }`}
                    style={{
                      borderColor: isSelected ? '#4F46E5' : '#E2E8F0',
                      backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                            {t.name}
                          </span>
                          {ebActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#2E7D32' }}>
                              EARLY BIRD
                            </span>
                          )}
                          {soldOut && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                              SOLD OUT
                            </span>
                          )}
                          {lowStock && !soldOut && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              {left} LEFT
                            </span>
                          )}
                        </div>
                        {t.capacity != null && !soldOut && !lowStock && (
                          <div className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>
                            {left != null ? `${left} spots available` : ''}
                          </div>
                        )}
                        {ebActive && earlyBirdDateStr && (
                          <div className="text-[11px] mt-1 font-medium" style={{ color: '#7C3AED' }}>
                            {earlyBirdDateStr}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {ebActive && originalPrice > 0 ? (
                          <>
                            <div className="text-base font-bold" style={{ color: '#2E7D32' }}>
                              ${price.toFixed(2)}
                            </div>
                            <div className="text-xs line-through" style={{ color: '#94A3B8' }}>
                              ${originalPrice.toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div
                            className="text-base font-bold"
                            style={{ color: price > 0 ? '#0F172A' : '#2D7A3A' }}
                          >
                            {price > 0 ? `$${price.toFixed(2)}` : 'Free'}
                          </div>
                        )}
                        {price > 0 && (
                          <div className="text-[10px]" style={{ color: '#94A3B8' }}>per ticket</div>
                        )}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && !soldOut && (
                      <div className="mt-3 flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#4F46E5' }}>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4F46E5' }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: '#4F46E5' }}>Selected</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Quantity selector */}
            {tier && !isSoldOut && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm" style={{ color: '#334155' }}>Quantity</span>
                <div className="flex items-center gap-0">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-l-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    <Minus size={14} style={{ color: '#475569' }} />
                  </button>
                  <div
                    className="w-12 h-9 border-t border-b flex items-center justify-center text-sm font-semibold"
                    style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
                  >
                    {quantity}
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(seatsLeft != null ? Math.min(20, seatsLeft) : 20, quantity + 1))}
                    className="w-9 h-9 rounded-r-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    <Plus size={14} style={{ color: '#475569' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Your Details ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
            >
              2
            </div>
            <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
              Your Details
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                Full Name <span style={{ color: '#4F46E5' }}>*</span>
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none"
                style={{
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                Email <span style={{ color: '#4F46E5' }}>*</span>
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none"
                style={{
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                Phone <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none"
                style={{
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
              />
            </div>
          </div>

          {/* Guest names for group registration */}
          {quantity > 1 && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium" style={{ color: '#334155' }}>
                Additional Guest Names
              </label>
              {guestNames.map((gn, idx) => (
                <input
                  key={idx}
                  value={gn}
                  onChange={(e) => {
                    const updated = [...guestNames]
                    updated[idx] = e.target.value
                    setGuestNames(updated)
                  }}
                  placeholder={`Guest ${idx + 2} name`}
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none"
                  style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                  onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                  onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
                />
              ))}
              <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                Each guest will get their own ticket with their name.
              </p>
            </div>
          )}

          {/* Dietary & accessibility */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                Dietary needs <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
              </label>
              <input
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                placeholder="Vegetarian, vegan, allergies..."
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none"
                style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                Accessibility <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
              </label>
              <input
                value={accessibilityNotes}
                onChange={(e) => setAccessibilityNotes(e.target.value)}
                placeholder="Wheelchair, hearing aid..."
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none"
                style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
              />
            </div>
          </div>
        </div>

        {/* Promo code */}
        {isPaid && (
          <PromoCodeInput
            eventId={eventId}
            tierId={selectedTierId}
            quantity={quantity}
            onApply={(res) => setPromoResult(res)}
          />
        )}

        {/* ── Payment section: External manual payment ── */}
        {isPaid && !isStripe && (
          <div
            className="rounded-xl p-4 space-y-3 border"
            style={{ backgroundColor: '#FFF8E1', borderColor: '#FEF3C7' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ color: '#0F172A' }}>Payment required</div>
                <div className="text-xs" style={{ color: '#475569' }}>
                  Complete payment before submitting your RSVP
                </div>
              </div>
              {paymentLink && (
                <a
                  href={paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 flex-shrink-0"
                  style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                >
                  <ExternalLink size={12} />
                  Pay now
                </a>
              )}
            </div>
            {paymentInstructions && (
              <div className="text-xs whitespace-pre-wrap" style={{ color: '#475569' }}>
                {paymentInstructions}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
                Payment confirmation number <span style={{ color: '#4F46E5' }}>*</span>
              </label>
              <input
                required
                value={paymentConfirmation}
                onChange={(e) => setPaymentConfirmation(e.target.value)}
                placeholder="e.g. Venmo txn 8XR2A9 or Zelle #123456"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none"
                style={{
                  borderColor: '#E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
              />
              <div className="mt-1 text-[11px]" style={{ color: '#94A3B8' }}>
                Paste the transaction ID / reference number so the organizer can match your RSVP.
              </div>
            </div>
          </div>
        )}

        {/* Custom RSVP Questions */}
        <RsvpCustomQuestions eventId={eventId} onAnswersChange={setCustomAnswers} />

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#334155' }}>
            Notes for the organizer <span className="text-xs font-normal" style={{ color: '#94A3B8' }}>(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any dietary restrictions, accessibility needs, etc."
            className="w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none resize-none"
            style={{
              borderColor: '#E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
            onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
          />
        </div>

        {/* ── Order Summary ── */}
        {tier && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4F46E5' }}>
              Order Summary
            </div>
            <div className="flex items-center justify-between text-sm" style={{ color: '#334155' }}>
              <span>{quantity} &times; {tier.name}{earlyBirdActive ? ' (Early Bird)' : ''}</span>
              <span>
                {effectivePrice > 0 ? `$${lineTotal.toFixed(2)}` : 'Free'}
              </span>
            </div>
            {promoResult && promoResult.discount_amount != null && promoResult.discount_amount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#2D7A3A' }}>
                  Promo discount
                  {promoResult.discount_type === 'percentage' ? ` (${promoResult.discount_value}%)` : ''}
                </span>
                <span style={{ color: '#2D7A3A' }}>-${Number(promoResult.discount_amount).toFixed(2)}</span>
              </div>
            )}
            {isStripe && feePassToBuyer && displayTotal > 0 && (() => {
              const pFee = platformFeePerTicket * quantity
              const subtotal = displayTotal + pFee
              const stripeFee = Math.round((subtotal * 0.029 + 0.30) * 100) / 100
              return (
                <>
                  {pFee > 0 && (
                    <div className="flex items-center justify-between text-sm" style={{ color: '#475569' }}>
                      <span>Service fee</span>
                      <span>${pFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm" style={{ color: '#475569' }}>
                    <span>Processing fee</span>
                    <span>${stripeFee.toFixed(2)}</span>
                  </div>
                </>
              )
            })()}
            <div
              className="flex items-center justify-between pt-2 mt-1 text-sm font-bold"
              style={{ borderTop: '1px solid #E2E8F0', color: '#0F172A' }}
            >
              <span>Total</span>
              <span className="text-base">
                {grandTotal > 0 ? `$${grandTotal.toFixed(2)}` : 'Free'}
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
            style={{ backgroundColor: '#FFF0F0', border: '1px solid #FECDD3', color: '#991B1B' }}
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting || isSoldOut}
          className="w-full py-3.5 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            backgroundColor: '#4F46E5',
            color: '#F8FAFC',
          }}
        >
          {isSoldOut
            ? 'Sold Out'
            : submitting
              ? (isStripe ? 'Redirecting to secure payment...' : 'Processing...')
              : isStripe
                ? `Pay $${grandTotal.toFixed(2)}`
                : isPaid
                  ? `Confirm RSVP \u00b7 $${displayTotal.toFixed(2)}`
                  : quantity > 1
                    ? `Get ${quantity} Free Tickets`
                    : 'Get Free Ticket'
          }
        </button>

        {/* Stripe trust badge */}
        {isStripe && (
          <div className="flex items-center justify-center gap-2 text-[11px]" style={{ color: '#94A3B8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="m7 11 0-4a5 5 0 0 1 10 0v4"/></svg>
            Secure payment powered by Stripe
          </div>
        )}

        <p className="text-[11px] text-center" style={{ color: '#94A3B8' }}>
          By registering you agree to receive an email confirmation for {eventTitle}.
        </p>
      </form>
    </div>
  )
}
