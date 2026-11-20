'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ShoppingCart, Clock, List, Map, Plus, Minus, X } from 'lucide-react'
import type {
  VenueLayout, LayoutSection, LayoutRow, LayoutSeat, SessionSeat, SeatStatus,
} from '@/lib/seating-types'
import { getPriceZoneColor } from '@/lib/seating-types'
import StageElement from './StageElement'
import SectionRect from './SectionRect'
import RowLine from './RowLine'
import PriceZoneLegend from './PriceZoneLegend'

interface Props {
  eventId: string
  eventTitle: string
  shortId: string
  layout: VenueLayout
  sections: LayoutSection[]
  rows: LayoutRow[]
  seats: LayoutSeat[]
  sessionSeats: SessionSeat[]
  tierPrices: Record<string, number> // price_zone -> price in cents
}

export default function SeatSelector({
  eventId,
  eventTitle,
  layout,
  sections,
  rows,
  seats,
  sessionSeats,
  tierPrices,
}: Props) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set())
  const [holdStatus, setHoldStatus] = useState<'idle' | 'holding' | 'held' | 'error'>('idle')
  const [holdExpiry, setHoldExpiry] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const panRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null)

  // Build seat status map
  const seatStatusMap: Record<string, SeatStatus> = {}
  const now = new Date()
  for (const ss of sessionSeats) {
    if (ss.status === 'sold') {
      seatStatusMap[ss.seat_id] = 'sold'
    } else if (ss.status === 'held') {
      if (ss.hold_expires_at && new Date(ss.hold_expires_at) > now && ss.held_by !== sessionId) {
        seatStatusMap[ss.seat_id] = 'held'
      }
      // Expired holds are treated as available
    } else if (ss.status === 'blocked') {
      seatStatusMap[ss.seat_id] = 'blocked'
    }
  }

  // Hold countdown timer
  useEffect(() => {
    if (!holdExpiry) return
    const timer = setInterval(() => {
      const diff = holdExpiry.getTime() - Date.now()
      if (diff <= 0) {
        setCountdown('0:00')
        setHoldStatus('idle')
        setHoldExpiry(null)
        setSelectedSeatIds(new Set())
        setError('Your seat hold has expired. Please select seats again.')
        clearInterval(timer)
        return
      }
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      setCountdown(`${min}:${sec.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [holdExpiry])

  // Toggle seat selection
  function toggleSeat(seatId: string) {
    if (holdStatus === 'held') return // Don't change while held
    const status = seatStatusMap[seatId]
    if (status === 'sold' || status === 'held' || status === 'blocked') return

    const seat = seats.find((s) => s.id === seatId)
    if (seat?.seat_type === 'blocked') return

    setError('')
    setSelectedSeatIds((prev) => {
      const next = new Set(Array.from(prev))
      if (next.has(seatId)) next.delete(seatId)
      else {
        if (next.size >= 20) return prev // Max 20 seats
        next.add(seatId)
      }
      return next
    })
  }

  // Get price for a seat
  function getSeatPrice(seat: LayoutSeat): number {
    return tierPrices[seat.price_zone] || 0
  }

  // Selected seats info
  const selectedSeats = seats.filter((s) => selectedSeatIds.has(s.id))
  const totalPrice = selectedSeats.reduce((sum, s) => sum + getSeatPrice(s), 0)

  // Build seat info strings
  function seatDescription(seat: LayoutSeat): string {
    const section = sections.find((s) => s.id === seat.section_id)
    const row = rows.find((r) => r.id === seat.row_id)
    return `${section?.name || 'Section'}, Row ${row?.label || '?'}, Seat ${seat.label}`
  }

  // Hold & checkout
  async function handleHoldAndCheckout() {
    if (selectedSeatIds.size === 0) return
    setHoldStatus('holding')
    setError('')

    try {
      const res = await fetch('/api/seats/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          seat_ids: Array.from(selectedSeatIds),
          session_id: sessionId,
          layout_id: layout.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to hold seats')
        setHoldStatus('error')
        return
      }
      setHoldStatus('held')
      setHoldExpiry(new Date(data.hold_expires_at))

      // Redirect to checkout with seat info
      const checkoutParams = new URLSearchParams({
        event_id: eventId,
        seat_ids: Array.from(selectedSeatIds).join(','),
        session_id: sessionId,
      })
      window.location.href = `/api/checkout?${checkoutParams.toString()}`
    } catch {
      setError('Network error. Please try again.')
      setHoldStatus('error')
    }
  }

  // Group rows and seats
  const rowsBySection: Record<string, LayoutRow[]> = {}
  for (const row of rows) {
    if (!rowsBySection[row.section_id]) rowsBySection[row.section_id] = []
    rowsBySection[row.section_id].push(row)
  }
  const seatsByRow: Record<string, LayoutSeat[]> = {}
  for (const seat of seats) {
    if (!seatsByRow[seat.row_id]) seatsByRow[seat.row_id] = []
    seatsByRow[seat.row_id].push(seat)
  }

  // Pan handlers
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === svgRef.current || (e.target as Element).classList.contains('canvas-bg')) {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      }
    }
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (panRef.current) {
      setPan({
        x: panRef.current.origPanX + (e.clientX - panRef.current.startX),
        y: panRef.current.origPanY + (e.clientY - panRef.current.startY),
      })
    }
  }
  function handleMouseUp() { panRef.current = null }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.max(0.3, Math.min(3, z + delta)))
  }, [])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            fontFamily: "'Plus Jakarta Sans', serif",
            color: '#4F46E5',
            margin: 0,
          }}
        >
          Select Your Seats
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#8A7B6B',
            fontFamily: "'Inter', sans-serif",
            margin: '4px 0 0',
          }}
        >
          {eventTitle}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            color: '#DC2626',
            fontSize: 14,
            fontFamily: "'Inter', sans-serif",
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {error}
          <button
            onClick={() => setError('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Legend + View Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <PriceZoneLegend seats={seats} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setViewMode('map')}
            style={{
              ...viewToggleStyle,
              background: viewMode === 'map' ? '#4F46E5' : '#fff',
              color: viewMode === 'map' ? '#fff' : '#4A3728',
            }}
          >
            <Map size={14} /> Map
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              ...viewToggleStyle,
              background: viewMode === 'list' ? '#4F46E5' : '#fff',
              color: viewMode === 'list' ? '#fff' : '#4A3728',
            }}
          >
            <List size={14} /> List
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {viewMode === 'map' ? (
            <div
              style={{
                position: 'relative',
                background: '#FAF6EE',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {/* Zoom controls overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                  style={zoomBtnStyle}
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
                  style={zoomBtnStyle}
                >
                  <Minus size={16} />
                </button>
              </div>

              <svg
                ref={svgRef}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                width="100%"
                style={{ display: 'block', minHeight: 400, touchAction: 'none' }}
                onWheel={handleWheel}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <rect
                  className="canvas-bg"
                  width={layout.width}
                  height={layout.height}
                  fill="#FAF6EE"
                />

                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                  <StageElement
                    position={layout.stage_position}
                    layoutWidth={layout.width}
                    layoutHeight={layout.height}
                  />

                  {sections.map((section) => (
                    <g key={section.id}>
                      <SectionRect
                        section={section}
                        selected={false}
                        onClick={() => {}}
                      />
                      {(rowsBySection[section.id] || [])
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((row) => (
                          <RowLine
                            key={row.id}
                            row={row}
                            seats={seatsByRow[row.id] || []}
                            sectionX={section.x}
                            sectionY={section.y}
                            sectionName={section.name}
                            selectedIds={selectedSeatIds}
                            seatStatuses={seatStatusMap}
                            onSeatClick={(seatId) => toggleSeat(seatId)}
                          />
                        ))}
                    </g>
                  ))}
                </g>
              </svg>
            </div>
          ) : (
            /* List View */
            <div
              style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: '#FAF6EE',
                  borderBottom: '1px solid #E2E8F0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#8A7B6B',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Can&apos;t see the map? Use this accessible list view.
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={thStyle}>Section</th>
                    <th style={thStyle}>Row</th>
                    <th style={thStyle}>Seat</th>
                    <th style={thStyle}>Price</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, width: 60 }}>Select</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((section) =>
                    (rowsBySection[section.id] || [])
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((row) =>
                        (seatsByRow[row.id] || [])
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((seat) => {
                            const status = seatStatusMap[seat.id] || (seat.seat_type === 'blocked' ? 'blocked' : 'available')
                            const available = status === 'available' || status === undefined
                            return (
                              <tr key={seat.id} style={{ borderBottom: '1px solid #F0EBE3' }}>
                                <td style={tdStyle}>{section.name}</td>
                                <td style={tdStyle}>{row.label}</td>
                                <td style={tdStyle}>{seat.label}</td>
                                <td style={tdStyle}>${(getSeatPrice(seat) / 100).toFixed(2)}</td>
                                <td style={tdStyle}>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 10,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background: available ? '#D1FAE5' : '#F5F0E8',
                                      color: available ? '#2E7D32' : '#8A7B6B',
                                    }}
                                  >
                                    {available ? 'Available' : status === 'sold' ? 'Sold' : status === 'held' ? 'Held' : 'Blocked'}
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                  {available && (
                                    <input
                                      type="checkbox"
                                      checked={selectedSeatIds.has(seat.id)}
                                      onChange={() => toggleSeat(seat.id)}
                                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#4F46E5' }}
                                    />
                                  )}
                                </td>
                              </tr>
                            )
                          })
                      )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Seat status legend */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 12,
              fontSize: 12,
              color: '#8A7B6B',
              fontFamily: "'Inter', sans-serif",
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#4A90D9', display: 'inline-block' }} />
              Available
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #7C3AED', background: '#4A90D9', display: 'inline-block' }} />
              Selected
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#B0A89A', display: 'inline-block' }} />
              Sold / Held
            </span>
          </div>
        </div>

        {/* Right panel: selected seats */}
        <div
          style={{
            width: 300,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            position: 'sticky',
            top: 20,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShoppingCart size={18} style={{ color: '#4F46E5' }} />
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "'Plus Jakarta Sans', serif",
                color: '#4F46E5',
              }}
            >
              Your Seats
            </span>
            {selectedSeats.length > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  background: '#4F46E5',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selectedSeats.length}
              </span>
            )}
          </div>

          {/* Hold timer */}
          {holdStatus === 'held' && holdExpiry && (
            <div
              style={{
                padding: '10px 16px',
                background: '#FFF7ED',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                color: '#7C3AED',
                fontWeight: 600,
              }}
            >
              <Clock size={14} />
              Seats held for {countdown}
            </div>
          )}

          <div style={{ padding: 16, maxHeight: 300, overflowY: 'auto' }}>
            {selectedSeats.length === 0 ? (
              <p
                style={{
                  fontSize: 13,
                  color: '#8A7B6B',
                  fontFamily: "'Inter', sans-serif",
                  textAlign: 'center',
                  margin: '20px 0',
                }}
              >
                Click on available seats to select them
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedSeats.map((seat) => (
                  <div
                    key={seat.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: '#F8FAFC',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <div>
                      <div style={{ color: '#4A3728', fontWeight: 500 }}>{seatDescription(seat)}</div>
                      <div style={{ color: '#8A7B6B', fontSize: 11, marginTop: 2 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: getPriceZoneColor(seat.price_zone),
                            display: 'inline-block',
                            marginRight: 4,
                          }}
                        />
                        {seat.price_zone}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#4A3728' }}>
                        ${(getSeatPrice(seat) / 100).toFixed(2)}
                      </span>
                      {holdStatus !== 'held' && (
                        <button
                          onClick={() => toggleSeat(seat.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#B0A89A',
                            padding: 2,
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total + Checkout */}
          {selectedSeats.length > 0 && (
            <div
              style={{
                padding: 16,
                borderTop: '1px solid #E2E8F0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "'Plus Jakarta Sans', serif",
                  color: '#4A3728',
                }}
              >
                <span>Total</span>
                <span>${(totalPrice / 100).toFixed(2)}</span>
              </div>
              <button
                onClick={handleHoldAndCheckout}
                disabled={holdStatus === 'holding'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: holdStatus === 'holding' ? '#B0A89A' : '#4F46E5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "'Inter', sans-serif",
                  cursor: holdStatus === 'holding' ? 'wait' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {holdStatus === 'holding' ? 'Holding seats...' : 'Hold & Checkout'}
              </button>
              <p
                style={{
                  fontSize: 11,
                  color: '#8A7B6B',
                  textAlign: 'center',
                  marginTop: 8,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Seats will be held for 10 minutes during checkout
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <style>{`
        @media (max-width: 768px) {
          .seat-selector-panel {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            border-radius: 16px 16px 0 0 !important;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.12) !important;
            z-index: 50 !important;
            max-height: 40vh !important;
            overflow-y: auto !important;
          }
        }
      `}</style>
    </div>
  )
}

const viewToggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  transition: 'all 0.15s',
}

const zoomBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  cursor: 'pointer',
  color: '#4A3728',
  padding: 0,
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#8A7B6B',
  borderBottom: '1px solid #E2E8F0',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#4A3728',
}
