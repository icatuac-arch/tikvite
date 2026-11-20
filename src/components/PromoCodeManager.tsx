'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Tag, Clock, Hash, Percent, DollarSign, Copy, Check } from 'lucide-react'

interface PromoCode {
  id: string
  event_id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  used_count: number
  valid_from: string | null
  valid_until: string | null
  applicable_tiers: string[] | null
  min_quantity: number
  is_active: boolean
  created_at: string
}

interface Tier {
  id: string
  name: string
}

interface Props {
  eventId: string
  tiers: Tier[]
}

export default function PromoCodeManager({ eventId, tiers }: Props) {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [newCode, setNewCode] = useState('')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [selectedTiers, setSelectedTiers] = useState<string[]>([])
  const [minQuantity, setMinQuantity] = useState('1')

  const fetchPromos = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/promo?event_id=${eventId}`)
      const data = await resp.json()
      if (data.ok) setPromos(data.promo_codes)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchPromos() }, [eventId])

  const createPromo = async () => {
    setError(null)
    setCreating(true)
    try {
      const resp = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          code: newCode,
          discount_type: discountType,
          discount_value: parseFloat(discountValue) || 0,
          max_uses: maxUses ? parseInt(maxUses) : null,
          valid_from: validFrom || null,
          valid_until: validUntil || null,
          applicable_tiers: selectedTiers.length ? selectedTiers : null,
          min_quantity: parseInt(minQuantity) || 1,
        }),
      })
      const data = await resp.json()
      if (!data.ok) {
        setError(data.error)
      } else {
        setShowCreate(false)
        resetForm()
        await fetchPromos()
      }
    } catch {
      setError('Failed to create promo code')
    }
    setCreating(false)
  }

  const deactivate = async (promoId: string) => {
    await fetch(`/api/promo?id=${promoId}&event_id=${eventId}`, { method: 'DELETE' })
    await fetchPromos()
  }

  const resetForm = () => {
    setNewCode('')
    setDiscountType('percentage')
    setDiscountValue('')
    setMaxUses('')
    setValidFrom('')
    setValidUntil('')
    setSelectedTiers([])
    setMinQuantity('1')
    setError(null)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:border-[#4F46E5] transition-colors'
  const labelClass = 'block text-xs text-[#475569] mb-1.5'

  const activePromos = promos.filter(p => p.is_active)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-[#4F46E5]" />
          <span className="text-sm font-semibold text-[#0F172A]">Promo Codes</span>
          {activePromos.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#4F46E5]/20 text-[#4F46E5] border border-[#4F46E5]/30">
              {activePromos.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); if (showCreate) resetForm() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#F8FAFC] bg-[#4F46E5] hover:opacity-90 transition-colors"
        >
          <Plus size={14} />
          {showCreate ? 'Cancel' : 'Add Code'}
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Code *</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className={inputClass}
                placeholder="e.g. DIWALI20"
                maxLength={30}
              />
            </div>
            <div>
              <label className={labelClass}>Discount type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                className={inputClass}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Value *</label>
              <div className="relative">
                {discountType === 'percentage' ? (
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                ) : (
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                )}
                <input
                  type="number"
                  min={0}
                  max={discountType === 'percentage' ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className={`${inputClass} pl-8`}
                  placeholder={discountType === 'percentage' ? '10' : '5.00'}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Max uses (blank = unlimited)</label>
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className={inputClass}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label className={labelClass}>Valid from</label>
              <input
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Valid until</label>
              <input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Min tickets required</label>
              <input
                type="number"
                min={1}
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                className={inputClass}
              />
            </div>
            {tiers.length > 0 && (
              <div>
                <label className={labelClass}>Applicable tiers (blank = all)</label>
                <div className="flex flex-wrap gap-2">
                  {tiers.map(t => (
                    <label key={t.id} className="flex items-center gap-1.5 text-xs text-[#334155] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTiers.includes(t.id)}
                        onChange={() => {
                          setSelectedTiers(prev =>
                            prev.includes(t.id)
                              ? prev.filter(id => id !== t.id)
                              : [...prev, t.id]
                          )
                        }}
                        className="accent-[#4F46E5]"
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            onClick={createPromo}
            disabled={creating || !newCode.trim() || !discountValue}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[#F8FAFC] bg-[#4F46E5] disabled:opacity-50 hover:opacity-90 transition-colors"
          >
            {creating ? 'Creating...' : 'Create Promo Code'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-[#94A3B8] py-4 text-center">Loading promo codes...</div>
      ) : activePromos.length === 0 && !showCreate ? (
        <div className="text-xs text-[#94A3B8] italic py-2">
          No active promo codes. Create one to offer discounts to your attendees.
        </div>
      ) : (
        <div className="space-y-2">
          {activePromos.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => copyCode(p.code)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4F46E5]/15 text-[#4F46E5] font-mono text-sm font-semibold hover:bg-[#4F46E5]/25 transition-colors"
                  title="Click to copy"
                >
                  {p.code}
                  {copied === p.code ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <div className="text-xs text-[#475569]">
                  {p.discount_type === 'percentage' ? `${p.discount_value}% off` : `$${Number(p.discount_value).toFixed(2)} off`}
                </div>
                <div className="text-xs text-[#94A3B8] flex items-center gap-1">
                  <Hash size={10} />
                  {p.used_count}{p.max_uses ? `/${p.max_uses}` : ''} used
                </div>
                {p.valid_until && (
                  <div className="text-xs text-[#94A3B8] flex items-center gap-1">
                    <Clock size={10} />
                    Expires {new Date(p.valid_until).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => deactivate(p.id)}
                className="p-1.5 rounded text-[#94A3B8] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Deactivate"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
