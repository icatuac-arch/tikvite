import { createClient } from '@supabase/supabase-js'
import CheckoutSuccessPoller from './CheckoutSuccessPoller'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface PageProps {
  searchParams: { session_id?: string }
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const sessionId = searchParams.session_id
  if (!sessionId) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
            <p className="text-lg">Missing session. Please check your email for confirmation.</p>
          </div>
        </main>
        
      </div>
    )
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Fetch order by session ID
  const { data: order } = await supabase
    .from('orders')
    .select('*, events:event_id(title, date, venue, city)')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle()

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center" style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}>
            <p className="text-lg">Order not found. Please check your email for confirmation.</p>
          </div>
        </main>
        
      </div>
    )
  }

  const event = (order as any).events || {}
  const isPaid = order.status === 'paid'

  // If paid, fetch tickets
  let tickets: any[] = []
  if (isPaid && order.rsvp_id) {
    const { data: t } = await supabase
      .from('tickets')
      .select('ticket_number, qr_token, status')
      .eq('rsvp_id', order.rsvp_id)
      .eq('status', 'active')
    tickets = t || []
  }

  // Fetch RSVP confirmation code
  let confirmationCode = ''
  if (isPaid && order.rsvp_id) {
    const { data: rsvp } = await supabase
      .from('event_rsvps')
      .select('confirmation_code')
      .eq('id', order.rsvp_id)
      .single()
    confirmationCode = rsvp?.confirmation_code || ''
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ticvite.com'

  if (!isPaid) {
    // Still pending -- show polling UI
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        
        <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-16 w-full">
          <CheckoutSuccessPoller sessionId={sessionId} />
        </main>
        
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Success card */}
        <div
          className="rounded-2xl border p-6 sm:p-8 space-y-5"
          style={{ backgroundColor: '#F0FAF0', borderColor: '#D1FAE5' }}
        >
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D7A3A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: '#0F172A', fontFamily: 'Plus Jakarta Sans, serif' }}
            >
              Payment Confirmed!
            </h1>
            <p className="text-sm" style={{ color: '#334155' }}>
              Your tickets for <strong>{event.title}</strong> are ready.
            </p>
          </div>

          {/* Order summary */}
          <div
            className="rounded-xl border p-4"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4F46E5' }}>
              Order Summary
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: '#334155' }}>
              <div>
                <div className="text-[11px]" style={{ color: '#94A3B8' }}>Event</div>
                <div className="font-semibold">{event.title}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: '#94A3B8' }}>Date</div>
                <div className="font-semibold">{event.date}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: '#94A3B8' }}>Venue</div>
                <div className="font-semibold">{event.venue || event.city}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: '#94A3B8' }}>Amount Paid</div>
                <div className="font-semibold">${Number(order.amount).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: '#94A3B8' }}>Tickets</div>
                <div className="font-semibold">{order.quantity}</div>
              </div>
              <div>
                <div className="text-[11px]" style={{ color: '#94A3B8' }}>Attendee</div>
                <div className="font-semibold">{order.attendee_name}</div>
              </div>
            </div>
          </div>

          {/* Confirmation code */}
          {confirmationCode && (
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
                {confirmationCode}
              </div>
            </div>
          )}

          {/* Tickets */}
          {tickets.length > 0 && (
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4F46E5' }}>
                Your Ticket{tickets.length > 1 ? 's' : ''}
              </div>
              {tickets.map((t: any) => (
                <a
                  key={t.ticket_number}
                  href={`${siteUrl}/ticket/${encodeURIComponent(t.ticket_number)}`}
                  className="flex items-center justify-between py-2.5 transition-colors hover:opacity-80"
                  style={{
                    borderBottom: '1px solid #E2E8F0',
                    color: '#334155',
                    textDecoration: 'none',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
                    <span className="font-mono text-sm font-medium" style={{ color: '#0F172A' }}>
                      {t.ticket_number}
                    </span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: '#4F46E5' }}>
                    View &rarr;
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* What's next */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ backgroundColor: 'rgba(253,248,240,0.8)', border: '1px solid #E2E8F0' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4F46E5' }}>
              What&apos;s next
            </div>
            <ul className="space-y-2 text-sm" style={{ color: '#334155' }}>
              <li className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <span>Check <strong>{order.attendee_email}</strong> for your ticket{tickets.length > 1 ? 's' : ''} and QR code</span>
              </li>
              <li className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
                Show your QR code at the door for check-in
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {tickets.length > 0 && (
              <a
                href={`${siteUrl}/ticket/${encodeURIComponent(tickets[0].ticket_number)}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
              >
                View My Ticket{tickets.length > 1 ? 's' : ''}
              </a>
            )}
            <a
              href={siteUrl}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border"
              style={{ borderColor: '#E2E8F0', color: '#475569' }}
            >
              Browse More Events
            </a>
          </div>
        </div>
      </main>
      
    </div>
  )
}
