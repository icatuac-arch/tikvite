'use client'

import { useState } from 'react'

export default function TicketTransferButton({ ticketNumber }: { ticketNumber: string }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const handleTransfer = async () => {
    if (!name.trim() || !email.trim()) {
      setResult({ type: 'error', msg: 'Name and email are required.' })
      return
    }

    if (!window.confirm(`Transfer this ticket to ${name} (${email})? The current QR code will be invalidated and a new one will be sent to the new holder.`)) {
      return
    }

    setSubmitting(true)
    setResult(null)

    try {
      const resp = await fetch('/api/tickets/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_number: ticketNumber,
          new_holder_name: name.trim(),
          new_holder_email: email.trim(),
        }),
      })
      const data = await resp.json()

      if (data.ok) {
        setResult({ type: 'success', msg: `Ticket transferred to ${data.new_holder_name}. A new QR code has been sent to ${data.new_holder_email}. This page will reload.` })
        setTimeout(() => window.location.reload(), 3000)
      } else {
        setResult({ type: 'error', msg: data.error || 'Transfer failed.' })
      }
    } catch {
      setResult({ type: 'error', msg: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            padding: '10px 28px',
            borderRadius: 8,
            border: '2px solid #4F46E5',
            background: 'transparent',
            color: '#4F46E5',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Transfer Ticket
        </button>
      ) : (
        <div style={{ background: '#F5EFE0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 12, fontFamily: 'Plus Jakarta Sans, serif' }}>
            Transfer Ticket
          </div>
          <p style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
            Enter the new holder&apos;s details. Your current QR code will be invalidated and a new one will be sent to them.
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New holder's full name"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 14,
              marginBottom: 8,
              color: '#334155',
              fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="New holder's email"
            type="email"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 14,
              marginBottom: 12,
              color: '#334155',
              fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box',
            }}
          />

          {result && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: result.type === 'success' ? '#D1FAE5' : '#FEE2E2',
              color: result.type === 'success' ? '#2E7D32' : '#C62828',
            }}>
              {result.msg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleTransfer}
              disabled={submitting}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                background: '#4F46E5',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {submitting ? 'Transferring...' : 'Confirm Transfer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setResult(null) }}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                background: 'transparent',
                color: '#475569',
                fontWeight: 500,
                fontSize: 14,
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
