'use client'

import { Trash2 } from 'lucide-react'
import type {
  LayoutSection, LayoutRow, LayoutSeat, EditorAction,
} from '@/lib/seating-types'
import { DEFAULT_PRICE_ZONES } from '@/lib/seating-types'

interface Props {
  selectedIds: Set<string>
  sections: LayoutSection[]
  rows: LayoutRow[]
  seats: LayoutSeat[]
  dispatch: (a: EditorAction) => void
}

export default function PropertiesPanel({ selectedIds, sections, rows, seats, dispatch }: Props) {
  if (selectedIds.size === 0) {
    return (
      <div style={panelStyle}>
        <div style={emptyStyle}>
          Select an element to view its properties
        </div>
      </div>
    )
  }

  const id = Array.from(selectedIds)[0]

  // Check if it's a section
  const section = sections.find((s) => s.id === id)
  if (section) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Section Properties</div>

        <label style={labelStyle}>Name</label>
        <input
          value={section.name}
          onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { name: e.target.value } })}
          style={inputStyle}
        />

        <label style={labelStyle}>Type</label>
        <select
          value={section.section_type}
          onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { section_type: e.target.value as any } })}
          style={inputStyle}
        >
          <option value="seated">Seated</option>
          <option value="ga">General Admission</option>
          <option value="vip">VIP</option>
        </select>

        <label style={labelStyle}>Color</label>
        <input
          type="color"
          value={section.color}
          onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { color: e.target.value } })}
          style={{ ...inputStyle, height: 32, padding: 2 }}
        />

        <label style={labelStyle}>Price Zone</label>
        <select
          value={section.price_zone}
          onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { price_zone: e.target.value } })}
          style={inputStyle}
        >
          {DEFAULT_PRICE_ZONES.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={labelStyle}>X</label>
            <input
              type="number"
              value={Math.round(section.x)}
              onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { x: parseInt(e.target.value) || 0 } })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Y</label>
            <input
              type="number"
              value={Math.round(section.y)}
              onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { y: parseInt(e.target.value) || 0 } })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Width</label>
            <input
              type="number"
              value={Math.round(section.width)}
              onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { width: parseInt(e.target.value) || 100 } })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Height</label>
            <input
              type="number"
              value={Math.round(section.height)}
              onChange={(e) => dispatch({ type: 'UPDATE_SECTION', id, updates: { height: parseInt(e.target.value) || 100 } })}
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={() => dispatch({ type: 'DELETE_SECTION', id })}
          style={deleteBtnStyle}
        >
          <Trash2 size={14} /> Delete Section
        </button>
      </div>
    )
  }

  // Check if it's a row
  const row = rows.find((r) => r.id === id)
  if (row) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Row Properties</div>

        <label style={labelStyle}>Label</label>
        <input
          value={row.label}
          onChange={(e) => dispatch({ type: 'UPDATE_ROW', id, updates: { label: e.target.value } })}
          style={inputStyle}
        />

        <label style={labelStyle}>Seat Count</label>
        <input
          type="number"
          value={row.seat_count}
          disabled
          style={{ ...inputStyle, opacity: 0.6 }}
        />

        <label style={labelStyle}>Spacing</label>
        <input
          type="number"
          value={row.seat_spacing}
          onChange={(e) => dispatch({ type: 'UPDATE_ROW', id, updates: { seat_spacing: parseInt(e.target.value) || 20 } })}
          style={inputStyle}
        />

        <label style={labelStyle}>Curve</label>
        <input
          type="range"
          min={0}
          max={50}
          value={row.curve}
          onChange={(e) => dispatch({ type: 'UPDATE_ROW', id, updates: { curve: parseInt(e.target.value) || 0 } })}
          style={{ width: '100%' }}
        />

        <button
          onClick={() => dispatch({ type: 'DELETE_ROW', id })}
          style={deleteBtnStyle}
        >
          <Trash2 size={14} /> Delete Row
        </button>
      </div>
    )
  }

  // Must be seat(s)
  const selectedSeats = seats.filter((s) => selectedIds.has(s.id))
  if (selectedSeats.length === 0) {
    return <div style={panelStyle}><div style={emptyStyle}>No element found</div></div>
  }

  if (selectedSeats.length === 1) {
    const seat = selectedSeats[0]
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Seat Properties</div>

        <label style={labelStyle}>Label</label>
        <input
          value={seat.label}
          onChange={(e) => dispatch({ type: 'UPDATE_SEAT', id: seat.id, updates: { label: e.target.value } })}
          style={inputStyle}
        />

        <label style={labelStyle}>Seat Type</label>
        <select
          value={seat.seat_type}
          onChange={(e) => dispatch({ type: 'UPDATE_SEAT', id: seat.id, updates: { seat_type: e.target.value as any } })}
          style={inputStyle}
        >
          <option value="regular">Regular</option>
          <option value="accessible">Accessible</option>
          <option value="blocked">Blocked</option>
          <option value="companion">Companion</option>
        </select>

        <label style={labelStyle}>Price Zone</label>
        <select
          value={seat.price_zone}
          onChange={(e) => dispatch({ type: 'UPDATE_SEAT', id: seat.id, updates: { price_zone: e.target.value } })}
          style={inputStyle}
        >
          {DEFAULT_PRICE_ZONES.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>

        <div style={{ fontSize: 11, color: '#8A7B6B', marginTop: 8, fontFamily: "'Inter', sans-serif" }}>
          Position: ({Math.round(seat.x)}, {Math.round(seat.y)})
        </div>
      </div>
    )
  }

  // Multiple seats
  return (
    <div style={panelStyle}>
      <div style={headerStyle}>{selectedSeats.length} Seats Selected</div>

      <label style={labelStyle}>Seat Type (all)</label>
      <select
        onChange={(e) => dispatch({ type: 'UPDATE_SEATS', ids: selectedSeats.map((s) => s.id), updates: { seat_type: e.target.value as any } })}
        style={inputStyle}
        defaultValue=""
      >
        <option value="" disabled>Change type...</option>
        <option value="regular">Regular</option>
        <option value="accessible">Accessible</option>
        <option value="blocked">Blocked</option>
        <option value="companion">Companion</option>
      </select>

      <label style={labelStyle}>Price Zone (all)</label>
      <select
        onChange={(e) => dispatch({ type: 'UPDATE_SEATS', ids: selectedSeats.map((s) => s.id), updates: { price_zone: e.target.value } })}
        style={inputStyle}
        defaultValue=""
      >
        <option value="" disabled>Change zone...</option>
        {DEFAULT_PRICE_ZONES.map((z) => (
          <option key={z} value={z}>{z}</option>
        ))}
      </select>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  width: 250,
  background: '#fff',
  borderLeft: '1px solid #E2E8F0',
  padding: 16,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const headerStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#4F46E5',
  fontFamily: "'Plus Jakarta Sans', serif",
  marginBottom: 4,
}

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#8A7B6B',
  fontFamily: "'Inter', sans-serif",
  textAlign: 'center',
  marginTop: 40,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#8A7B6B',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontFamily: "'Inter', sans-serif",
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #E2E8F0',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  background: '#F8FAFC',
  color: '#4A3728',
  outline: 'none',
}

const deleteBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  background: '#FEF2F2',
  color: '#DC2626',
  border: '1px solid #FECACA',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  marginTop: 12,
}
