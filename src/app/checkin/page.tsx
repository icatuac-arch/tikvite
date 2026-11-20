'use client'

import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Camera,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Ticket,
  Users,
  LogIn,
} from 'lucide-react'

interface EventOption {
  id: string
  title: string
  date: string
}

interface ValidateResult {
  ok: boolean
  error?: string
  ticket_number?: string
  holder_name?: string
  holder_email?: string
  status?: string
  checked_in_at?: string | null
  tier_name?: string | null
  event?: { title: string; date: string }
}

interface CheckinResult {
  ok: boolean
  error?: string
  already_checked_in?: boolean
  checked_in_at?: string
  checked_in_by?: string
  gate?: string
}

interface GateEntry {
  ticketNumber: string
  holderName: string
  status: 'success' | 'already' | 'error'
  message: string
  time: string
}

export default function CheckinPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2" style={{ borderColor: '#7C3AED' }} />
        </div>
      </div>
    }>
      <CheckinPage />
    </Suspense>
  )
}

function CheckinPage() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [scannerActive, setScannerActive] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null)
  const [currentQrToken, setCurrentQrToken] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkinFeedback, setCheckinFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [gateLog, setGateLog] = useState<GateEntry[]>([])
  const [stats, setStats] = useState({ checkedIn: 0, total: 0, compCount: 0 })
  const [gateSelection, setGateSelection] = useState('Main Entrance')
  const [staffName, setStaffName] = useState('')
  const [gateCounters, setGateCounters] = useState<Record<string, number>>({})

  const scannerRef = useRef<any>(null)
  const scannerDivRef = useRef<HTMLDivElement>(null)

  const GATES = ['Main Entrance', 'VIP Gate', 'Side Door', 'Back Entrance']

  // Auth check
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthed(false); return }
      setAuthed(true)

      // Fetch publisher events
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || (profile.role !== 'publisher' && profile.role !== 'admin')) {
        setAuthed(false)
        return
      }

      let query = supabase
        .from('events')
        .select('id, title, date')
        .eq('status', 'published')
        .order('date', { ascending: false })

      if (profile.role !== 'admin') {
        query = query.eq('publisher_id', user.id)
      }

      const { data: evts } = await query
      if (evts) {
        setEvents(evts as EventOption[])
        const paramEventId = searchParams.get('event')
        if (paramEventId && evts.some((e: any) => e.id === paramEventId)) {
          setSelectedEventId(paramEventId)
        } else if (evts.length > 0) {
          setSelectedEventId((evts[0] as any).id)
        }
      }
    })()
  }, [])

  // Fetch stats when event changes
  useEffect(() => {
    if (!selectedEventId) return
    ;(async () => {
      const { data: tickets, count } = await supabase
        .from('tickets')
        .select('status, gate, is_comp', { count: 'exact' })
        .eq('event_id', selectedEventId)

      if (tickets) {
        const total = count || tickets.length
        const checkedIn = tickets.filter((t: any) => t.status === 'used').length
        const compCount = tickets.filter((t: any) => t.is_comp).length
        setStats({ checkedIn, total, compCount })

        // Gate counters
        const counters: Record<string, number> = {}
        tickets.filter((t: any) => t.status === 'used' && t.gate).forEach((t: any) => {
          counters[t.gate] = (counters[t.gate] || 0) + 1
        })
        setGateCounters(counters)
      }
    })()
  }, [selectedEventId, gateLog.length])

  // Extract QR token from URL
  const extractToken = useCallback((text: string): string => {
    try {
      const url = new URL(text)
      const t = url.searchParams.get('t')
      if (t) return t
    } catch {
      // Not a URL — treat as raw token or ticket number
    }
    return text.trim()
  }, [])

  // Validate a ticket
  const validateTicket = useCallback(async (tokenOrNumber: string) => {
    setValidating(true)
    setValidateResult(null)
    setCheckinFeedback(null)

    const token = extractToken(tokenOrNumber)
    setCurrentQrToken(token)

    try {
      const resp = await fetch(`/api/tickets/validate?t=${encodeURIComponent(token)}`)
      const data: ValidateResult = await resp.json()
      setValidateResult(data)
    } catch {
      setValidateResult({ ok: false, error: 'Network error' })
    } finally {
      setValidating(false)
    }
  }, [extractToken])

  // Start QR scanner
  const startScanner = useCallback(async () => {
    if (scannerRef.current) return

    const { Html5Qrcode } = await import('html5-qrcode')

    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // Stop scanner on successful scan
          scanner.stop().catch(() => {})
          scannerRef.current = null
          setScannerActive(false)
          validateTicket(decodedText)
        },
        () => {} // Ignore errors during scanning
      )
      setScannerActive(true)
    } catch (err: any) {
      console.warn('Scanner error:', err)
      setScannerActive(false)
      scannerRef.current = null
    }
  }, [validateTicket])

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setScannerActive(false)
  }, [])

  // Check-in handler
  const handleCheckin = async () => {
    if (!currentQrToken) return
    setCheckingIn(true)
    setCheckinFeedback(null)

    try {
      const resp = await fetch('/api/tickets/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_token: currentQrToken,
          gate: gateSelection,
          checked_in_by: staffName || undefined,
        }),
      })
      const data: CheckinResult = await resp.json()

      const entry: GateEntry = {
        ticketNumber: validateResult?.ticket_number || '???',
        holderName: validateResult?.holder_name || 'Unknown',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        status: 'success',
        message: '',
      }

      if (data.ok && !data.already_checked_in) {
        setCheckinFeedback({ type: 'success', msg: 'Checked in successfully!' })
        entry.status = 'success'
        entry.message = 'Checked in'
        // Update the validate result locally
        setValidateResult((prev) => prev ? { ...prev, status: 'used', checked_in_at: data.checked_in_at } : prev)
      } else if (data.ok && data.already_checked_in) {
        const checkinTime = new Date(data.checked_in_at!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        const gateInfo = data.gate ? ` at ${data.gate}` : ''
        const staffInfo = data.checked_in_by ? ` by ${data.checked_in_by}` : ''
        setCheckinFeedback({ type: 'error', msg: `Already checked in${gateInfo} at ${checkinTime}${staffInfo}` })
        entry.status = 'already'
        entry.message = 'Already checked in'
      } else {
        setCheckinFeedback({ type: 'error', msg: data.error === 'ticket_invalid' ? 'Ticket is cancelled or revoked' : (data.error || 'Check-in failed') })
        entry.status = 'error'
        entry.message = data.error || 'Failed'
      }

      setGateLog((prev) => [entry, ...prev].slice(0, 50))
    } catch {
      setCheckinFeedback({ type: 'error', msg: 'Network error during check-in' })
    } finally {
      setCheckingIn(false)
    }
  }

  // Manual lookup
  const handleManualLookup = () => {
    if (!manualInput.trim()) return
    validateTicket(manualInput.trim())
    setManualInput('')
  }

  // Reset for next scan
  const resetScan = () => {
    setValidateResult(null)
    setCheckinFeedback(null)
    setCurrentQrToken('')
  }

  if (authed === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2" style={{ borderColor: '#7C3AED' }} />
        </div>
      </div>
    )
  }

  if (authed === false) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        
        <main className="max-w-md mx-auto px-4 py-20 text-center">
          <LogIn size={48} style={{ color: '#4F46E5' }} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}>
            Check-In Scanner
          </h1>
          <p className="text-sm mb-6" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
            Please log in as a publisher to access the check-in scanner.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: '#4F46E5', color: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}
          >
            <LogIn size={16} />
            Log In
          </a>
        </main>
        
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-6"
          style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
        >
          Check-In Scanner
        </h1>

        {/* Event selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>
            Select Event
          </label>
          <div className="relative">
            <select
              value={selectedEventId}
              onChange={(e) => { setSelectedEventId(e.target.value); resetScan() }}
              className="w-full px-4 py-3 rounded-xl border appearance-none text-sm font-medium pr-10"
              style={{
                backgroundColor: '#fff',
                borderColor: '#E2E8F0',
                color: '#334155',
              }}
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {e.date}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
          </div>
        </div>

        {/* Gate & Staff selection */}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>Gate / Entrance</label>
            <div className="relative">
              <select
                value={gateSelection}
                onChange={(e) => setGateSelection(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border appearance-none text-sm font-medium pr-10"
                style={{ backgroundColor: '#fff', borderColor: '#E2E8F0', color: '#334155' }}
              >
                {GATES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>Staff Name</label>
            <input
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Who is scanning..."
              className="w-full px-4 py-3 rounded-xl border text-sm"
              style={{ borderColor: '#E2E8F0', color: '#334155' }}
            />
          </div>
        </div>

        {/* Stats bar */}
        <div
          className="flex flex-wrap items-center gap-4 px-5 py-3 rounded-xl mb-4"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
        >
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: '#4F46E5' }} />
            <span className="text-sm font-medium" style={{ color: '#334155' }}>Checked In</span>
            <span className="text-lg font-bold" style={{ color: '#4F46E5' }}>
              {stats.checkedIn} <span className="text-sm font-normal" style={{ color: '#94A3B8' }}>/ {stats.total}</span>
            </span>
          </div>
          {stats.compCount > 0 && (
            <div className="flex items-center gap-1 text-sm" style={{ color: '#E65100' }}>
              <span className="font-semibold">{stats.compCount}</span> comp
            </div>
          )}
        </div>

        {/* Gate throughput counters */}
        {Object.keys(gateCounters).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(gateCounters).sort((a, b) => b[1] - a[1]).map(([gate, count]) => (
              <div
                key={gate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: gate === gateSelection ? '#4F46E5' : '#fff',
                  color: gate === gateSelection ? '#F8FAFC' : '#475569',
                  border: gate === gateSelection ? 'none' : '1px solid #E2E8F0',
                }}
              >
                <LogIn size={12} />
                {gate}: <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Scanner + Manual */}
        {!validateResult && (
          <div className="space-y-4">
            {/* QR Scanner */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Camera size={18} style={{ color: '#4F46E5' }} />
                    <span className="text-sm font-semibold" style={{ color: '#334155' }}>QR Scanner</span>
                  </div>
                  <button
                    onClick={scannerActive ? stopScanner : startScanner}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: scannerActive ? '#FEE2E2' : '#4F46E5',
                      color: scannerActive ? '#C62828' : '#F8FAFC',
                    }}
                  >
                    {scannerActive ? 'Stop Camera' : 'Start Camera'}
                  </button>
                </div>
                <div
                  id="qr-reader"
                  ref={scannerDivRef}
                  className="rounded-lg overflow-hidden"
                  style={{
                    minHeight: scannerActive ? 300 : 0,
                    display: scannerActive ? 'block' : 'none',
                  }}
                />
                {!scannerActive && (
                  <div
                    className="flex flex-col items-center justify-center py-8 rounded-lg"
                    style={{ backgroundColor: '#F5EFE0' }}
                  >
                    <Camera size={32} style={{ color: '#94A3B8' }} />
                    <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>
                      Tap "Start Camera" to scan QR codes
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Manual lookup */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Search size={18} style={{ color: '#4F46E5' }} />
                <span className="text-sm font-semibold" style={{ color: '#334155' }}>Manual Lookup</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                  placeholder="Ticket number or confirmation code..."
                  className="flex-1 px-4 py-3 rounded-lg border text-sm"
                  style={{ borderColor: '#E2E8F0', color: '#334155' }}
                />
                <button
                  onClick={handleManualLookup}
                  disabled={validating}
                  className="px-5 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                >
                  {validating ? 'Looking...' : 'Look Up'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validating spinner */}
        {validating && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2" style={{ borderColor: '#7C3AED' }} />
          </div>
        )}

        {/* Validation result */}
        {validateResult && !validating && (
          <div
            className="rounded-xl overflow-hidden mb-4"
            style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
          >
            {validateResult.ok ? (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Ticket size={20} style={{ color: '#4F46E5' }} />
                  <span className="font-bold text-lg" style={{ color: '#334155' }}>Ticket Found</span>
                </div>

                <div className="space-y-3 mb-5">
                  <div>
                    <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>Holder</div>
                    <div className="text-base font-semibold" style={{ color: '#334155' }}>{validateResult.holder_name}</div>
                    <div className="text-sm" style={{ color: '#475569' }}>{validateResult.holder_email}</div>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>Ticket #</div>
                      <div className="text-sm font-mono font-semibold" style={{ color: '#4F46E5' }}>{validateResult.ticket_number}</div>
                    </div>
                    {validateResult.tier_name && (
                      <div>
                        <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>Tier</div>
                        <div className="text-sm font-medium" style={{ color: '#334155' }}>{validateResult.tier_name}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>Status</div>
                    <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: validateResult.status === 'active' ? '#D1FAE5' : validateResult.status === 'used' ? '#E3F2FD' : '#FEE2E2',
                        color: validateResult.status === 'active' ? '#2E7D32' : validateResult.status === 'used' ? '#1565C0' : '#C62828',
                      }}
                    >
                      {validateResult.status === 'active' ? 'Active' : validateResult.status === 'used' ? 'Already Checked In' : validateResult.status === 'cancelled' ? 'Cancelled' : 'Revoked'}
                    </span>
                    {validateResult.status === 'used' && validateResult.checked_in_at && (
                      <span className="text-xs ml-2" style={{ color: '#475569' }}>
                        at {new Date(validateResult.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Check-in feedback */}
                {checkinFeedback && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg mb-4 animate-pulse"
                    style={{
                      backgroundColor: checkinFeedback.type === 'success' ? '#D1FAE5' : '#FEE2E2',
                      color: checkinFeedback.type === 'success' ? '#2E7D32' : '#C62828',
                    }}
                  >
                    {checkinFeedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    <span className="text-sm font-semibold">{checkinFeedback.msg}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  {validateResult.status === 'active' && !checkinFeedback && (
                    <button
                      onClick={handleCheckin}
                      disabled={checkingIn}
                      className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#2E7D32', color: '#fff' }}
                    >
                      {checkingIn ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white" />
                      ) : (
                        <CheckCircle2 size={22} />
                      )}
                      {checkingIn ? 'Checking In...' : 'Check In'}
                    </button>
                  )}
                  <button
                    onClick={resetScan}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-base font-semibold border-2 transition-all hover:opacity-80"
                    style={{ borderColor: '#4F46E5', color: '#4F46E5' }}
                  >
                    Scan Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 text-center">
                <XCircle size={40} style={{ color: '#C62828' }} className="mx-auto mb-3" />
                <p className="text-base font-semibold mb-1" style={{ color: '#C62828' }}>
                  {validateResult.error || 'Ticket not found'}
                </p>
                <p className="text-sm mb-4" style={{ color: '#475569' }}>
                  This QR code or ticket number was not recognized.
                </p>
                <button
                  onClick={resetScan}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Gate log */}
        {gateLog.length > 0 && (
          <div
            className="rounded-xl overflow-hidden mt-6"
            style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <span className="text-sm font-semibold" style={{ color: '#334155' }}>
                Recent Check-ins ({gateLog.length})
              </span>
            </div>
            <ul>
              {gateLog.map((entry, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < gateLog.length - 1 ? '1px solid #F5EFE0' : undefined }}
                >
                  {entry.status === 'success' ? (
                    <CheckCircle2 size={16} style={{ color: '#2E7D32' }} />
                  ) : entry.status === 'already' ? (
                    <AlertTriangle size={16} style={{ color: '#4F46E5' }} />
                  ) : (
                    <XCircle size={16} style={{ color: '#C62828' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block" style={{ color: '#334155' }}>
                      {entry.holderName}
                    </span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>
                      {entry.ticketNumber} — {entry.message}
                    </span>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>
                    {entry.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      
    </div>
  )
}
