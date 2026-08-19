import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

// Public, self-contained page (no auth, no database), same as /privacy — route
// protection only gates /dashboard/*, so this is reachable without signing in.

const COMPANY = "Blue Karma Secrets";
const APP_NAME = "Blue Karma Ads Dashboard";
const CONTACT_EMAIL = "privacy@bluekarmasecrets.com"; // change to your preferred inbox
const JURISDICTION = "the Republic of Indonesia";
const LAST_UPDATED = "19 August 2026";

export const metadata: Metadata = {
  title: `Terms of Service · ${APP_NAME}`,
  description: `The terms governing access to and use of ${APP_NAME}, an internal advertising analytics tool operated by ${COMPANY}.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-foreground text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground mt-3 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <main className="bg-background text-foreground min-h-screen px-6 py-16">
      <article className="mx-auto w-full max-w-3xl">
        <header className="border-border border-b pb-8">
          <Link href="/" aria-label={COMPANY}>
            <Logo className="text-foreground w-48" />
          </Link>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mt-3">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="mt-8">
          <p className="text-muted-foreground leading-relaxed">
            These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of{" "}
            {APP_NAME} (the &ldquo;Service&rdquo;), an internal advertising analytics tool operated
            by {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). The Service is provided for authorized{" "}
            {COMPANY} team members only. By accessing or using the Service, you agree to these Terms.
            If you do not agree, do not use the Service.
          </p>

          <Section title="The Service">
            <p>
              The Service retrieves and displays advertising performance data from our own Google Ads
              and Meta (Facebook and Instagram) advertising accounts, unifies it into a single
              dashboard, and generates plain-language summaries of that data. It is an internal
              reporting tool and is not offered to the general public.
            </p>
          </Section>

          <Section title="Accounts and access">
            <ul className="list-disc space-y-2 pl-5">
              <li>Accounts are created and managed by {COMPANY}; the Service is not open to self sign-up.</li>
              <li>You are responsible for keeping your login credentials confidential and for all activity under your account.</li>
              <li>You must notify us promptly of any unauthorized use of your account or any other breach of security.</li>
              <li>We may suspend or revoke access at any time, for example when someone is no longer authorized.</li>
            </ul>
          </Section>

          <Section title="Acceptable use">
            <p>When using the Service, you agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>use it for anything other than authorized {COMPANY} business reporting;</li>
              <li>share your access, or grant access to anyone not authorized by {COMPANY};</li>
              <li>attempt to gain unauthorized access to the Service, its data, or its infrastructure, or to disrupt or interfere with its operation;</li>
              <li>copy, scrape, reverse engineer, or resell the Service or its data; or</li>
              <li>use the Service in violation of any applicable law or of the terms of the underlying advertising platforms (Google and Meta).</li>
            </ul>
          </Section>

          <Section title="Third-party platforms and data accuracy">
            <p>
              The Service relies on data provided by Google and Meta through their advertising APIs.
              Your use of that data through the Service is also subject to those platforms&rsquo; own
              terms and policies. Reported figures may be delayed, estimated, or restated by the
              platforms, and may differ from the numbers shown in the platforms&rsquo; native
              interfaces. The Service is a reporting aid; it is not a system of record for billing or
              financial reporting.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              The Service, including its software, design, and content, is owned by {COMPANY} and is
              protected by applicable laws. These Terms do not grant you any ownership of the Service.
            </p>
          </Section>

          <Section title="Availability">
            <p>
              We aim to keep the Service available but do not guarantee uninterrupted access. We may
              modify, suspend, or discontinue any part of the Service, and may perform maintenance,
              at any time without notice.
            </p>
          </Section>

          <Section title="Disclaimer of warranties">
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
              warranties of any kind, whether express or implied, including any implied warranties of
              merchantability, fitness for a particular purpose, or non-infringement. We do not warrant
              that the Service will be error-free or that the data shown will be accurate or complete.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, {COMPANY} will not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or for any loss of profits,
              revenue, data, or goodwill, arising out of or related to your use of (or inability to
              use) the Service.
            </p>
          </Section>

          <Section title="Changes to these Terms">
            <p>
              We may update these Terms from time to time. When we do, we will revise the
              &ldquo;Last updated&rdquo; date above. Continued use of the Service after a change means
              you accept the updated Terms.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These Terms are governed by the laws of {JURISDICTION}, without regard to its conflict
              of laws rules.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about these Terms? Contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-foreground underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              . See also our{" "}
              <Link href="/privacy" className="text-foreground underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>
        </div>

        <footer className="border-border text-muted-foreground mt-14 border-t pt-8 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
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
