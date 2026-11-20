import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
    stripeInstance = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any })
  }
  return stripeInstance
}

export function verifyWebhookSignature(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  return getStripe().webhooks.constructEvent(rawBody, signature, secret)
}
