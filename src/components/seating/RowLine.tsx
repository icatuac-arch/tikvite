'use client'

import type { LayoutRow, LayoutSeat, SeatStatus } from '@/lib/seating-types'
import SeatCircle from './SeatCircle'

interface Props {
  row: LayoutRow
  seats: LayoutSeat[]
  sectionX: number
  sectionY: number
  sectionName: string
  selectedIds: Set<string>
  seatStatuses?: Record<string, SeatStatus>
  onSeatClick?: (seatId: string, e: React.MouseEvent) => void
  editable?: boolean
}

export default function RowLine({
  row,
  seats,
  sectionX,
  sectionY,
  sectionName,
  selectedIds,
  seatStatuses = {},
  onSeatClick,
}: Props) {
  const sortedSeats = [...seats].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <g>
      {/* Row label */}
      <text
        x={sectionX - 16}
        y={sectionY + row.y_offset}
        textAnchor="end"
        dominantBaseline="central"
        fill="#4F46E5"
        fontSize={11}
        fontWeight={600}
        fontFamily="'Inter', sans-serif"
        style={{ pointerEvents: 'none' }}
      >
        {row.label}
      </text>
      {/* Seats */}
      {sortedSeats.map((seat) => (
        <SeatCircle
          key={seat.id}
          seat={seat}
          selected={selectedIds.has(seat.id)}
          status={seatStatuses[seat.id] || 'available'}
          sectionName={sectionName}
          rowLabel={row.label}
          onClick={(e) => onSeatClick?.(seat.id, e)}
        />
      ))}
    </g>
  )
}
