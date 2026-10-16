export interface Profile {
  id: string
  name: string
  email: string
  role: 'visitor' | 'publisher' | 'admin'
  slug: string | null
  bio: string
  suspended: boolean
  joined_at: string
}

export interface Event {
  id: string
  title: string
  category: string
  description: string
  venue: string
  address: string
  city: string
  metro_region: string
  state: string
  zip_code: string
  date: string
  time: string
  ticket_url: string
  price: 'Free' | 'Paid'
  language: string
  image_url: string
  source: 'manual' | 'crawler' | 'api'
  rsvp_enabled?: boolean
  rsvp_deadline?: string | null
  rsvp_capacity?: number | null
  payment_link?: string
  payment_instructions?: string
  guest_edit_token?: string | null
  crawler_confidence?: number
  confidence_details?: Record<string, any>
  confidence_100_count?: number
  auto_approved?: boolean
  last_scored_at?: string | null
  status: 'pending' | 'published' | 'rejected' | 'draft'
  publisher_id: string
  publisher_name: string
  submitted_at: string
  rejection_feedback: string
  submitter_email: string
  idempotency_key?: string | null
  deleted_at?: string | null
  venue_id?: string | null
  layout_id?: string | null
  seating_mode?: 'ga' | 'reserved'
  fee_pass_to_buyer?: boolean
  reminder_enabled?: boolean
  allow_self_cancel?: boolean
  email_templates?: Record<string, string>
}

export type { Order } from './orders'

export interface PromoCode {
  id: string
  event_id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  used_count: number
  valid_from: string | null
  valid_until: string | null
  applicable_tiers: string[] | null
  min_quantity: number
  is_active: boolean
  created_at: string
}

export interface Membership {
  id: string
  name: string
  description: string | null
  price: number
  benefits: {
    discount_percent?: number
    early_access_days?: number
    free_events?: boolean
  } | null
  max_members: number | null
  is_active: boolean
  created_at: string
}

export interface MemberSubscription {
  id: string
  membership_id: string
  user_email: string
  user_name: string
  status: 'active' | 'expired' | 'cancelled'
  started_at: string
  expires_at: string | null
  created_at: string
}

export interface EventPass {
  id: string
  name: string
  description: string | null
  price: number
  event_ids: string[]
  max_sold: number | null
  sold_count: number
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  created_at: string
}

export interface PassHolder {
  id: string
  pass_id: string
  holder_name: string
  holder_email: string
  status: 'active' | 'used' | 'expired' | 'cancelled'
  purchased_at: string
}

export interface EventNotification {
  id: string
  event_id: string
  sender_id: string
  subject: string
  message: string
  segment: string
  recipient_count: number
  sent_at: string
}

export interface QueueEntry {
  id: string
  event_id: string
  session_token: string
  email: string | null
  position: number
  status: 'waiting' | 'admitted' | 'expired' | 'left'
  joined_at: string
  admitted_at: string | null
  expires_at: string | null
}

export interface OrganizerWebhook {
  id: string
  event_id: string
  url: string
  events: string[]
  secret: string
  is_active: boolean
  created_at: string
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, any>
  response_status: number | null
  response_body: string | null
  delivered_at: string
  success: boolean
}

export interface Ticket {
  id: string
  event_id: string
  rsvp_id: string | null
  tier_id: string | null
  holder_name: string
  holder_email: string
  ticket_number: string
  qr_token: string
  status: 'active' | 'used' | 'cancelled' | 'revoked'
  checked_in_at: string | null
  checked_in_by: string | null
  gate: string | null
  seat_info: Record<string, any> | null
  is_comp: boolean
  comp_reason: string | null
  transferred_from_name: string | null
  transferred_from_email: string | null
  transferred_at: string | null
  created_at: string
  updated_at: string
}
