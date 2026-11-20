'use client'

import { useEffect, useState } from 'react'

interface Props {
  sessionId: string
}

export default function CheckoutSuccessPoller({ sessionId }: Props) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'))
    }, 600)

    const pollInterval = setInterval(() => {
      // Reload the page to let the server component re-check the order status
      window.location.reload()
    }, 3000)

    return () => {
      clearInterval(dotInterval)
      clearInterval(pollInterval)
    }
  }, [sessionId])

  return (
    <div className="text-center py-16" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="text-4xl mb-4">&#9203;</div>
      <h1
        className="text-2xl font-bold mb-3"
        style={{ color: '#4F46E5', fontFamily: 'Plus Jakarta Sans, serif' }}
      >
        Processing your payment{dots}
      </h1>
      <p style={{ color: '#475569' }}>
        Please wait while we confirm your payment. This usually takes just a few seconds.
      </p>
      <div className="mt-8">
        <div
          className="inline-block w-8 h-8 border-3 rounded-full animate-spin"
          style={{
            borderColor: '#E2E8F0',
            borderTopColor: '#7C3AED',
            borderWidth: '3px',
          }}
        />
      </div>
    </div>
  )
}
