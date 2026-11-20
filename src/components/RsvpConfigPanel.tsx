'use client'

import { useState } from 'react'
import { Plus, Trash2, Bell, XCircle, Mail } from 'lucide-react'
import Link from 'next/link'
import type { EventTier } from '@/lib/rsvp'
import PromoCodeManager from '@/components/PromoCodeManager'

interface RsvpCfg {
  rsvp_enabled: boolean
  rsvp_deadline: string
  rsvp_capacity: number | string
  payment_link: string
  payment_instructions: string
  reminder_enabled: boolean
  allow_self_cancel?: boolean
}

interface Props {
  eventId?: string
  cfg: RsvpCfg
  setCfg: (updater: (prev: RsvpCfg) => RsvpCfg) => void
  tiers: EventTier[]
  onSave: () => Promise<void>
  onUpsertTier: (tier: Partial<EventTier>) => Promise<void>
  onDeleteTier: (tierId: string) => Promise<void>
  saving: boolean
  msg: string | null
  reminderStatus?: {
    reminder_1day_sent?: boolean
    reminder_3hr_sent?: boolean
    reminder_followup_sent?: boolean
  }
  feePassToBuyer?: boolean
  onFeeToggle?: (value: boolean) => void
}

/**
 * Editable RSVP config panel used inside the guest management page and,
 * eventually, the registered publisher dashboard too. Same shape either
 * way — this component only talks to callback props, so parents can
 * swap the API layer under it.
 */
