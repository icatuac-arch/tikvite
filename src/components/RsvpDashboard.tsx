'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, Users, Download, Ticket, Mail, DollarSign, RotateCcw, Pencil, Save, X, Printer } from 'lucide-react'
import { aggregateRsvps, computeTierOccupancy } from '@/lib/rsvp'
import type { EventTier, EventRsvp, RsvpStatus } from '@/lib/rsvp'
import type { Ticket as TicketType } from '@/lib/types'
import type { Order } from '@/lib/orders'
import { computeOrderRevenue } from '@/lib/orders'

/**
 * Shared RSVP dashboard — used by both the registered publisher view
 * (/dashboard/rsvps) and the guest publisher magic-link view (/g/[token]).
 * Parent controls how each mutation reaches the server (the two use
 * different API bases + auth); this component only knows about the
 * callbacks.
 */
interface Props {
  eventTitle: string
  eventDate: string
  eventId?: string
  tiers: EventTier[]
  rsvps: EventRsvp[]
  tickets?: TicketType[]
  orders?: Order[]
  onStatusChange?: (rsvpId: string, next: RsvpStatus) => Promise<void>
  onResendTicketEmail?: (rsvpId: string) => Promise<void>
  onRefund?: (orderId: string) => Promise<void>
  onCancelRsvpAndTickets?: (rsvpId: string) => Promise<void>
  onEditAttendee?: (rsvpId: string, data: { attendee_name?: string; attendee_email?: string; attendee_phone?: string }) => Promise<void>
}

const STATUS_ORDER: RsvpStatus[] = ['confirmed', 'pending', 'waitlist', 'attended', 'cancelled']
const STATUS_LABEL: Record<RsvpStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  waitlist: 'Waitlist',
  attended: 'Attended',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<RsvpStatus, string> = {
  confirmed: '#4F8C4F',
  pending: '#4F46E5',
  waitlist: '#4F46E5',
  attended: '#2E7D32',
  cancelled: '#7B6C55',
}

