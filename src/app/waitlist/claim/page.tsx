'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2, Ticket } from 'lucide-react'

export default function WaitlistClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }} />}>
      <ClaimContent />
    </Suspense>
  )
}

function ClaimContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'claimed' | 'already' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [ticketNumbers, setTicketNumbers] = useState<string[]>([])

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Missing claim token'); return }

    fetch('/api/waitlist/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          if (data.already_claimed) setStatus('already')
          else {
            setStatus('claimed')
            setTicketNumbers(data.ticket_numbers || [])
          }
        } else {
          setStatus('error')
          setErrorMsg(data.error || 'Claim failed')
        }
      })
      .catch(() => { setStatus('error'); setErrorMsg('Network error') })
  }, [token])

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            {status === 'loading' && (
              <div className="space-y-4">
                <Loader2 size={48} className="mx-auto animate-spin" style={{ color: '#4F46E5' }} />
                <h1 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#0F172A' }}>
                  Claiming your spot...
                </h1>
              </div>
            )}

            {status === 'claimed' && (
              <div className="space-y-4">
                <CheckCircle2 size={56} className="mx-auto" style={{ color: '#2D7A3A' }} />
                <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#0F172A' }}>
                  You&apos;re in!
                </h1>
                <p className="text-sm" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                  Your spot has been confirmed. Check your email for your tickets.
                </p>
                {ticketNumbers.length > 0 && (
                  <Link
                    href={`/ticket/${ticketNumbers[0]}`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
                  >
                    <Ticket size={16} /> View My Ticket
                  </Link>
                )}
              </div>
            )}

            {status === 'already' && (
              <div className="space-y-4">
                <CheckCircle2 size={48} className="mx-auto" style={{ color: '#2D7A3A' }} />
                <h1 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#0F172A' }}>
                  Already confirmed
                </h1>
                <p className="text-sm" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                  Your spot was already claimed. Check your email for tickets.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <XCircle size={48} className="mx-auto" style={{ color: '#C62828' }} />
                <h1 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#0F172A' }}>
                  Claim failed
                </h1>
                <p className="text-sm" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
                  {errorMsg}
                </p>
              </div>
            )}

            <div className="mt-6">
              <Link href="/" className="text-sm hover:underline" style={{ color: '#4F46E5' }}>
                Browse events
              </Link>
            </div>
          </div>
        </div>
      </main>
      
    </div>
  )
}
