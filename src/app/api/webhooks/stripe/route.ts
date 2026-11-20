/**
 * Stripe webhook handler.
 *
 * Listens for checkout.session.completed, checkout.session.expired,
 * and charge.refunded events. On successful payment: creates RSVP,
 * generates tickets, and sends the confirmation email.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from '@/lib/stripe'
import { generateConfirmationCode } from '@/lib/rsvp'
import { createTicketsForRsvp } from '@/lib/tickets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: any
  try {
    event = verifyWebhookSignature(rawBody, sig)
  } catch (err: any) {
    console.warn('[webhook] signature verification failed:', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Idempotency: attempt INSERT with ON CONFLICT DO NOTHING.
  // If the insert succeeds, we own this event. If it conflicts, another request already claimed it.
  const { error: claimErr } = await supabase
    .from('stripe_webhook_events')
    .insert({ id: event.id, type: event.type, status: 'processing' })

  if (claimErr) {
    // Insert failed — row already exists. Check its status.
    const { data: existing } = await supabase
      .from('stripe_webhook_events')
      .select('id, status')
      .eq('id', event.id)
      .single()
    if (existing?.status === 'done') {
      return NextResponse.json({ ok: true, message: 'Already processed' })
    }
    // Status is 'processing' or 'failed' — another request is handling it or it can be retried by Stripe
    return NextResponse.json({ ok: true, message: 'Already being processed' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const meta = session.metadata || {}
        const orderId = meta.order_id
        if (!orderId) {
          console.warn('[webhook] checkout.session.completed missing order_id in metadata')
          break
        }

        // Verify order exists and is pending
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()
        if (!order) {
          console.warn('[webhook] order not found:', orderId)
          break
        }
        if (order.status !== 'pending') {
          console.warn('[webhook] order already processed:', orderId, order.status)
          break
        }

        // Update order to paid
        await supabase.from('orders').update({
          status: 'paid',
          stripe_payment_intent_id: session.payment_intent || null,
          updated_at: new Date().toISOString(),
        }).eq('id', orderId)

        // Fetch event details for ticket email
        const { data: eventRow } = await supabase
          .from('events')
          .select('id, title, date, venue, city, publisher_name')
          .eq('id', meta.event_id)
          .single()
        if (!eventRow) {
          console.warn('[webhook] event not found:', meta.event_id)
          break
        }

        // Create RSVP row
        const confirmationCode = generateConfirmationCode()
        const { data: rsvp, error: rsvpErr } = await supabase.from('event_rsvps').insert({
          event_id: meta.event_id,
          tier_id: meta.tier_id || null,
          attendee_name: meta.attendee_name || order.attendee_name,
          attendee_email: meta.attendee_email || order.attendee_email,
          attendee_phone: meta.attendee_phone || order.attendee_phone || '',
          quantity: parseInt(meta.quantity, 10) || order.quantity,
          payment_confirmation: `Stripe:${session.payment_intent || session.id}`,
          status: 'confirmed',
          notes: order.notes || '',
          confirmation_code: confirmationCode,
        }).select('id').single()

        if (rsvpErr || !rsvp) {
          console.error('[webhook] RSVP creation failed:', rsvpErr?.message)
          break
        }

        // Link order to RSVP
        await supabase.from('orders').update({ rsvp_id: rsvp.id }).eq('id', orderId)

        // Increment promo code used_count if a promo code was used
        const promoId = meta.promo_code_id || ''
        if (promoId) {
          const { data: promo } = await supabase
            .from('promo_codes')
            .select('id, used_count')
            .eq('id', promoId)
            .single()
          if (promo) {
            await supabase
              .from('promo_codes')
              .update({ used_count: (promo.used_count || 0) + 1 })
              .eq('id', promo.id)
            // Store promo_code_id on the RSVP for per-email enforcement
            await supabase
              .from('event_rsvps')
              .update({ promo_code_id: promo.id })
              .eq('id', rsvp.id)
          }
        }

        // Create tickets and send email
        const ticketResult = await createTicketsForRsvp(supabase, {
          eventId: meta.event_id,
          rsvpId: rsvp.id,
          tierId: meta.tier_id || null,
          holderName: meta.attendee_name || order.attendee_name,
          holderEmail: meta.attendee_email || order.attendee_email,
          quantity: parseInt(meta.quantity, 10) || order.quantity,
          eventTitle: eventRow.title,
          eventDate: eventRow.date,
          eventVenue: eventRow.venue || eventRow.city || '',
        })

        // If seat_ids in metadata, mark session_seats as sold
        if (meta.seat_ids) {
          try {
            const seatIds: string[] = JSON.parse(meta.seat_ids)
            if (seatIds.length > 0) {
              // Get ticket IDs created for this RSVP
              const { data: tickets } = await supabase
                .from('tickets')
                .select('id')
                .eq('rsvp_id', rsvp.id)
                .order('created_at')

              const ticketIds = (tickets || []).map((t: any) => t.id)

              for (let i = 0; i < seatIds.length; i++) {
                await supabase
                  .from('session_seats')
                  .update({
                    status: 'sold',
                    order_id: orderId,
                    ticket_id: ticketIds[i] || null,
                    held_by: null,
                    hold_expires_at: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('event_id', meta.event_id)
                  .eq('seat_id', seatIds[i])

                // Store seat info on the ticket
                if (ticketIds[i]) {
                  await supabase
                    .from('tickets')
                    .update({
                      seat_info: { seat_id: seatIds[i] },
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', ticketIds[i])
                }
              }

              console.log(`[webhook] Marked ${seatIds.length} seats as sold for order ${orderId}`)
            }
          } catch (seatErr: any) {
            console.error('[webhook] Error updating session_seats:', seatErr?.message)
          }
        }

        console.log('[webhook] checkout.session.completed processed:', orderId)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object
        const meta = session.metadata || {}
        const orderId = meta.order_id
        if (orderId) {
          await supabase.from('orders').update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          }).eq('id', orderId).eq('status', 'pending')
          console.log('[webhook] checkout.session.expired processed:', orderId)
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object
        const paymentIntentId = charge.payment_intent
        if (!paymentIntentId) break

        // Find order by payment intent
        const { data: order } = await supabase
          .from('orders')
          .select('id, rsvp_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single()
        if (!order) {
          console.warn('[webhook] charge.refunded — order not found for PI:', paymentIntentId)
          break
        }

        // Update order
        await supabase.from('orders').update({
          status: 'refunded',
          updated_at: new Date().toISOString(),
        }).eq('id', order.id)

        // Cancel linked RSVP
        if (order.rsvp_id) {
          await supabase.from('event_rsvps').update({
            status: 'cancelled',
          }).eq('id', order.rsvp_id)

          // Cancel linked tickets
          await supabase.from('tickets').update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          }).eq('rsvp_id', order.rsvp_id)
        }

        console.log('[webhook] charge.refunded processed:', order.id)
        break
      }

      default:
        console.log('[webhook] unhandled event type:', event.type)
    }
  } catch (err: any) {
    console.error('[webhook] processing error:', err?.message)
    // Mark as failed so retries can re-attempt
    await supabase.from('stripe_webhook_events')
      .update({ status: 'failed' })
      .eq('id', event.id)
    // Still return 200 so Stripe doesn't retry
  }

  // Mark as done after successful processing
  await supabase.from('stripe_webhook_events')
    .update({ status: 'done' })
    .eq('id', event.id)

  return NextResponse.json({ ok: true })
}
