/**
 * Webhook dispatcher — fires outgoing webhooks to organizer-registered endpoints.
 *
 * Uses HMAC-SHA256 signatures so recipients can verify authenticity.
 * Fire-and-forget: delivery failures are logged but never block the caller.
 */
import { createHmac } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface WebhookRecord {
  id: string
  url: string
  events: string[]
  secret: string
  is_active: boolean
}

/**
 * Fire webhooks for a given event and event type.
 * This is fire-and-forget — call it without await if you don't need to wait.
 */
export async function fireWebhooks(
  eventId: string,
  eventType: string,
  payload: Record<string, any>,
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Fetch active webhooks for this event that listen to this event type
    const { data: webhooks } = await supabase
      .from('organizer_webhooks')
      .select('id, url, events, secret, is_active')
      .eq('event_id', eventId)
      .eq('is_active', true)

    if (!webhooks?.length) return

    const matching = (webhooks as WebhookRecord[]).filter(
      (w) => w.events.includes(eventType) || w.events.includes('*')
    ).slice(0, 5) // Limit to max 5 webhooks per event to prevent DoS

    if (!matching.length) return

    const deliveryPayload = {
      event_type: eventType,
      event_id: eventId,
      timestamp: new Date().toISOString(),
      data: payload,
    }

    const bodyStr = JSON.stringify(deliveryPayload)

    // Dispatch all webhooks concurrently (fire-and-forget — don't block the caller)
    Promise.allSettled(
      matching.map(async (webhook) => {
        const signature = createHmac('sha256', webhook.secret)
          .update(bodyStr)
          .digest('hex')

        let responseStatus = 0
        let responseBody = ''
        let success = false

        try {
          const resp = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Ticvite-Signature': `sha256=${signature}`,
              'X-Ticvite-Event': eventType,
              'User-Agent': 'Ticvite-Webhook/1.0',
            },
            body: bodyStr,
            signal: AbortSignal.timeout(5000), // 5s timeout
          })
          responseStatus = resp.status
          responseBody = (await resp.text()).slice(0, 1000)
          success = resp.ok
        } catch (err: any) {
          responseBody = err?.message || 'Network error'
        }

        // Log delivery
        await supabase.from('webhook_deliveries').insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload: deliveryPayload,
          response_status: responseStatus || null,
          response_body: responseBody,
          success,
        })
      })
    ).catch(() => {}) // swallow — fire and forget
  } catch (err) {
    console.error('[webhook-dispatcher] Error:', err)
  }
}
