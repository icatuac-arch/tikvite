/**
 * Email template resolution for organizer-customizable emails.
 *
 * Each event can store a `email_templates` JSONB column with custom
 * subject/body overrides. If a key is missing or empty, the default
 * hardcoded template is used instead.
 *
 * Supported variable placeholders: {{event_title}}, {{event_date}},
 * {{event_time}}, {{venue}}, {{city}}, {{attendee_name}},
 * {{ticket_number}}, {{confirmation_code}}, {{ticket_url}}.
 */

export interface TemplateVars {
  event_title?: string
  event_date?: string
  event_time?: string
  venue?: string
  city?: string
  attendee_name?: string
  ticket_number?: string
  confirmation_code?: string
  ticket_url?: string
}

export const TEMPLATE_VARIABLES = [
  { key: 'event_title', label: 'Event Title', example: 'Diwali Night 2026' },
  { key: 'event_date', label: 'Event Date', example: 'November 15, 2026' },
  { key: 'event_time', label: 'Event Time', example: '7:00 PM' },
  { key: 'venue', label: 'Venue', example: 'Community Hall' },
  { key: 'city', label: 'City', example: 'San Jose' },
  { key: 'attendee_name', label: 'Attendee Name', example: 'Priya' },
  { key: 'ticket_number', label: 'Ticket Number', example: 'TKT-A1B2C3' },
  { key: 'confirmation_code', label: 'Confirmation Code', example: 'CONF-X9Y8' },
  { key: 'ticket_url', label: 'Ticket URL', example: 'https://ticvite.com/ticket/TKT-A1B2C3' },
] as const

/** Default templates used when organizer hasn't customized. */
export const DEFAULTS: Record<string, string> = {
  confirmation_subject: "You're registered for {{event_title}}!",
  confirmation_body:
    "Hi {{attendee_name}},\n\nYou're confirmed for {{event_title}} on {{event_date}} at {{venue}}.\n\nWe look forward to seeing you!",
  reminder_subject: 'Reminder: {{event_title}} is tomorrow!',
  reminder_body:
    "Hi {{attendee_name}},\n\nJust a reminder that {{event_title}} is happening tomorrow at {{venue}}.\n\nDon't forget to bring your ticket!",
  starting_soon_subject: '{{event_title}} starts soon!',
  starting_soon_body:
    'Hi {{attendee_name}},\n\n{{event_title}} starts in a few hours at {{venue}}.\n\nSee you soon!',
  followup_subject: 'Thanks for attending {{event_title}}!',
  followup_body:
    'Hi {{attendee_name}},\n\nThank you for attending {{event_title}}. We hope you had a wonderful time!\n\nDiscover more events at Ticvite.',
  cancellation_subject:
    'Your booking for {{event_title}} has been cancelled',
  cancellation_body:
    'Hi {{attendee_name}},\n\nYour booking for {{event_title}} on {{event_date}} has been cancelled.\n\nIf this was a mistake, please contact the event organizer.',
}

/** All template keys, grouped by email type. */
export const TEMPLATE_TYPES = [
  { id: 'confirmation', label: 'Confirmation', subjectKey: 'confirmation_subject', bodyKey: 'confirmation_body' },
  { id: 'reminder', label: 'Reminder (1 Day)', subjectKey: 'reminder_subject', bodyKey: 'reminder_body' },
  { id: 'starting_soon', label: 'Starting Soon', subjectKey: 'starting_soon_subject', bodyKey: 'starting_soon_body' },
  { id: 'followup', label: 'Follow-up', subjectKey: 'followup_subject', bodyKey: 'followup_body' },
  { id: 'cancellation', label: 'Cancellation', subjectKey: 'cancellation_subject', bodyKey: 'cancellation_body' },
] as const

export const TEMPLATE_KEYS = Object.keys(DEFAULTS)

/**
 * Resolve a template: pick the organizer's custom template if present,
 * otherwise fall back to the default, and replace all {{var}} placeholders.
 */
export function resolveTemplate(
  eventTemplates: Record<string, string> | null | undefined,
  key: string,
  vars: TemplateVars,
): string {
  const template = eventTemplates?.[key]?.trim() || DEFAULTS[key] || ''
  return template.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
    return (vars as Record<string, string | undefined>)[varName] || ''
  })
}

/** Generate sample variables for preview rendering. */
export function getSampleVars(): TemplateVars {
  return TEMPLATE_VARIABLES.reduce((acc, v) => {
    ;(acc as any)[v.key] = v.example
    return acc
  }, {} as TemplateVars)
}
