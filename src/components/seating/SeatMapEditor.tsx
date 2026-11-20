'use client'

import { useReducer, useRef, useCallback, useEffect } from 'react'
import { Save, ZoomIn, ZoomOut, RotateCcw, Undo2, Redo2 } from 'lucide-react'
import type {
  Venue, VenueLayout, LayoutSection, LayoutRow, LayoutSeat,
  EditorState, EditorAction, EditorSnapshot,
} from '@/lib/seating-types'
import StageElement from './StageElement'
import SectionRect from './SectionRect'
import RowLine from './RowLine'
import EditorToolbar from './EditorToolbar'
import PropertiesPanel from './PropertiesPanel'
import PriceZoneLegend from './PriceZoneLegend'

interface Props {
  venue: Venue
  layout: VenueLayout
  initialSections: LayoutSection[]
  initialRows: LayoutRow[]
  initialSeats: LayoutSeat[]
}

function createSnapshot(state: EditorState): EditorSnapshot {
  return {
    sections: structuredClone(state.sections),
    rows: structuredClone(state.rows),
    seats: structuredClone(state.seats),
  }
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, tool: action.tool }

    case 'SELECT': {
      const next = new Set(Array.from(state.selectedIds))
      if (action.shift) {
        if (next.has(action.id)) next.delete(action.id)
        else next.add(action.id)
      } else {
        next.clear()
        next.add(action.id)
      }
      return { ...state, selectedIds: next }
    }

    case 'DESELECT_ALL':
      return { ...state, selectedIds: new Set() }

    case 'ADD_SECTION': {
      const snap = createSnapshot(state)
      return {
        ...state,
        sections: [...state.sections, action.section],
        undoStack: [...state.undoStack, snap],
        redoStack: [],
        selectedIds: new Set([action.section.id]),
        tool: 'select',
      }
    }

    case 'UPDATE_SECTION': {
      const snap = createSnapshot(state)
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s
        ),
        undoStack: [...state.undoStack, snap],
        redoStack: [],
      }
    }

    case 'DELETE_SECTION': {
      const snap = createSnapshot(state)
      return {
        ...state,
        sections: state.sections.filter((s) => s.id !== action.id),
        rows: state.rows.filter((r) => r.section_id !== action.id),
        seats: state.seats.filter((s) => s.section_id !== action.id),
        selectedIds: new Set(),
        undoStack: [...state.undoStack, snap],
        redoStack: [],
      }
    }

    case 'ADD_ROW': {
      const snap = createSnapshot(state)
      return {
        ...state,
        rows: [...state.rows, action.row],
        seats: [...state.seats, ...action.seats],
        undoStack: [...state.undoStack, snap],
        redoStack: [],
        tool: 'select',
      }
    }

    case 'UPDATE_ROW': {
      const snap = createSnapshot(state)
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.id === action.id ? { ...r, ...action.updates } : r
        ),
        undoStack: [...state.undoStack, snap],
        redoStack: [],
      }
    }

    case 'DELETE_ROW': {
      const snap = createSnapshot(state)
      return {
        ...state,
        rows: state.rows.filter((r) => r.id !== action.id),
        seats: state.seats.filter((s) => s.row_id !== action.id),
        selectedIds: new Set(),
        undoStack: [...state.undoStack, snap],
        redoStack: [],
      }
    }

    case 'UPDATE_SEAT': {
      const snap = createSnapshot(state)
      return {
        ...state,
        seats: state.seats.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s
        ),
        undoStack: [...state.undoStack, snap],
        redoStack: [],
      }
    }

    case 'UPDATE_SEATS': {
      const snap = createSnapshot(state)
      const ids = new Set(action.ids)
      return {
        ...state,
        seats: state.seats.map((s) =>
          ids.has(s.id) ? { ...s, ...action.updates } : s
        ),
        undoStack: [...state.undoStack, snap],
        redoStack: [],
      }
    }

    case 'MOVE_SECTION': {
      const snap = createSnapshot(state)
      // Move section and all its seats
      const section = state.sections.find((s) => s.id === action.id)
      if (!section) return state
      const prevX = section.x
      const prevY = section.y
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, x: action.x, y: action.y } : s
        ),
        seats: state.seats.map((s) =>
          s.section_id === action.id
            ? { ...s, x: s.x + (action.x - prevX), y: s.y + (action.y - prevY) }
            : s
        ),
        undoStack: [...state.undoStack, snap],
        redoStack: [],
      }
    }

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.2, Math.min(3, action.zoom)) }

    case 'SET_PAN':
      return { ...state, pan: action.pan }

    case 'SET_STAGE_POSITION':
      return { ...state, stagePosition: action.position }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      const snap = createSnapshot(state)
      const prev = state.undoStack[state.undoStack.length - 1]
      return {
        ...state,
        sections: prev.sections,
        rows: prev.rows,
        seats: prev.seats,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, snap],
      }
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state
      const snap = createSnapshot(state)
      const next = state.redoStack[state.redoStack.length - 1]
      return {
        ...state,
        sections: next.sections,
        rows: next.rows,
        seats: next.seats,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, snap],
      }
    }

    case 'SET_SAVING':
      return { ...state, saving: action.saving }

    case 'LOAD':
      return {
        ...state,
        sections: action.sections,
        rows: action.rows,
        seats: action.seats,
        undoStack: [],
        redoStack: [],
        selectedIds: new Set(),
      }

    default:
      return state
  }
}

