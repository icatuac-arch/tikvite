'use client'

import { useState } from 'react'
import Link from 'next/link'
import RsvpDashboard from '@/components/RsvpDashboard'
import RsvpConfigPanel from '@/components/RsvpConfigPanel'
import type { EventTier, EventRsvp, RsvpStatus } from '@/lib/rsvp'
import type { Ticket } from '@/lib/types'
import type { Order } from '@/lib/orders'

/**
 * Client wrapper for the registered publisher RSVP dashboard. Mirrors
 * the guest management page but calls /api/rsvp-manage with the SSR
 * cookie (no token in body). Same shared components, same UX.
 */
interface Props {
  event: any
  initialTiers: EventTier[]
  initialRsvps: EventRsvp[]
  initialTickets?: Ticket[]
  initialOrders?: Order[]
}

export default function PublisherRsvpClient({ event, initialTiers, initialRsvps, initialTickets, initialOrders }: Props) {
  const [tiers, setTiers] = useState(initialTiers)
  const [rsvps, setRsvps] = useState(initialRsvps)
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets || [])
  const [orders, setOrders] = useState<Order[]>(initialOrders || [])
  const [cfg, setCfg] = useState({
    rsvp_enabled: !!event.rsvp_enabled,
    rsvp_deadline: event.rsvp_deadline || '',
    rsvp_capacity: event.rsvp_capacity ?? '',
    payment_link: event.payment_link || '',
    payment_instructions: event.payment_instructions || '',
    reminder_enabled: event.reminder_enabled !== false,
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function callManage(body: any) {
    const resp = await fetch('/api/rsvp-manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, event_id: event.id }),
    })
    const data = await resp.json()
    if (!resp.ok || !data?.ok) throw new Error(data?.error || 'Update failed')
    return data
  }

  async function refreshLists() {
    const resp = await fetch(`/api/rsvp-manage?event_id=${event.id}`)
    if (resp.ok) {
      const data = await resp.json()
      if (data.tiers) setTiers(data.tiers)
      if (data.rsvps) setRsvps(data.rsvps)
      if (data.tickets) setTickets(data.tickets)
      if (data.orders) setOrders(data.orders)
    }
  }

  async function editAttendee(rsvpId: string, data: { attendee_name?: string; attendee_email?: string; attendee_phone?: string }) {
    try {
      await callManage({ action: 'edit_attendee', rsvp_id: rsvpId, ...data })
      await refreshLists()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function resendTicketEmail(rsvpId: string) {
    try {
      await callManage({ action: 'resend_ticket_email', rsvp_id: rsvpId })
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function refundOrder(orderId: string) {
    try {
      await callManage({ action: 'refund_order', order_id: orderId })
      await refreshLists()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function onStatusChange(rsvpId: string, next: RsvpStatus) {
    try {
      await callManage({ action: 'set_rsvp_status', rsvp_id: rsvpId, status: next })
      setRsvps((prev) => prev.map((r) => r.id === rsvpId ? { ...r, status: next, checked_in_at: next === 'attended' ? new Date().toISOString() : null } : r))
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function saveConfig() {
    setSaving(true); setMsg(null)
    try {
      await callManage({
        action: 'update_event_rsvp_config',
        rsvp_enabled: cfg.rsvp_enabled,
        rsvp_deadline: cfg.rsvp_deadline || null,
        rsvp_capacity: cfg.rsvp_capacity === '' ? null : cfg.rsvp_capacity,
        payment_link: cfg.payment_link,
        payment_instructions: cfg.payment_instructions,
        reminder_enabled: cfg.reminder_enabled,
      })
      setMsg('Saved.')
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelRsvpAndTickets(rsvpId: string) {
    try {
      await callManage({ action: 'cancel_rsvp_and_tickets', rsvp_id: rsvpId })
      await refreshLists()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function upsertTier(tier: Partial<EventTier>) {
    try {
      await callManage({ action: 'upsert_tier', tier })
      await refreshLists()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function deleteTier(tierId: string) {
    try {
      await callManage({ action: 'delete_tier', tier_id: tierId })
      setTiers((prev) => prev.filter((t) => t.id !== tierId))
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  return (
    <div className="space-y-8" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div>
        <Link href="/dashboard" className="text-xs uppercase tracking-wider" style={{ color: '#4F46E5' }}>
          ← Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight mt-1" style={{ fontFamily: 'Plus Jakarta Sans, serif' }}>
          {event.title}
        </h1>
        <p className="text-sm text-[#475569] mt-1">{event.date} · {event.city}</p>
      </div>

      <RsvpConfigPanel
        eventId={event.id}
        cfg={cfg}
        setCfg={setCfg}
        tiers={tiers}
        onSave={saveConfig}
        onUpsertTier={upsertTier}
        onDeleteTier={deleteTier}
        saving={saving}
        msg={msg}
        reminderStatus={{
          reminder_1day_sent: !!event.reminder_1day_sent,
          reminder_3hr_sent: !!event.reminder_3hr_sent,
          reminder_followup_sent: !!event.reminder_followup_sent,
        }}
      />

      {cfg.rsvp_enabled && (
        <RsvpDashboard
          eventTitle={event.title}
          eventDate={event.date}
          eventId={event.id}
          tiers={tiers}
          rsvps={rsvps}
          tickets={tickets}
          orders={orders}
          onStatusChange={onStatusChange}
          onResendTicketEmail={resendTicketEmail}
          onRefund={refundOrder}
          onCancelRsvpAndTickets={cancelRsvpAndTickets}
          onEditAttendee={editAttendee}
        />
      )}
    </div>
  )
}