export default function RsvpDashboard({ eventTitle, eventDate, eventId, tiers, rsvps, tickets, orders, onStatusChange, onResendTicketEmail, onRefund, onCancelRsvpAndTickets, onEditAttendee }: Props) {
  const [resending, setResending] = useState<string | null>(null)
  const [refunding, setRefunding] = useState<string | null>(null)
  const [cancellingRsvp, setCancellingRsvp] = useState<string | null>(null)
  const [editingRsvp, setEditingRsvp] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' })
  const [editSaving, setEditSaving] = useState(false)

  const orderRevenue = useMemo(() => computeOrderRevenue(orders || []), [orders])
  const compTicketCount = useMemo(() => (tickets || []).filter((t) => t.is_comp).length, [tickets])

  // Map rsvp_id -> order for payment badge display
  const orderByRsvpId = useMemo(() => {
    const map = new Map<string, Order>()
    for (const o of (orders || [])) {
      if (o.rsvp_id) map.set(o.rsvp_id, o)
    }
    return map
  }, [orders])

  const handleRefund = async (orderId: string) => {
    if (!onRefund) return
    if (!window.confirm('Issue a full refund for this order? This will cancel the RSVP and tickets.')) return
    setRefunding(orderId)
    try {
      await onRefund(orderId)
    } finally {
      setRefunding(null)
    }
  }

  const handleCancelRsvpAndTickets = async (rsvpId: string) => {
    if (!onCancelRsvpAndTickets) return
    if (!window.confirm('Cancel this RSVP and revoke all associated tickets? The attendee will be notified by email.')) return
    setCancellingRsvp(rsvpId)
    try {
      await onCancelRsvpAndTickets(rsvpId)
    } finally {
      setCancellingRsvp(null)
    }
  }

  // Helper: get tickets for an RSVP
  const getTicketsForRsvp = (rsvpId: string) => (tickets || []).filter((t) => t.rsvp_id === rsvpId)

  const startEdit = (r: EventRsvp) => {
    setEditingRsvp(r.id)
    setEditForm({ name: r.attendee_name, email: r.attendee_email, phone: r.attendee_phone || '' })
  }

  const handleEditSave = async (rsvpId: string) => {
    if (!onEditAttendee) return
    setEditSaving(true)
    try {
      await onEditAttendee(rsvpId, {
        attendee_name: editForm.name,
        attendee_email: editForm.email,
        attendee_phone: editForm.phone,
      })
      setEditingRsvp(null)
    } finally {
      setEditSaving(false)
    }
  }

  const handleResend = async (rsvpId: string) => {
    if (!onResendTicketEmail) return
    setResending(rsvpId)
    try {
      await onResendTicketEmail(rsvpId)
    } finally {
      setResending(null)
    }
  }
  const [statusFilter, setStatusFilter] = useState<RsvpStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const agg = useMemo(() => aggregateRsvps(rsvps, tiers), [rsvps, tiers])
  const occupancy = useMemo(() => computeTierOccupancy(tiers, rsvps), [tiers, rsvps])

  const filteredRsvps = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rsvps
      .filter((r) => statusFilter === 'all' ? true : r.status === statusFilter)
      .filter((r) =>
        !q
          ? true
          : r.attendee_name.toLowerCase().includes(q) ||
            r.attendee_email.toLowerCase().includes(q) ||
            r.confirmation_code.toLowerCase().includes(q),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [rsvps, statusFilter, search])

  function downloadCsv() {
    const rows = [
      ['confirmation_code', 'status', 'name', 'email', 'phone', 'tier', 'quantity', 'payment_confirmation', 'notes', 'created_at', 'checked_in_at'],
      ...rsvps.map((r) => {
        const tierName = tiers.find((t) => t.id === r.tier_id)?.name || ''
        return [
          r.confirmation_code, r.status, r.attendee_name, r.attendee_email, r.attendee_phone,
          tierName, String(r.quantity), r.payment_confirmation, r.notes, r.created_at, r.checked_in_at || '',
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((c) => {
      const s = (c ?? '').toString()
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rsvps-${eventTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${eventDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Aggregate counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <CountCard label="Total RSVPs" value={agg.total} icon={<Users size={16} />} />
        <CountCard label="Confirmed seats" value={agg.seatsConfirmed} icon={<CheckCircle2 size={16} />} />
        <CountCard label="Pending" value={agg.pending} icon={<Clock size={16} />} />
        <CountCard label="Comp tickets" value={compTicketCount} icon={<Ticket size={16} />} />
        {orderRevenue.paidCount > 0 ? (
          <CountCard label="Stripe revenue" value={`$${orderRevenue.paid.toFixed(2)}`} icon={<DollarSign size={16} />} accent />
        ) : (
          <CountCard label="Reported $" value={`$${agg.reportedRevenue.toFixed(2)}`} icon={<CheckCircle2 size={16} />} accent />
        )}
      </div>

      {/* Per-tier occupancy */}
      {occupancy.length > 0 && (
        <div className="rounded-xl border p-4 bg-[#FFFFFF] border-[#E2E8F0]">
          <div className="text-xs uppercase tracking-wider text-[#94A3B8] mb-3">By tier</div>
          <div className="space-y-2">
            {occupancy.map((o) => (
              <div key={o.tier.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#0F172A] truncate">
                    {o.tier.name} · {Number(o.tier.price) > 0 ? `$${Number(o.tier.price).toFixed(2)}` : 'Free'}
                  </div>
                </div>
                <div className="text-sm text-[#334155] flex-shrink-0">
                  {o.seatsTaken}
                  {o.tier.capacity != null && ` / ${o.tier.capacity}`}
                </div>
                {o.waitlistCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(160, 82, 45, 0.2)', color: '#4F46E5' }}>
                    +{o.waitlistCount} waitlist
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as any)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? 'text-[#F8FAFC] bg-[#4F46E5]' : 'text-[#475569] border border-[#E2E8F0] hover:text-[#0F172A]'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s as RsvpStatus]}
              {s !== 'all' && (
                <span className="ml-1 opacity-70">{agg[s as RsvpStatus]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[180px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or code\u2026"
            className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-sm"
          />
        </div>
        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]"
        >
          <Download size={13} />
          CSV
        </button>
        {eventId && (
          <button
            onClick={() => window.open(`/api/events/${eventId}/checkin-list`, '_blank')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A]"
          >
            <Printer size={13} />
            Print List
          </button>
        )}
      </div>

      {/* Attendee list */}
      <div className="rounded-xl border bg-[#FFFFFF] border-[#E2E8F0] overflow-hidden">
        {filteredRsvps.length === 0 ? (
          <div className="p-8 text-center text-[#94A3B8] text-sm">No RSVPs match the current filter.</div>
        ) : (
          <ul>
            {filteredRsvps.map((r, i) => {
              const tier = tiers.find((t) => t.id === r.tier_id)
              return (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.24) }}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-[#E2E8F0] last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0F172A] truncate">{r.attendee_name}</span>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: STATUS_COLOR[r.status] + '30',
                          color: STATUS_COLOR[r.status],
                        }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <div className="text-xs text-[#475569] truncate">
                      {r.attendee_email}
                      {r.attendee_phone && ` \u00B7 ${r.attendee_phone}`}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      {tier ? `${tier.name} \u00D7 ${r.quantity}` : `\u00D7 ${r.quantity}`}
                      {' \u00B7 '}
                      <span className="font-mono">{r.confirmation_code}</span>
                      {r.payment_confirmation && (
                        <span> \u00B7 pay: <span className="font-mono">{r.payment_confirmation}</span></span>
                      )}
                    </div>
                    {r.notes && (
                      <div className="text-[11px] text-[#94A3B8] mt-1 italic">&quot;{r.notes}&quot;</div>
                    )}
                    {/* Ticket info */}
                    {tickets && (() => {
                      const rTickets = getTicketsForRsvp(r.id)
                      if (rTickets.length === 0) return null
                      const activeCount = rTickets.filter(t => t.status === 'active').length
                      const usedCount = rTickets.filter(t => t.status === 'used').length
                      const cancelledCount = rTickets.filter(t => t.status === 'cancelled' || t.status === 'revoked').length
                      return (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                            <Ticket size={10} />
                            {rTickets.length} ticket{rTickets.length !== 1 ? 's' : ''}
                          </span>
                          {activeCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{activeCount} active</span>
                          )}
                          {usedCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{usedCount} checked in</span>
                          )}
                          {cancelledCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{cancelledCount} cancelled</span>
                          )}
                          {usedCount > 0 && (() => {
                            const lastCheckin = rTickets
                              .filter(t => t.checked_in_at)
                              .sort((a, b) => (b.checked_in_at || '').localeCompare(a.checked_in_at || ''))[0]
                            if (!lastCheckin?.checked_in_at) return null
                            return (
                              <span className="text-[10px] text-[#94A3B8]">
                                last check-in {new Date(lastCheckin.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            )
                          })()}
                        </div>
                      )
                    })()}
                  </div>
                  {/* Edit attendee inline form */}
                  {editingRsvp === r.id && (
                    <div className="w-full mt-2 p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Name"
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] text-xs"
                        />
                        <input
                          value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="Email"
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] text-xs"
                        />
                        <input
                          value={editForm.phone}
                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="Phone"
                          className="px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditSave(r.id)}
                          disabled={editSaving}
                          className="px-3 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Save size={11} />
                          {editSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingRsvp(null)}
                          className="px-3 py-1 rounded text-xs font-medium text-[#475569] border border-[#E2E8F0] hover:text-[#0F172A] flex items-center gap-1"
                        >
                          <X size={11} /> Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Edit button */}
                  {onEditAttendee && editingRsvp !== r.id && (
                    <button
                      onClick={() => startEdit(r)}
                      className="px-2 py-1 rounded text-xs font-medium text-[#94A3B8] hover:text-[#0F172A] border border-[#E2E8F0] hover:border-[#94A3B8] flex items-center gap-1 flex-shrink-0"
                      title="Edit attendee details"
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                  )}
                  {/* Payment badge */}
                  {(() => {
                    const order = orderByRsvpId.get(r.id)
                    if (!order) return null
                    const badgeColors: Record<string, { bg: string; fg: string }> = {
                      paid: { bg: 'rgba(46, 125, 50, 0.15)', fg: '#2E7D32' },
                      refunded: { bg: 'rgba(183, 28, 28, 0.15)', fg: '#B71C1C' },
                      pending: { bg: 'rgba(123, 31, 31, 0.15)', fg: '#4F46E5' },
                      failed: { bg: 'rgba(183, 28, 28, 0.15)', fg: '#B71C1C' },
                      expired: { bg: 'rgba(120, 120, 120, 0.15)', fg: '#888' },
                    }
                    const bc = badgeColors[order.status] || badgeColors.pending
                    return (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: bc.bg, color: bc.fg }}
                        >
                          {order.status === 'paid' ? `Paid $${Number(order.amount).toFixed(2)}` : order.status}
                        </span>
                        {onRefund && order.status === 'paid' && (
                          <button
                            onClick={() => handleRefund(order.id)}
                            disabled={refunding === order.id}
                            className="px-2 py-1 rounded text-xs font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1"
                            title="Issue refund"
                          >
                            <RotateCcw size={11} />
                            {refunding === order.id ? 'Refunding...' : 'Refund'}
                          </button>
                        )}
                      </div>
                    )
                  })()}
                  {onResendTicketEmail && getTicketsForRsvp(r.id).length > 0 && (
                    <button
                      onClick={() => handleResend(r.id)}
                      disabled={resending === r.id}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50 flex items-center gap-1"
                      title="Resend ticket email"
                    >
                      <Mail size={12} />
                      {resending === r.id ? 'Sending...' : 'Resend'}
                    </button>
                  )}
                  {onStatusChange && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {r.status !== 'attended' && (r.status === 'confirmed' || r.status === 'pending') && (
                        <button
                          onClick={() => onStatusChange(r.id, 'attended')}
                          className="px-2.5 py-1 rounded text-xs font-medium border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          title="Mark as checked in"
                        >
                          Check in
                        </button>
                      )}
                      {r.status === 'waitlist' && (
                        <button
                          onClick={() => onStatusChange(r.id, 'confirmed')}
                          className="px-2.5 py-1 rounded text-xs font-medium border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          Promote
                        </button>
                      )}
                      {r.status === 'pending' && (
                        <button
                          onClick={() => onStatusChange(r.id, 'confirmed')}
                          className="px-2.5 py-1 rounded text-xs font-medium border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          Confirm
                        </button>
                      )}
                      {r.status !== 'cancelled' && (
                        <button
                          onClick={() => onStatusChange(r.id, 'cancelled')}
                          className="p-1.5 rounded border border-[#E2E8F0] text-[#94A3B8] hover:text-red-400"
                          title="Cancel this RSVP"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  {onCancelRsvpAndTickets && r.status !== 'cancelled' && getTicketsForRsvp(r.id).length > 0 && (
                    <button
                      onClick={() => handleCancelRsvpAndTickets(r.id)}
                      disabled={cancellingRsvp === r.id}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1"
                      title="Cancel RSVP and revoke all tickets"
                    >
                      <XCircle size={12} />
                      {cancellingRsvp === r.id ? 'Cancelling...' : 'Cancel & Revoke Tickets'}
                    </button>
                  )}
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function CountCard({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className="rounded-xl border p-3 bg-[#FFFFFF] border-[#E2E8F0]"
    >
      <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-1" style={{ color: accent ? '#4F46E5' : undefined }}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-semibold text-[#0F172A]">{value}</div>
    </div>
  )
}