export default function SeatMapEditor({
  venue,
  layout,
  initialSections,
  initialRows,
  initialSeats,
}: Props) {
  const [state, dispatch] = useReducer(editorReducer, {
    sections: initialSections,
    rows: initialRows,
    seats: initialSeats,
    selectedIds: new Set<string>(),
    tool: 'select',
    stagePosition: layout.stage_position,
    undoStack: [],
    redoStack: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    saving: false,
  })

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ sectionId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const panRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) dispatch({ type: 'REDO' })
        else dispatch({ type: 'UNDO' })
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'DESELECT_ALL' })
        dispatch({ type: 'SET_TOOL', tool: 'select' })
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds.size === 1) {
          const id = Array.from(state.selectedIds)[0]
          if (state.sections.find((s) => s.id === id)) {
            dispatch({ type: 'DELETE_SECTION', id })
          } else if (state.rows.find((r) => r.id === id)) {
            dispatch({ type: 'DELETE_ROW', id })
          }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state.selectedIds, state.sections, state.rows])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    dispatch({ type: 'SET_ZOOM', zoom: state.zoom + delta })
  }, [state.zoom])

  // Section drag
  function handleSectionDragStart(sectionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const section = state.sections.find((s) => s.id === sectionId)
    if (!section) return
    dragRef.current = {
      sectionId,
      startX: e.clientX,
      startY: e.clientY,
      origX: section.x,
      origY: section.y,
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startX) / state.zoom
      const dy = (e.clientY - dragRef.current.startY) / state.zoom
      dispatch({
        type: 'MOVE_SECTION',
        id: dragRef.current.sectionId,
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      })
    } else if (panRef.current) {
      const dx = e.clientX - panRef.current.startX
      const dy = e.clientY - panRef.current.startY
      dispatch({
        type: 'SET_PAN',
        pan: {
          x: panRef.current.origPanX + dx,
          y: panRef.current.origPanY + dy,
        },
      })
    }
  }

  function handleMouseUp() {
    dragRef.current = null
    panRef.current = null
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    // If clicking empty area, start pan or deselect
    if (e.target === svgRef.current || (e.target as Element).classList.contains('canvas-bg')) {
      dispatch({ type: 'DESELECT_ALL' })
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: state.pan.x,
        origPanY: state.pan.y,
      }
    }
  }

  function handleSeatClick(seatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'SELECT', id: seatId, shift: e.shiftKey })
  }

  function handleSectionClick(sectionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'SELECT', id: sectionId, shift: e.shiftKey })
  }

  // Save handler — builds the tree format the PUT endpoint expects
  async function handleSave() {
    dispatch({ type: 'SET_SAVING', saving: true })
    try {
      // Build tree: sections -> rows -> seats
      const rowsBySec: Record<string, LayoutRow[]> = {}
      for (const r of state.rows) {
        if (!rowsBySec[r.section_id]) rowsBySec[r.section_id] = []
        rowsBySec[r.section_id].push(r)
      }
      const seatsByR: Record<string, LayoutSeat[]> = {}
      for (const s of state.seats) {
        if (!seatsByR[s.row_id]) seatsByR[s.row_id] = []
        seatsByR[s.row_id].push(s)
      }
      const treeSections = state.sections.map((sec) => ({
        ...sec,
        rows: (rowsBySec[sec.id] || []).map((row) => ({
          ...row,
          seats: seatsByR[row.id] || [],
        })),
      }))

      const res = await fetch(`/api/venues/${venue.id}/layouts/${layout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: { stage_position: state.stagePosition },
          sections: treeSections,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to save layout')
      }
    } catch {
      alert('Network error saving layout')
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false })
    }
  }

  // Group rows and seats by section
  const rowsBySection: Record<string, LayoutRow[]> = {}
  for (const row of state.rows) {
    if (!rowsBySection[row.section_id]) rowsBySection[row.section_id] = []
    rowsBySection[row.section_id].push(row)
  }

  const seatsByRow: Record<string, LayoutSeat[]> = {}
  for (const seat of state.seats) {
    if (!seatsByRow[seat.row_id]) seatsByRow[seat.row_id] = []
    seatsByRow[seat.row_id].push(seat)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid #E2E8F0',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "'Plus Jakarta Sans', serif",
              color: '#4F46E5',
              margin: 0,
            }}
          >
            {venue.name}
          </h1>
          <span
            style={{
              fontSize: 13,
              color: '#8A7B6B',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {layout.name} ({layout.width} x {layout.height})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Undo/Redo */}
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={state.undoStack.length === 0}
            style={iconBtnStyle(state.undoStack.length > 0)}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={state.redoStack.length === 0}
            style={iconBtnStyle(state.redoStack.length > 0)}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>

          <div style={{ width: 1, height: 24, background: '#E2E8F0', margin: '0 4px' }} />

          {/* Zoom controls */}
          <button
            onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 0.15 })}
            style={iconBtnStyle(true)}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span
            style={{
              fontSize: 12,
              color: '#4A3728',
              fontFamily: "'Inter', sans-serif",
              minWidth: 40,
              textAlign: 'center',
            }}
          >
            {Math.round(state.zoom * 100)}%
          </span>
          <button
            onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 0.15 })}
            style={iconBtnStyle(true)}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => { dispatch({ type: 'SET_ZOOM', zoom: 1 }); dispatch({ type: 'SET_PAN', pan: { x: 0, y: 0 } }) }}
            style={iconBtnStyle(true)}
            title="Reset view"
          >
            <RotateCcw size={16} />
          </button>

          <div style={{ width: 1, height: 24, background: '#E2E8F0', margin: '0 4px' }} />

          {/* Stage position */}
          <select
            value={state.stagePosition}
            onChange={(e) => dispatch({ type: 'SET_STAGE_POSITION', position: e.target.value as any })}
            style={{
              padding: '6px 8px',
              border: '1px solid #E2E8F0',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "'Inter', sans-serif",
              background: '#F8FAFC',
              color: '#4A3728',
              cursor: 'pointer',
            }}
          >
            <option value="top">Stage: Top</option>
            <option value="bottom">Stage: Bottom</option>
          </select>

          <div style={{ width: 1, height: 24, background: '#E2E8F0', margin: '0 4px' }} />

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={state.saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: state.saving ? '#B0A89A' : '#4F46E5',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: state.saving ? 'wait' : 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <Save size={14} />
            {state.saving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar: toolbar */}
        <EditorToolbar
          tool={state.tool}
          selectedIds={state.selectedIds}
          sections={state.sections}
          dispatch={dispatch}
        />

        {/* Center: SVG canvas */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            background: '#FAF6EE',
          }}
        >
          {/* Price zone legend overlay */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '4px 12px' }}>
            <PriceZoneLegend seats={state.seats} />
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width="100%"
            height="100%"
            style={{ display: 'block' }}
            onWheel={handleWheel}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid background */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth={0.5} opacity={0.5} />
              </pattern>
            </defs>
            <rect
              className="canvas-bg"
              width={layout.width}
              height={layout.height}
              fill="url(#grid)"
            />

            {/* Transform group for zoom/pan */}
            <g transform={`translate(${state.pan.x},${state.pan.y}) scale(${state.zoom})`}>
              {/* Stage */}
              <StageElement
                position={state.stagePosition}
                layoutWidth={layout.width}
                layoutHeight={layout.height}
              />

              {/* Sections */}
              {state.sections.map((section) => (
                <g key={section.id}>
                  <SectionRect
                    section={section}
                    selected={state.selectedIds.has(section.id)}
                    onClick={(e) => handleSectionClick(section.id, e)}
                    onDragStart={(e) => handleSectionDragStart(section.id, e)}
                    editable
                  />
                  {/* Rows inside this section */}
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
                        selectedIds={state.selectedIds}
                        onSeatClick={handleSeatClick}
                        editable
                      />
                    ))}
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Right sidebar: properties panel */}
        <PropertiesPanel
          selectedIds={state.selectedIds}
          sections={state.sections}
          rows={state.rows}
          seats={state.seats}
          dispatch={dispatch}
        />
      </div>
    </div>
  )
}

function iconBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    background: '#F8FAFC',
    color: enabled ? '#4A3728' : '#ccc',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
    padding: 0,
  }
}
