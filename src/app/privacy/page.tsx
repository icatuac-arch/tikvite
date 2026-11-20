
export const metadata = {
  title: 'Privacy Policy - Ticvite',
  description: 'Ticvite Privacy Policy. Learn how we collect, use, and protect your personal information.',
}

export default function PrivacyPage() {
  return (
    <>
      
      <main className="bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-white p-8 shadow-sm sm:p-12">
            <h1 className="font-heading text-3xl font-bold text-text">Privacy Policy</h1>
            <p className="mt-2 text-sm text-text-muted">Last updated: October 14, 2026</p>

            <div className="mt-10 space-y-8 text-sm leading-relaxed text-text-secondary">
              <section>
                <h2 className="font-heading text-lg font-semibold text-text">1. Information We Collect</h2>
                <p className="mt-3">
                  We collect information you provide directly, including your name, email address, and any other
                  details you submit when creating an account or listing an event. We also collect usage data
                  such as pages visited, features used, browser type, device information, and IP address.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">2. How We Use Your Information</h2>
                <p className="mt-3">
                  We use your information to provide and improve the Platform, process transactions, send
                  communications related to your account and events, ensure security, and comply with legal
                  obligations. We may also use aggregated, anonymized data for analytics and service improvement.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">3. Information Sharing</h2>
                <p className="mt-3">
                  We do not sell your personal information. We may share information with service providers who
                  assist in operating the Platform (such as Stripe for payment processing), when required by law,
                  or to protect the rights and safety of our users and the public. Event organizers receive
                  attendee information necessary to fulfill the event.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">4. Cookies</h2>
                <p className="mt-3">
                  We use cookies and similar technologies to maintain your session, remember your preferences,
                  and understand how you interact with the Platform. You can control cookie settings through
                  your browser, though some features may not function properly without them.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">5. Security</h2>
                <p className="mt-3">
                  We implement industry-standard security measures to protect your information, including
                  encryption in transit and at rest. However, no method of transmission or storage is completely
                  secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">6. Your Rights</h2>
                <p className="mt-3">
                  You have the right to access, correct, or delete your personal information. You may update your
                  account details at any time through your profile settings. To request data deletion, please
                  contact us at the email below. We will respond to requests within 30 days.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">7. Children</h2>
                <p className="mt-3">
                  Ticvite is not intended for use by individuals under the age of 13. We do not knowingly
                  collect personal information from children. If we learn that we have collected information
                  from a child under 13, we will take steps to delete it promptly.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">8. Changes to This Policy</h2>
                <p className="mt-3">
                  We may update this Privacy Policy from time to time. We will notify you of material changes
                  by posting the updated policy on the Platform and updating the effective date. Your continued
                  use after changes are posted constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-text">9. Contact</h2>
                <p className="mt-3">
                  If you have questions about this Privacy Policy or your personal data, contact us at{' '}
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
