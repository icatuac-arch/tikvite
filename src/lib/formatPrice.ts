/**
 * Determine if an event is free or paid from the price string,
 * and return a display-friendly label.
 *
 * The price field can be: "Free", "Paid", "$40", "$25-$50",
 * "See ticket page", "", null, etc.
 */

const FREE_PATTERNS = /^free$|^free\s|free entry|free admission|free event|no charge|complimentary|^0$|^\$0$/i

export function isFreeEvent(price: string | null | undefined): boolean {
  if (!price || price.trim() === '') return false
  return FREE_PATTERNS.test(price.trim())
}

/**
 * Returns what to show on the badge:
 * - "Free" for free events
 * - The actual price string for paid events (e.g. "$40", "$25-$50")
 * - "Paid" if price is literally "Paid" or empty with a ticket URL
 */
export function getPriceBadge(price: string | null | undefined): { label: string; isFree: boolean } {
  if (!price || price.trim() === '') {
    return { label: 'Paid', isFree: false }
  }
  const trimmed = price.trim()
  if (isFreeEvent(trimmed)) {
    return { label: 'Free', isFree: true }
  }
  if (trimmed === 'Paid') {
    return { label: 'Paid', isFree: false }
  }
  // Show actual price (e.g. "$40", "$25-$50", "From $15")
  return { label: trimmed, isFree: false }
}
