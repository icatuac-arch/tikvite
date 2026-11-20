
export const metadata = {
  title: 'Terms of Service - Ticvite',
  description: 'Ticvite Terms of Service. Read about your rights and responsibilities when using our platform.',
}

export default function TermsPage() {
  return (
    <>
      
      <main className="bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-white p-8 shadow-sm sm:p-12">
            <h1 className="font-heading text-3xl font-bold text-text">Terms of Service</h1>
            <p className="mt-2 text-sm text-text-muted">Last updated: October 14, 2026</p>

            <div className="mt-10 space-y-8 text-sm leading-relaxed text-text-secondary">
              <section>
                <h2 className="font-heading text-lg font-semibold text-text">1. Acceptance of Terms</h2>
                <p className="mt-3">
                  By accessing or using Ticvite (&quot;the Platform&quot;), you agree to be bound by these Terms of Service.
                  If you do not agree to these terms, you may not use the Platform. We may update these terms from
                  time to time, and your continued use constitutes acceptance of any changes.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">2. Description of Service</h2>
                <p className="mt-3">
                  Ticvite is an event ticketing platform that allows organizers to create event pages, manage
                  ticket sales, and facilitate check-ins. Attendees can discover events, purchase tickets, and
                  manage their bookings through the Platform.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">3. Accounts</h2>
                <p className="mt-3">
                  You are responsible for maintaining the confidentiality of your account credentials. You must
                  provide accurate information when creating your account. You are responsible for all activity
                  that occurs under your account. You must notify us immediately of any unauthorized use.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">4. Events</h2>
                <p className="mt-3">
                  Event organizers are solely responsible for the accuracy of event information, fulfillment of
                  the event as described, and compliance with all applicable local, state, and federal laws.
                  Ticvite does not guarantee the quality, safety, or legality of any event listed on the Platform.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">5. Payments</h2>
                <p className="mt-3">
                  Ticvite does not charge any platform fees to organizers or attendees. Payment processing is
                  handled by Stripe, and standard Stripe processing fees apply to paid ticket transactions.
                  Ticvite does not hold, manage, or have access to funds from ticket sales. All payments are
                  processed directly between the attendee and the organizer through Stripe.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">6. Prohibited Content</h2>
                <p className="mt-3">
                  You may not use the Platform to publish or promote events that are fraudulent, illegal,
                  discriminatory, or harmful. We reserve the right to remove any content or suspend any account
                  that violates these terms or that we deem inappropriate at our sole discretion.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">7. Limitation of Liability</h2>
                <p className="mt-3">
                  To the maximum extent permitted by law, Ticvite shall not be liable for any indirect, incidental,
                  special, consequential, or punitive damages arising from your use of the Platform. Ticvite acts as
                  a platform connecting organizers and attendees and is not responsible for disputes between parties.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">8. Changes to Terms</h2>
                <p className="mt-3">
                  We reserve the right to modify these terms at any time. Material changes will be communicated
                  via email or through a prominent notice on the Platform. Your continued use after changes are
                  posted constitutes acceptance of the updated terms.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">9. Contact</h2>
                <p className="mt-3">
                  If you have any questions about these Terms of Service, please contact us at{' '}
                  <a href="mailto:support@ticvite.com" className="font-medium text-primary hover:text-primary-dark transition-colors">
                    support@ticvite.com
                  </a>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      
    </>
  )
}
