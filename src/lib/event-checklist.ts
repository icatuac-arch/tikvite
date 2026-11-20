import type { Event } from '@/lib/types'
import type { EventTier } from '@/lib/rsvp'

export interface ChecklistItem {
  key: string
  label: string
  complete: boolean
  required: boolean
  section: string
  fixLabel?: string
}

export function getEventChecklist(event: Event, tiers: EventTier[]): {
  items: ChecklistItem[]
  complete: number
  total: number
  requiredComplete: number
  requiredTotal: number
  ready: boolean
  status: 'draft' | 'ready' | 'live'
} {
  const items: ChecklistItem[] = [
    { key: 'title', label: 'Event title', complete: !!(event.title?.trim() && event.title.trim().length >= 3), required: true, section: 'details', fixLabel: 'Add title' },
    { key: 'category', label: 'Category', complete: !!event.category, required: true, section: 'details', fixLabel: 'Choose category' },
    { key: 'description', label: 'Description', complete: !!(event.description?.trim() && event.description.trim().length > 20), required: true, section: 'details', fixLabel: 'Add description' },
    { key: 'date', label: 'Event date', complete: !!event.date, required: true, section: 'datetime', fixLabel: 'Set date' },
    { key: 'time', label: 'Event time', complete: !!event.time?.trim(), required: true, section: 'datetime', fixLabel: 'Set time' },
    { key: 'venue', label: 'Venue name', complete: !!event.venue?.trim(), required: true, section: 'location', fixLabel: 'Add venue' },
    { key: 'city', label: 'City & State', complete: !!(event.city?.trim() && event.state?.trim()), required: true, section: 'location', fixLabel: 'Set city & state' },
    { key: 'metro', label: 'Metro region', complete: !!(event.metro_region?.trim() && event.metro_region !== 'Other'), required: true, section: 'location', fixLabel: 'Set metro region' },
    { key: 'poster', label: 'Event poster', complete: !!event.image_url, required: true, section: 'poster', fixLabel: 'Upload poster' },
    { key: 'tickets', label: 'Ticket / Registration', complete: hasTicketSetup(event, tiers), required: true, section: 'tickets', fixLabel: 'Set up tickets' },
  ]

  const complete = items.filter(i => i.complete).length
  const requiredItems = items.filter(i => i.required)
  const requiredComplete = requiredItems.filter(i => i.complete).length
  const allRequiredDone = requiredItems.every(i => i.complete)

  let status: 'draft' | 'ready' | 'live' = 'draft'
  if (event.status === 'published') status = 'live'
  else if (allRequiredDone) status = 'ready'

  return {
    items,
    complete,
    total: items.length,
    requiredComplete,
    requiredTotal: requiredItems.length,
    ready: allRequiredDone,
    status,
  }
}

function hasTicketSetup(event: Event, tiers: EventTier[]): boolean {
  // External ticket URL is valid setup
  if (event.ticket_url?.trim()) return true
  // Internal RSVP with at least 1 tier is valid
  if ((event as any).rsvp_enabled && tiers.length > 0) return true
  return false
}
