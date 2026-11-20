'use client'

import { useState } from 'react'
import { Tag, Check, X, Loader2 } from 'lucide-react'

interface PromoResult {
  valid: boolean
  promo_id?: string
  discount_type?: 'percentage' | 'fixed'
  discount_value?: number
  discount_amount?: number
  original_price?: number
  final_price?: number
  error?: string
}

interface Props {
  eventId: string
  tierId: string
  quantity: number
  onApply: (result: PromoResult | null) => void
}

export default function PromoCodeInput({ eventId, tierId, quantity, onApply }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PromoResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validate = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          code: code.trim(),
          tier_id: tierId,
          quantity,
        }),
      })
      const data: PromoResult = await resp.json()
      if (data.valid) {
        setResult(data)
        onApply(data)
      } else {
        setError(data.error || 'Invalid promo code')
        setResult(null)
        onApply(null)
      }
    } catch {
      setError('Failed to validate code')
      setResult(null)
      onApply(null)
    }
    setLoading(false)
  }

  const clearPromo = () => {
    setCode('')
    setResult(null)
    setError(null)
    onApply(null)
  }

  if (!expanded && !result) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
        style={{ color: '#4F46E5' }}
      >
        <Tag size={12} />
        Have a promo code?
      </button>
    )
  }

  if (result) {
    return (
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border"
        style={{ backgroundColor: '#F0FAF0', borderColor: '#D1FAE5' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Check size={14} style={{ color: '#2D7A3A' }} />
          <span className="text-xs font-bold" style={{ color: '#2D7A3A' }}>{code.toUpperCase()}</span>
          <span className="text-xs" style={{ color: '#2D7A3A' }}>
            {result.discount_type === 'percentage'
              ? `${result.discount_value}% off`
              : `$${Number(result.discount_value).toFixed(2)} off`}
          </span>
          <span className="text-xs" style={{ color: '#475569' }}>
            &middot; Saving ${Number(result.discount_amount).toFixed(2)}
          </span>
        </div>
        <button
          type="button"
          onClick={clearPromo}
          className="p-1 transition-colors hover:opacity-70 flex-shrink-0"
          style={{ color: '#94A3B8' }}
          title="Remove promo code"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full pl-8 pr-3 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
            style={{
              borderColor: '#E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
            }}
            placeholder="Enter promo code"
            maxLength={30}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validate() } }}
            onFocus={(e) => { e.target.style.borderColor = '#4F46E5' }}
            onBlur={(e) => { e.target.style.borderColor = '#E2E8F0' }}
          />
        </div>
        <button
          type="button"
          onClick={validate}
          disabled={loading || !code.trim()}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all hover:opacity-90"
          style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
        </button>
        <button
          type="button"
          onClick={() => { setExpanded(false); clearPromo() }}
          className="p-2 transition-colors hover:opacity-70"
          style={{ color: '#94A3B8' }}
        >
          <X size={14} />
        </button>
      </div>
      {error && <div className="text-xs" style={{ color: '#991B1B' }}>{error}</div>}
    </div>
  )
}
