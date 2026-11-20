'use client'

import { useState } from 'react'

export default function WalletButtons({ ticketNumber }: { ticketNumber: string }) {
  const [showModal, setShowModal] = useState(false)
  const [walletType, setWalletType] = useState<'apple' | 'google'>('apple')

  const handleClick = (type: 'apple' | 'google') => {
    setWalletType(type)
    setShowModal(true)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, marginBottom: 8 }}>
        {/* Apple Wallet Button */}
        <button
          onClick={() => handleClick('apple')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 8,
            background: '#000',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.82 11.77 5.74 12.56 5.74C13.34 5.74 14.79 4.62 16.36 4.8C17.03 4.83 18.77 5.08 19.9 6.72C19.82 6.77 17.72 7.94 17.74 10.52C17.77 13.6 20.43 14.56 20.46 14.57C20.43 14.65 20.03 16.02 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
          </svg>
          Add to Apple Wallet
        </button>

        {/* Google Wallet Button */}
        <button
          onClick={() => handleClick('google')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 8,
            background: '#1a73e8',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Add to Google Wallet
        </button>
      </div>

      {/* Coming Soon Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '32px 28px',
              maxWidth: 400,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: walletType === 'apple' ? '#000' : '#1a73e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              {walletType === 'apple' ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.82 11.77 5.74 12.56 5.74C13.34 5.74 14.79 4.62 16.36 4.8C17.03 4.83 18.77 5.08 19.9 6.72C19.82 6.77 17.72 7.94 17.74 10.52C17.77 13.6 20.43 14.56 20.46 14.57C20.43 14.65 20.03 16.02 18.71 19.5Z"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
                  <path d="M3 6h18v12H3V6zm9 9c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z"/>
                </svg>
              )}
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#0F172A',
                marginBottom: 8,
                fontFamily: 'Plus Jakarta Sans, serif',
              }}
            >
              Coming Soon
            </h2>
            <p
              style={{
                color: '#666',
                fontSize: 14,
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              {walletType === 'apple'
                ? 'Apple Wallet passes require an Apple Developer certificate. We are working on adding this feature.'
                : 'Google Wallet passes require a Google Cloud service account. We are working on adding this feature.'}
            </p>
            <p style={{ color: '#999', fontSize: 12, marginBottom: 24 }}>
              In the meantime, you can download the PDF ticket or take a screenshot of your QR code.
            </p>
            <button
              onClick={() => setShowModal(false)}
              style={{
                padding: '10px 32px',
                borderRadius: 8,
                background: '#4F46E5',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
