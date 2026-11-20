'use client'

import { useState } from 'react'
import { MousePointer2, Plus, Rows3, Palette, Tag } from 'lucide-react'
import type { EditorTool, EditorAction, SeatType, LayoutSection } from '@/lib/seating-types'
import { DEFAULT_PRICE_ZONES, PRICE_ZONE_COLORS } from '@/lib/seating-types'

interface Props {
  tool: EditorTool
  selectedIds: Set<string>
  sections: LayoutSection[]
  dispatch: (a: EditorAction) => void
}

const SECTION_COLORS = [
  '#E2E8F0', '#D4E8D0', '#D0D8E8', '#E8D0D0',
  '#E8E0D0', '#D0E8E0', '#D8D0E8', '#E8D0E0',
]

export default function EditorToolbar({ tool, selectedIds, sections, dispatch }: Props) {
  const [showAddSection, setShowAddSection] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [showBulkZone, setShowBulkZone] = useState(false)
  const [showBulkType, setShowBulkType] = useState(false)

  // Add Section form state
  const [sectionName, setSectionName] = useState('')
  const [sectionType, setSectionType] = useState<'seated' | 'ga' | 'vip'>('seated')
  const [sectionColor, setSectionColor] = useState(SECTION_COLORS[0])

  // Add Row form state
  const [rowTargetSection, setRowTargetSection] = useState('')
  const [rowLabel, setRowLabel] = useState('')
  const [rowSeatCount, setRowSeatCount] = useState(10)
  const [rowSpacing, setRowSpacing] = useState(24)

  const hasSelection = selectedIds.size > 0

  function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  function handleAddSection() {
    if (!sectionName.trim()) return
    const newSection: LayoutSection = {
      id: generateId(),
      layout_id: '',
      name: sectionName.trim(),
      section_type: sectionType,
      color: sectionColor,
      price_zone: 'standard',
      sort_order: sections.length,
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    }
    dispatch({ type: 'ADD_SECTION', section: newSection })
    setSectionName('')
    setShowAddSection(false)
  }

  function handleAddRow() {
    if (!rowTargetSection || !rowLabel.trim()) return
    const section = sections.find((s) => s.id === rowTargetSection)
    if (!section) return

    const rowId = generateId()

    // Count existing rows in section (approximate)
    const yOffset = 40 + sections.indexOf(section) * 30

    const newRow = {
      id: rowId,
      section_id: rowTargetSection,
      layout_id: '',
      label: rowLabel.trim(),
      y_offset: yOffset,
      curve: 0,
      seat_count: rowSeatCount,
      seat_spacing: rowSpacing,
      sort_order: 0,
    }

    // Generate seats
    const seatStartX = section.x + (section.width - (rowSeatCount - 1) * rowSpacing) / 2
    const seatY = section.y + yOffset
    const seats = Array.from({ length: rowSeatCount }, (_, i) => ({
      id: generateId(),
      row_id: rowId,
      section_id: rowTargetSection,
      layout_id: '',
      label: String(i + 1),
      x: seatStartX + i * rowSpacing,
      y: seatY,
      seat_type: 'regular' as const,
      price_zone: section.price_zone || 'standard',
      gate: null,
      sort_order: i,
    }))

    dispatch({ type: 'ADD_ROW', row: newRow, seats })
    setRowLabel('')
    setShowAddRow(false)
  }

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
    textAlign: 'left',
  }

  const activeBg = '#4F46E5'
  const activeColor = '#fff'
  const inactiveBg = 'transparent'
  const inactiveColor = '#4A3728'

  return (
    <div
      style={{
        width: 150,
        background: '#fff',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 8,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: '#8A7B6B',
          padding: '8px 12px 4px',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Tools
      </div>

      {/* Select Tool */}
      <button
        onClick={() => dispatch({ type: 'SET_TOOL', tool: 'select' })}
        style={{
          ...btnBase,
          background: tool === 'select' ? activeBg : inactiveBg,
          color: tool === 'select' ? activeColor : inactiveColor,
        }}
      >
        <MousePointer2 size={16} /> Select
      </button>

      {/* Add Section */}
      <button
        onClick={() => { dispatch({ type: 'SET_TOOL', tool: 'addSection' }); setShowAddSection(!showAddSection) }}
        style={{
          ...btnBase,
          background: tool === 'addSection' ? activeBg : inactiveBg,
          color: tool === 'addSection' ? activeColor : inactiveColor,
        }}
      >
        <Plus size={16} /> Section
      </button>

      {showAddSection && (
        <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="Section name"
            style={inputStyle}
          />
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value as any)}
            style={inputStyle}
          >
            <option value="seated">Seated</option>
            <option value="ga">General Admission</option>
            <option value="vip">VIP</option>
          </select>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SECTION_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSectionColor(c)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: c,
                  border: sectionColor === c ? '2px solid #4F46E5' : '1px solid #ccc',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <button onClick={handleAddSection} style={addBtnStyle}>
            Add Section
          </button>
        </div>
      )}

      {/* Add Row */}
      <button
        onClick={() => { dispatch({ type: 'SET_TOOL', tool: 'addRow' }); setShowAddRow(!showAddRow) }}
        style={{
          ...btnBase,
          background: tool === 'addRow' ? activeBg : inactiveBg,
          color: tool === 'addRow' ? activeColor : inactiveColor,
        }}
      >
        <Rows3 size={16} /> Row
      </button>

      {showAddRow && (
        <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select
            value={rowTargetSection}
            onChange={(e) => setRowTargetSection(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            value={rowLabel}
            onChange={(e) => setRowLabel(e.target.value)}
            placeholder="Row label (A, B...)"
            style={inputStyle}
          />
          <input
            type="number"
            value={rowSeatCount}
            onChange={(e) => setRowSeatCount(parseInt(e.target.value) || 1)}
            min={1}
            max={100}
            placeholder="Seats"
            style={inputStyle}
          />
          <input
            type="number"
            value={rowSpacing}
            onChange={(e) => setRowSpacing(parseInt(e.target.value) || 20)}
            min={16}
            max={60}
            placeholder="Spacing (px)"
            style={inputStyle}
          />
          <button onClick={handleAddRow} style={addBtnStyle}>
            Add Row
          </button>
        </div>
      )}

      {/* Divider */}
      {hasSelection && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '8px 0' }} />
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: '#8A7B6B',
              padding: '4px 12px',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Bulk ({selectedIds.size})
          </div>

          {/* Set Price Zone */}
          <button
            onClick={() => setShowBulkZone(!showBulkZone)}
            style={{ ...btnBase, background: inactiveBg, color: inactiveColor }}
          >
            <Palette size={16} /> Price Zone
          </button>
          {showBulkZone && (
            <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DEFAULT_PRICE_ZONES.map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    dispatch({ type: 'UPDATE_SEATS', ids: Array.from(selectedIds), updates: { price_zone: z } })
                    setShowBulkZone(false)
                  }}
                  style={{
                    ...btnBase,
                    padding: '6px 8px',
                    fontSize: 12,
                    gap: 6,
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: PRICE_ZONE_COLORS[z], flexShrink: 0 }} />
                  <span style={{ textTransform: 'capitalize' }}>{z}</span>
                </button>
              ))}
            </div>
          )}

          {/* Set Seat Type */}
          <button
            onClick={() => setShowBulkType(!showBulkType)}
            style={{ ...btnBase, background: inactiveBg, color: inactiveColor }}
          >
            <Tag size={16} /> Seat Type
          </button>
          {showBulkType && (
            <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(['regular', 'accessible', 'blocked', 'companion'] as SeatType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    dispatch({ type: 'UPDATE_SEATS', ids: Array.from(selectedIds), updates: { seat_type: t } })
                    setShowBulkType(false)
                  }}
                  style={{ ...btnBase, padding: '6px 8px', fontSize: 12, textTransform: 'capitalize' }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #E2E8F0',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "'Inter', sans-serif",
  background: '#F8FAFC',
  color: '#4A3728',
  outline: 'none',
}

const addBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: '#4F46E5',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
}
