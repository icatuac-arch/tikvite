export interface Order {
  id: string
  event_id: string
  rsvp_id: string | null
  tier_id: string | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  attendee_name: string
  attendee_email: string
  attendee_phone: string
  quantity: number
  unit_price: number
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'refunded' | 'failed' | 'expired'
  notes: string
  created_at: string
  updated_at: string
}

export function computeOrderRevenue(orders: Order[]) {
  return {
    total: orders.reduce((s, o) => s + Number(o.amount), 0),
    paid: orders.filter(o => o.status === 'paid').reduce((s, o) => s + Number(o.amount), 0),
    refunded: orders.filter(o => o.status === 'refunded').reduce((s, o) => s + Number(o.amount), 0),
    pending: orders.filter(o => o.status === 'pending').reduce((s, o) => s + Number(o.amount), 0),
    count: orders.length,
    paidCount: orders.filter(o => o.status === 'paid').length,
  }
}