export default function RsvpConfigPanel({
  eventId, cfg, setCfg, tiers, onSave, onUpsertTier, onDeleteTier, saving, msg, reminderStatus, feePassToBuyer: feePassToBuyerProp, onFeeToggle,
}: Props) {
  const [newTier, setNewTier] = useState({ name: '', price: '', capacity: '' })
  const [feePassToBuyer, setFeePassToBuyer] = useState(feePassToBuyerProp ?? false)

  async function addTier() {
    if (!newTier.name.trim()) return
    await onUpsertTier({
      name: newTier.name,
      price: Number(newTier.price) || 0,
      capacity: newTier.capacity ? Number(newTier.capacity) : null,
      sort_order: tiers.length,
    } as any)
    setNewTier({ name: '', price: '', capacity: '' })
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:border-[#4F46E5] transition-colors'
  const labelClass = 'block text-xs text-[#475569] mb-1.5'

  return (
    <div className="rounded-xl border p-5 sm:p-6 bg-[#FFFFFF] border-[#E2E8F0] space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#0F172A]">RSVP / ticketing</div>
          <div className="text-xs text-[#94A3B8]">Off by default. Turn on to accept attendee registrations.</div>
        </div>
        <button
          type="button"
          onClick={() => setCfg((p) => ({ ...p, rsvp_enabled: !p.rsvp_enabled }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${cfg.rsvp_enabled ? 'bg-[#4F46E5]' : 'bg-[#E2E8F0]'}`}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ transform: cfg.rsvp_enabled ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      {cfg.rsvp_enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>RSVP deadline (optional)</label>
              <input
                type="datetime-local"
                value={cfg.rsvp_deadline}
                onChange={(e) => setCfg((p) => ({ ...p, rsvp_deadline: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Overall capacity (optional)</label>
              <input
                type="number"
                min={1}
                value={cfg.rsvp_capacity}
                onChange={(e) => setCfg((p) => ({ ...p, rsvp_capacity: e.target.value }))}
                className={inputClass}
                placeholder="Unlimited"
              />
            </div>
          </div>

          {/* Tiers */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-[#94A3B8] mt-2">Ticket tiers</div>
            {tiers.length === 0 && (
              <div className="text-xs text-[#94A3B8] italic">No tiers yet. Free events can leave this blank; a single implicit "General · Free" tier will be used.</div>
            )}
            {tiers.map((t) => (
              <TierRow key={t.id} tier={t} onSave={onUpsertTier} onDelete={onDeleteTier} />
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_auto] gap-2 pt-2">
              <input value={newTier.name} onChange={(e) => setNewTier({ ...newTier, name: e.target.value })} placeholder="Tier name (e.g. General)" className={inputClass} />
              <input type="number" min={0} step="0.01" value={newTier.price} onChange={(e) => setNewTier({ ...newTier, price: e.target.value })} placeholder="Price $" className={inputClass} />
              <input type="number" min={1} value={newTier.capacity} onChange={(e) => setNewTier({ ...newTier, capacity: e.target.value })} placeholder="Capacity" className={inputClass} />
              <button type="button" onClick={addTier} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#F8FAFC] bg-[#4F46E5]">
                <Plus size={14} />Add
              </button>
            </div>
          </div>

          {/* Stripe note + fee option */}
          {tiers.some(t => t.stripe_enabled) && (
            <div className="space-y-3">
              <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(123, 31, 31, 0.08)', color: '#4F46E5', border: '1px solid rgba(123, 31, 31, 0.25)' }}>
                Stripe-enabled tiers will process payments securely. Ticvite charges no platform fee — only Stripe&apos;s processing fee (2.9% + 30¢) applies.
              </div>
              <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#0F172A' }}>Who pays the processing fee?</div>
                  <div className="text-xs mt-0.5" style={{ color: '#475569' }}>
                    {feePassToBuyer
                      ? 'Buyer pays ticket price + processing fee'
                      : 'You absorb the fee — buyer pays ticket face value only'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs" style={{ color: feePassToBuyer ? '#475569' : '#4F46E5', fontWeight: feePassToBuyer ? 400 : 600 }}>I absorb</span>
                  <button
                    type="button"
                    onClick={() => { setFeePassToBuyer(!feePassToBuyer); onFeeToggle?.(!feePassToBuyer) }}
                    className={`w-11 h-6 rounded-full transition-colors relative ${feePassToBuyer ? 'bg-[#4F46E5]' : 'bg-[#E2E8F0]'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${feePassToBuyer ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs" style={{ color: feePassToBuyer ? '#4F46E5' : '#475569', fontWeight: feePassToBuyer ? 600 : 400 }}>Buyer pays</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelClass}>Payment link (required if any tier is paid without Stripe)</label>
              <input
                value={cfg.payment_link}
                onChange={(e) => setCfg((p) => ({ ...p, payment_link: e.target.value }))}
                placeholder="https://venmo.com/yourhandle or Stripe checkout URL"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Payment instructions for attendees (optional)</label>
              <textarea
                rows={3}
                value={cfg.payment_instructions}
                onChange={(e) => setCfg((p) => ({ ...p, payment_instructions: e.target.value }))}
                placeholder="e.g. Pay via Venmo @host — include your name in the note. Paste the Venmo transaction ID below."
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}

      {/* Promo Codes */}
      {cfg.rsvp_enabled && eventId && tiers.length > 0 && (
        <div className="border-t border-[#E2E8F0] pt-5 mt-2">
          <PromoCodeManager
            eventId={eventId}
            tiers={tiers.map(t => ({ id: t.id, name: t.name }))}
          />
        </div>
      )}

      {/* Automatic Reminders */}
      {cfg.rsvp_enabled && (
        <div className="border-t border-[#E2E8F0] pt-5 mt-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#475569]" />
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Automatic reminders</div>
                <div className="text-xs text-[#94A3B8]">Email ticket holders before and after the event.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCfg((p) => ({ ...p, reminder_enabled: !p.reminder_enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${cfg.reminder_enabled !== false ? 'bg-[#4F46E5]' : 'bg-[#E2E8F0]'}`}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: cfg.reminder_enabled !== false ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>

          {cfg.reminder_enabled !== false && (
            <div className="ml-1 space-y-1.5">
              <ReminderStatusRow
                label="1 day before"
                description="Sent the day before the event"
                sent={reminderStatus?.reminder_1day_sent}
              />
              <ReminderStatusRow
                label="3 hours before"
                description="Sent ~3 hours before start time"
                sent={reminderStatus?.reminder_3hr_sent}
              />
              <ReminderStatusRow
                label="Post-event follow-up"
                description="Sent the day after the event"
                sent={reminderStatus?.reminder_followup_sent}
              />
            </div>
          )}
        </div>
      )}

      {/* Self-cancel toggle */}
      {cfg.rsvp_enabled && (
        <div className="border-t border-[#E2E8F0] pt-5 mt-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-[#475569]" />
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Allow attendees to cancel their own tickets</div>
                <div className="text-xs text-[#94A3B8]">Attendees can cancel from their ticket page or My Tickets. Off by default.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCfg((p) => ({ ...p, allow_self_cancel: !p.allow_self_cancel }))}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${cfg.allow_self_cancel ? 'bg-[#4F46E5]' : 'bg-[#E2E8F0]'}`}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: cfg.allow_self_cancel ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>
      )}

      {/* Email Templates Link */}
      {cfg.rsvp_enabled && eventId && (
        <div className="border-t border-[#E2E8F0] pt-5 mt-2">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-[#475569]" />
            <div>
              <div className="text-sm font-semibold text-[#0F172A]">Email templates</div>
              <div className="text-xs text-[#94A3B8]">
                Customize confirmation, reminder, and follow-up emails.{' '}
                <Link
                  href={`/dashboard/event/${eventId}#emails`}
                  className="text-[#4F46E5] underline hover:opacity-80"
                >
                  Customize email templates &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {msg && <div className="text-xs text-[#475569]">{msg}</div>}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-[#F8FAFC] bg-[#4F46E5] disabled:opacity-60"
        >
          {saving ? 'Saving\u2026' : 'Save RSVP settings'}
        </button>
      </div>
    </div>
  )
}

function ReminderStatusRow({ label, description, sent }: { label: string; description: string; sent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#F8FAFC]">
      <div>
        <div className="text-xs font-medium text-[#334155]">{label}</div>
        <div className="text-[11px] text-[#94A3B8]">{description}</div>
      </div>
      <div className="text-xs font-medium" style={{ color: sent ? '#4CAF50' : '#94A3B8' }}>
        {sent ? 'Sent \u2713' : 'Pending'}
      </div>
    </div>
  )
}

function TierRow({
  tier, onSave, onDelete,
}: {
  tier: EventTier
  onSave: (t: Partial<EventTier>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [name, setName] = useState(tier.name)
  const [price, setPrice] = useState(String(tier.price))
  const [capacity, setCapacity] = useState(tier.capacity == null ? '' : String(tier.capacity))
  const [stripeEnabled, setStripeEnabled] = useState(!!tier.stripe_enabled)
  const changed = name !== tier.name || price !== String(tier.price) || capacity !== (tier.capacity == null ? '' : String(tier.capacity)) || stripeEnabled !== !!tier.stripe_enabled

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm focus:outline-none focus:border-[#4F46E5]'

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_auto_auto] gap-2 items-center">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputClass} placeholder="Uncapped" />
        <button
          type="button"
          onClick={() => onSave({ id: tier.id, name, price: Number(price) || 0, capacity: capacity ? Number(capacity) : null, stripe_enabled: stripeEnabled } as any)}
          disabled={!changed}
          className="px-2.5 py-2 rounded text-xs font-medium text-[#F8FAFC] bg-[#4F46E5] disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => onDelete(tier.id)}
          className="p-2 rounded border border-[#E2E8F0] text-[#94A3B8] hover:text-red-400"
          title="Delete tier"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {Number(price) > 0 && (
        <label className="flex items-center gap-2 ml-0.5 cursor-pointer">
          <input
            type="checkbox"
            checked={stripeEnabled}
            onChange={(e) => setStripeEnabled(e.target.checked)}
            className="accent-[#4F46E5]"
          />
          <span className="text-[11px] text-[#475569]">Accept payment via Stripe (online checkout)</span>
        </label>
      )}
    </div>
  )
}
