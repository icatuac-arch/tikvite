import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { buildTicketQrUrl } from '@/lib/tickets'
import TicketTransferButton from './TicketTransferButton'
import WalletButtons from './WalletButtons'
import TicketActions from './TicketActions'

interface PageProps {
  params: { ticketNumber: string }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export default async function TicketPage({ params }: PageProps) {
  const { ticketNumber } = params
  if (!ticketNumber) return notFound()

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, events(*)')
    .eq('ticket_number', decodeURIComponent(ticketNumber))
    .single()

  if (!ticket) return notFound()

  const event = ticket.events as any
  const qrUrl = buildTicketQrUrl(ticket.qr_token)
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2, errorCorrectionLevel: 'M' })

  // Fetch event updates
  const { data: eventUpdates } = await supabase
    .from('event_updates')
    .select('id, title, message, created_at')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch organizer info
  let organizerName = event?.publisher_name || ''
  let organizerEmail = ''
  if (event?.submitter_email) {
    organizerEmail = event.submitter_email
  } else if (event?.publisher_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', event.publisher_id)
      .single()
    if (profile) {
      organizerName = organizerName || profile.name || ''
      organizerEmail = profile.email || ''
    }
  }

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: '#D1FAE5', text: '#2E7D32', label: 'Active' },
    used: { bg: '#E3F2FD', text: '#1565C0', label: 'Checked In' },
    cancelled: { bg: '#FEE2E2', text: '#C62828', label: 'Cancelled' },
    revoked: { bg: '#FFF3E0', text: '#E65100', label: 'Revoked' },
  }
  const st = statusColors[ticket.status] || statusColors.active

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px 60px' }}>
        {/* Digital Check-in Welcome Banner */}
        {ticket.status === 'used' && (
          <div style={{
            background: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #22c55e 100%)',
            borderRadius: 16,
            padding: '28px 24px',
            marginBottom: 20,
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(22,101,52,0.25)',
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{
              color: '#fff',
              fontSize: 24,
              fontWeight: 700,
              margin: '0 0 6px',
              fontFamily: 'Plus Jakarta Sans, serif',
            }}>
              Welcome! Enjoy the Event
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 16,
              fontWeight: 500,
              margin: '0 0 12px',
              fontFamily: 'Inter, sans-serif',
            }}>
              {event?.title || 'Event'}
            </p>
            {ticket.checked_in_at && (
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                margin: 0,
                fontFamily: 'Inter, sans-serif',
              }}>
                Checked in at {new Date(ticket.checked_in_at).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {ticket.gate ? ` via ${ticket.gate}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Ticket card */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {/* Event poster */}
          {event?.image_url && (
            <div style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden' }}>
              <img
                src={event.image_url}
                alt={event.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          <div style={{ padding: '24px 28px' }}>
            {/* Event title */}
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#4F46E5', margin: '0 0 4px' }}>
              {event?.title || 'Event'}
            </h1>

            {/* Date & venue */}
            <div style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              {event?.date && <div>{event.date}{event.time ? ` at ${event.time}` : ''}</div>}
              {event?.venue && <div>{event.venue}</div>}
              {event?.address && <div style={{ fontSize: 13 }}>{event.address}{event.city ? `, ${event.city}` : ''}{event.state ? `, ${event.state}` : ''}</div>}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '2px dashed #E0D5C5', margin: '0 -28px', padding: '0 28px' }} />

            {/* Holder info */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticket Holder</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#333', marginTop: 2 }}>{ticket.holder_name}</div>
            </div>

            {/* Transfer info */}
            {ticket.transferred_from_name && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                Transferred from {ticket.transferred_from_name}
                {ticket.transferred_at && (
                  <span> on {new Date(ticket.transferred_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                )}
              </div>
            )}

            {/* Ticket number */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticket Number</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: '#4F46E5', marginTop: 2, letterSpacing: '0.06em' }}>
                {ticket.ticket_number}
              </div>
            </div>

            {/* Status badge */}
            <div style={{ marginTop: 16 }}>
              <span style={{
                display: 'inline-block',
                background: st.bg,
                color: st.text,
                padding: '4px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
              }}>
                {st.label}
              </span>
              {ticket.is_comp && (
                <span style={{
                  display: 'inline-block',
                  background: '#FFF3E0',
                  color: '#E65100',
                  padding: '4px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  marginLeft: 8,
                }}>
                  Comp
                </span>
              )}
            </div>

            {/* Check-in info */}
            {ticket.status === 'used' && ticket.checked_in_at && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
                Checked in at {new Date(ticket.checked_in_at).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {ticket.gate && <span> via {ticket.gate}</span>}
              </div>
            )}

            {/* Cancelled message */}
            {ticket.status === 'cancelled' && (
              <div style={{ marginTop: 12, fontSize: 14, color: '#C62828', fontWeight: 500 }}>
                This ticket has been cancelled.
              </div>
            )}

            {/* QR Code */}
            {(ticket.status === 'active' || ticket.status === 'used') && (
              <div style={{ textAlign: 'center', marginTop: 24, padding: '20px 0' }}>
                <img
                  src={qrDataUrl}
                  alt="Ticket QR Code"
                  width={220}
                  height={220}
                  style={{ borderRadius: 8 }}
                />
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>Scan at entry for check-in</div>
              </div>
            )}

            {/* Download PDF */}
            {ticket.status === 'active' && (
              <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 8 }}>
                <a
                  href={`/api/tickets/pdf?ticket_number=${encodeURIComponent(ticket.ticket_number)}`}
                  style={{
                    display: 'inline-block',
                    background: '#4F46E5',
                    color: '#fff',
                    padding: '10px 28px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Download PDF Ticket
                </a>
              </div>
            )}

            {/* Wallet Buttons */}
            {ticket.status === 'active' && (
              <WalletButtons ticketNumber={ticket.ticket_number} />
            )}

            {/* Transfer Ticket button */}
            {ticket.status === 'active' && (
              <TicketTransferButton ticketNumber={ticket.ticket_number} />
            )}

            {/* Cancel, Calendar, Directions, Contact Organizer */}
            <TicketActions
              ticketNumber={ticket.ticket_number}
              ticketStatus={ticket.status}
              holderEmail={ticket.holder_email || ''}
              eventTitle={event?.title || ''}
              eventDescription={event?.description || ''}
              eventDate={event?.date || ''}
              eventTime={event?.time || ''}
              eventVenue={event?.venue || ''}
              eventCity={event?.city || ''}
              eventState={event?.state || ''}
              eventAddress={event?.address || ''}
              organizerName={organizerName}
              organizerEmail={organizerEmail}
              allowSelfCancel={!!event?.allow_self_cancel}
            />
          </div>

          {/* Footer branding */}
          <div style={{
            background: '#F5EFE0',
            padding: '12px 28px',
            textAlign: 'center',
            fontSize: 12,
            color: '#999',
          }}>
            Ticvite.com
          </div>
        </div>

        {/* Event Updates Section */}
        {eventUpdates && eventUpdates.length > 0 && (
          <div style={{
            marginTop: 24,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 28px 8px',
              borderBottom: '1px solid #E2E8F0',
            }}>
              <h2 style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#4F46E5',
                margin: 0,
                fontFamily: 'Plus Jakarta Sans, serif',
              }}>
                Event Updates
              </h2>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 12px' }}>
                Latest announcements from the organizer
              </p>
            </div>
            <div style={{ padding: '16px 28px 24px' }}>
              {eventUpdates.map((upd: any, idx: number) => (
                <div
                  key={upd.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: idx < eventUpdates.length - 1 ? '1px solid #F0EBE0' : 'none',
                  }}
                >
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#4F46E5',
                    marginBottom: 4,
                  }}>
                    {upd.title}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#334155',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {upd.message}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#94A3B8',
                    marginTop: 6,
                  }}>
                    {new Date(upd.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(upd.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      
    </div>
  )
}
