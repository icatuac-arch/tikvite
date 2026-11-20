'use client'

import { useState } from 'react'
import type { LayoutSeat, SeatStatus } from '@/lib/seating-types'
import { getPriceZoneColor } from '@/lib/seating-types'

interface Props {
  seat: LayoutSeat
  selected?: boolean
  status?: SeatStatus
  sectionName?: string
  rowLabel?: string
  onClick?: (e: React.MouseEvent) => void
}

export default function SeatCircle({
  seat,
  selected = false,
  status = 'available',
  sectionName = '',
  rowLabel = '',
  onClick,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const r = 10

  let fill: string
  let cursor = 'pointer'
  let opacity = 1

  if (status === 'sold' || status === 'held') {
    fill = '#B0A89A'
    cursor = 'not-allowed'
    opacity = 0.6
  } else if (seat.seat_type === 'blocked') {
    fill = '#D1CCC4'
    cursor = 'default'
    opacity = 0.35
  } else if (seat.seat_type === 'accessible') {
    fill = getPriceZoneColor(seat.price_zone)
  } else {
    fill = getPriceZoneColor(seat.price_zone)
  }

  const tooltipText = `${sectionName ? sectionName + ', ' : ''}Row ${rowLabel}, Seat ${seat.label}`

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor }}
    >
      {/* Selection ring */}
      {selected && (
        <circle
          cx={seat.x}
          cy={seat.y}
          r={r + 4}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={2.5}
        />
      )}
      {/* Main seat circle */}
      <circle
        cx={seat.x}
        cy={seat.y}
        r={r}
        fill={fill}
        opacity={opacity}
        stroke={hovered && status === 'available' && seat.seat_type !== 'blocked' ? '#4F46E5' : 'transparent'}
        strokeWidth={hovered ? 2 : 0}
      />
      {/* Accessible marker */}
      {seat.seat_type === 'accessible' && (
        <text
          x={seat.x}
          y={seat.y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={10}
          fontWeight={700}
          style={{ pointerEvents: 'none' }}
        >
          A
        </text>
      )}
      {/* Blocked stripe */}
      {seat.seat_type === 'blocked' && (
        <line
          x1={seat.x - 6}
          y1={seat.y - 6}
          x2={seat.x + 6}
          y2={seat.y + 6}
          stroke="#999"
          strokeWidth={2}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/* Tooltip */}
      {hovered && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={seat.x - 70}
            y={seat.y - r - 30}
            width={140}
            height={22}
            rx={4}
            fill="#333"
            opacity={0.9}
          />
          <text
            x={seat.x}
            y={seat.y - r - 19}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={11}
            fontFamily="'Inter', sans-serif"
          >
            {tooltipText}
          </text>
        </g>
      )}
    </g>
  )
}
