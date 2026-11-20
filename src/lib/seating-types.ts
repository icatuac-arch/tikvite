/**
 * Type definitions for the seating / venue system.
 */

export type SeatStatus = 'available' | 'held' | 'sold' | 'blocked' | 'comp'
export type SeatType = 'regular' | 'accessible' | 'companion' | 'blocked'
export type PriceZone = string // e.g. 'standard', 'premium', 'vip'
export type StagePosition = 'top' | 'bottom' | 'left' | 'right'
export type SectionType = 'seated' | 'ga' | 'vip'

export interface Venue {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  lat: number | null
  lng: number | null
  created_by: string | null
  is_private: boolean
  verified: boolean
  created_at: string
  updated_at: string
}

export interface VenueLayout {
  id: string
  venue_id: string
  name: string
  version: number
  width: number
  height: number
  stage_position: StagePosition
  background_image_url: string | null
  is_active: boolean
  created_at: string
}

export interface LayoutSection {
  id: string
  layout_id: string
  name: string
  section_type: SectionType
  color: string
  price_zone: PriceZone
  sort_order: number
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutRow {
  id: string
  section_id: string
  layout_id: string
  label: string
  y_offset: number
  curve: number
  seat_count: number
  seat_spacing: number
  sort_order: number
}

export interface LayoutSeat {
  id: string
  row_id: string
  section_id: string
  layout_id: string
  label: string
  x: number
  y: number
  seat_type: SeatType
  price_zone: PriceZone
  gate: string | null
  sort_order: number
}

export interface SessionSeat {
  id: string
  event_id: string
  seat_id: string
  layout_id: string
  status: SeatStatus
  hold_expires_at: string | null
  held_by: string | null
  order_id: string | null
  ticket_id: string | null
  price_override: number | null
  updated_at: string
}

/** Composite type: full layout tree with sections, rows, and seats */
export interface SeatMapData {
  layout: VenueLayout
  sections: (LayoutSection & {
    rows: (LayoutRow & {
      seats: LayoutSeat[]
    })[]
  })[]
}

/* ── Editor action types ─────────────────────────────────────────────── */

export type EditorTool = 'select' | 'addSection' | 'addRow'

export interface EditorSnapshot {
  sections: LayoutSection[]
  rows: LayoutRow[]
  seats: LayoutSeat[]
}

export interface EditorState {
  sections: LayoutSection[]
  rows: LayoutRow[]
  seats: LayoutSeat[]
  selectedIds: Set<string>
  tool: EditorTool
  stagePosition: StagePosition
  undoStack: EditorSnapshot[]
  redoStack: EditorSnapshot[]
  zoom: number
  pan: { x: number; y: number }
  saving: boolean
}

export type EditorAction =
  | { type: 'SET_TOOL'; tool: EditorTool }
  | { type: 'SELECT'; id: string; shift?: boolean }
  | { type: 'DESELECT_ALL' }
  | { type: 'ADD_SECTION'; section: LayoutSection }
  | { type: 'UPDATE_SECTION'; id: string; updates: Partial<LayoutSection> }
  | { type: 'DELETE_SECTION'; id: string }
  | { type: 'ADD_ROW'; row: LayoutRow; seats: LayoutSeat[] }
  | { type: 'UPDATE_ROW'; id: string; updates: Partial<LayoutRow> }
  | { type: 'DELETE_ROW'; id: string }
  | { type: 'UPDATE_SEAT'; id: string; updates: Partial<LayoutSeat> }
  | { type: 'UPDATE_SEATS'; ids: string[]; updates: Partial<LayoutSeat> }
  | { type: 'MOVE_SECTION'; id: string; x: number; y: number }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; pan: { x: number; y: number } }
  | { type: 'SET_STAGE_POSITION'; position: StagePosition }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'LOAD'; sections: LayoutSection[]; rows: LayoutRow[]; seats: LayoutSeat[] }

/* ── Price zone palette ──────────────────────────────────────────────── */

export const PRICE_ZONE_COLORS: Record<string, string> = {
  premium: '#4F46E5',
  gold: '#7C3AED',
  standard: '#4A90D9',
  economy: '#2D7A3A',
  vip: '#8B5CF6',
}

export const DEFAULT_PRICE_ZONES = Object.keys(PRICE_ZONE_COLORS)

export function getPriceZoneColor(zone: string): string {
  return PRICE_ZONE_COLORS[zone] || '#4A90D9'
}
