
export const metadata = {
  title: 'Refund Policy - Ticvite',
  description: 'Ticvite Refund Policy. Understand how refunds work for events on our platform.',
}

export default function RefundPolicyPage() {
  return (
    <>
      
      <main className="bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-white p-8 shadow-sm sm:p-12">
            <h1 className="font-heading text-3xl font-bold text-text">Refund Policy</h1>
            <p className="mt-2 text-sm text-text-muted">Last updated: October 14, 2026</p>

            <div className="mt-10 space-y-8 text-sm leading-relaxed text-text-secondary">
              <section>
                <h2 className="font-heading text-lg font-semibold text-text">Overview</h2>
                <p className="mt-3">
                  Ticvite is a ticketing platform that connects event organizers with attendees. We facilitate
                  the sale of tickets but do not hold funds or act as the merchant of record. All payments are
                  processed directly through Stripe between the organizer and the attendee.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">Organizer Discretion</h2>
                <p className="mt-3">
                  Refund policies are set by individual event organizers. Each event may have its own refund
                  terms, which are displayed on the event page at the time of purchase. Organizers are
                  responsible for honoring their stated refund policy.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">How Refunds Work</h2>
                <p className="mt-3">
                  Since Ticvite does not hold or manage funds, refunds are processed by the event organizer
                  through Stripe. When an organizer approves a refund, it is issued directly to the
                  attendee&apos;s original payment method via Stripe. Refunds typically take 5-10 business days
                  to appear on your statement, depending on your financial institution.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">Stripe Processing Fees</h2>
                <p className="mt-3">
                  Please note that Stripe processing fees are generally non-refundable. When a refund is issued,
                  the attendee receives back the ticket price, but the original Stripe processing fee may not
                  be returned. This is a Stripe policy and is outside of Ticvite&apos;s control.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">How to Request a Refund</h2>
                <div className="mt-3 space-y-2">
                  <p>To request a refund for a ticket purchase:</p>
                  <ol className="ml-4 list-decimal space-y-1.5">
                    <li>Contact the event organizer directly through the event page or your confirmation email.</li>
                    <li>Provide your order details, including the ticket reference number.</li>
                    <li>The organizer will review your request based on their refund policy.</li>
                    <li>If approved, the organizer will process the refund through Stripe.</li>
                  </ol>
                </div>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">Cancelled Events</h2>
                <p className="mt-3">
                  If an event is cancelled by the organizer, attendees are entitled to a full refund. Organizers
                  are expected to process refunds promptly upon cancellation. If you have difficulty obtaining
                  a refund for a cancelled event, please contact us.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">Need Help?</h2>
                <p className="mt-3">
                  If you are unable to resolve a refund issue with the event organizer, contact us at{' '}
                  <a href="mailto:support@ticvite.com" className="font-medium text-primary hover:text-primary-dark transition-colors">
                    support@ticvite.com
                  </a>{' '}
                  and we will do our best to assist.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      
    </>
  )
}
