'use client'

import { getPriceZoneColor } from '@/lib/seating-types'
import type { LayoutSeat } from '@/lib/seating-types'

interface Props {
  seats: LayoutSeat[]
  zones?: string[]
}

export default function PriceZoneLegend({ seats, zones }: Props) {
  const zoneSet = zones || Array.from(new Set(seats.map((s) => s.price_zone))).sort()

  const zoneCounts: Record<string, number> = {}
  for (const s of seats) {
    zoneCounts[s.price_zone] = (zoneCounts[s.price_zone] || 0) + 1
  }

  if (zoneSet.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 0' }}>
      {zoneSet.map((zone) => (
        <div
          key={zone}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            color: '#4A3728',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: getPriceZoneColor(zone),
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{zone}</span>
          {zoneCounts[zone] != null && (
            <span style={{ color: '#8A7B6B' }}>({zoneCounts[zone]})</span>
          )}
        </div>
      ))}
    </div>
  )
}
