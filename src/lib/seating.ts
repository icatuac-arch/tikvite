/**
 * Pure helper functions for the seating system.
 * Safe to import from both browser and server code.
 */
import type { SessionSeat, SeatStatus, LayoutRow, LayoutSeat } from './seating-types'

/** Count seats by status for availability display. */
export function computeSeatAvailability(
  sessionSeats: Pick<SessionSeat, 'status'>[]
): Record<SeatStatus, number> {
  const counts: Record<SeatStatus, number> = {
    available: 0,
    held: 0,
    sold: 0,
    blocked: 0,
    comp: 0,
  }
  for (const s of sessionSeats) {
    counts[s.status] = (counts[s.status] || 0) + 1
  }
  return counts
}

/** Format a human-readable seat label. */
export function formatSeatLabel(
  sectionName: string,
  rowLabel: string,
  seatLabel: string
): string {
  return `${sectionName}, Row ${rowLabel}, Seat ${seatLabel}`
}

/**
 * Generate x/y positions for each seat in a row.
 * Returns an array of { label, x, y } objects.
 */
export function generateSeatsForRow(
  row: Pick<LayoutRow, 'label' | 'seat_count' | 'seat_spacing' | 'y_offset' | 'curve'>,
  sectionX: number,
  sectionY: number
): Pick<LayoutSeat, 'label' | 'x' | 'y'>[] {
  const seats: Pick<LayoutSeat, 'label' | 'x' | 'y'>[] = []
  const totalWidth = (row.seat_count - 1) * row.seat_spacing
  const startX = sectionX - totalWidth / 2

  for (let i = 0; i < row.seat_count; i++) {
    const x = startX + i * row.seat_spacing
    // Apply a parabolic curve offset to y based on seat position
    const normalizedPos = row.seat_count > 1 ? (i / (row.seat_count - 1)) * 2 - 1 : 0
    const curveOffset = row.curve * (1 - normalizedPos * normalizedPos)
    const y = sectionY + row.y_offset + curveOffset

    seats.push({
      label: String(i + 1),
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    })
  }

  return seats
}
