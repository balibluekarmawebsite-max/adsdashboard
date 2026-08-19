import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

// Public, self-contained page (no auth, no database) so it is always reachable
// — Google's OAuth branding verification and any user must be able to load it
// without signing in. Route protection only gates /dashboard/*, so this is
// public by default.

const COMPANY = "Blue Karma Secrets";
const APP_NAME = "Blue Karma Ads Dashboard";
const CONTACT_EMAIL = "privacy@bluekarmasecrets.com"; // change to your preferred inbox
const LAST_UPDATED = "19 August 2026";

export const metadata: Metadata = {
  title: `Privacy Policy · ${APP_NAME}`,
  description: `How ${APP_NAME} collects, uses, and protects data, including data accessed through the Google and Meta advertising APIs.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-foreground text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground mt-3 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-background text-foreground min-h-screen px-6 py-16">
      <article className="mx-auto w-full max-w-3xl">
        <header className="border-border border-b pb-8">
          <Link href="/" aria-label={COMPANY}>
            <Logo className="text-foreground w-48" />
          </Link>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="text-muted-foreground mt-3">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <div className="mt-8">
          <p className="text-muted-foreground leading-relaxed">
            This Privacy Policy explains how {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) handles
            information within {APP_NAME} (the &ldquo;Service&rdquo;), an internal analytics dashboard
            we operate to review the performance of <strong>our own</strong> advertising accounts on
            Google Ads and Meta (Facebook and Instagram). The Service is used by authorized {COMPANY}{" "}
            team members only; it is not a consumer product and is not open to public sign-up.
          </p>

          <Section title="Information we process">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Team account details.</strong> The name, email address, and a securely hashed
                password of each authorized user we create for signing in to the dashboard.
              </li>
              <li>
                <strong>Advertising performance data.</strong> Aggregated reporting metrics pulled
                from our own ad accounts — such as campaign names, impressions, clicks, spend,
                conversions, and dates. This is campaign-level performance data; it does not include
                the personal information of the people who saw or clicked our ads.
              </li>
              <li>
                <strong>Platform access tokens.</strong> The OAuth refresh token (Google) and system
                user token (Meta) that let the Service read our reporting data. These are stored{" "}
                <strong>encrypted</strong> and are never shown in the interface.
              </li>
              <li>
                <strong>A sign-in session cookie.</strong> Set after you log in, solely to keep you
                authenticated. We do not use advertising or third-party tracking cookies.
              </li>
            </ul>
          </Section>

          <Section title="How we use information">
            <p>We use the information above only to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>authenticate authorized team members and secure the dashboard;</li>
              <li>
                retrieve and display our advertising performance across properties and platforms; and
              </li>
              <li>
                generate short, plain-language summaries of our <em>own</em> aggregated metrics to
                help us read the results.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> sell any data, use it for advertising or ad targeting, or
              build profiles of individuals.
            </p>
          </Section>

          <Section title="Google user data — Limited Use">
            <p>
              {APP_NAME} accesses Google Ads reporting data through the Google Ads API using
              read-only access to accounts we own or manage. Our use and transfer of information
              received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-foreground underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including its Limited Use requirements. Specifically, we:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>use the data only to provide and improve this internal reporting dashboard;</li>
              <li>do not transfer or sell the data to third parties for advertising or any other purpose;</li>
              <li>do not use the data for advertising; and</li>
              <li>
                do not allow humans to read the data, except where required for security, to comply
                with applicable law, or as part of operating the Service for our own accounts with
                the account owner&rsquo;s authorization.
              </li>
            </ul>
            <p>
              You can review or revoke the Service&rsquo;s access to a Google Account at any time at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-foreground underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                myaccount.google.com/permissions
              </a>
              .
            </p>
          </Section>

          <Section title="Meta advertising data">
            <p>
              We read reporting insights for our own Meta ad accounts using a system user token with
              read-only permissions (<code>ads_read</code>). As with Google, this data is used solely
              to display our advertising performance and is not shared or sold.
            </p>
          </Section>

          <Section title="Where data is stored and how we protect it">
            <p>
              The Service is self-hosted on infrastructure we control. Reporting data is stored in our
              own PostgreSQL database. We apply reasonable safeguards, including encryption in transit
              (HTTPS), encryption of stored platform tokens (AES-256-GCM), password hashing (bcrypt),
              and access limited to authorized team members. No method of storage or transmission is
              perfectly secure, but we work to protect information appropriately.
            </p>
          </Section>

          <Section title="Data sharing">
            <p>
              We do not sell or rent information, and we do not share it with third parties for their
              own purposes. Data is exchanged only with the advertising platforms whose reporting we
              read (Google and Meta) in order to operate the Service.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              We keep advertising metrics for as long as they are useful for historical reporting, and
              team account records for as long as a person remains an authorized user. You may request
              deletion of your account or of stored data by contacting us.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              Because this is an internal tool, access is managed by {COMPANY}. Authorized users may
              request access to, correction of, or deletion of their account information, and may
              revoke the Service&rsquo;s platform access as described above.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              &ldquo;Last updated&rdquo; date above.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              For any questions about this policy or your data, contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-foreground underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <footer className="border-border text-muted-foreground mt-14 border-t pt-8 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
          </div>
          <p className="mt-4">
            © {new Date().getFullYear()} {COMPANY}. {APP_NAME} is an internal tool.
          </p>
        </footer>
      </article>
    </main>
  );
}
