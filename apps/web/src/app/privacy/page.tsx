import Link from "next/link";
import { FileText, Shield, Lock, Mail } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | CanvasCast",
  description: "Learn how CanvasCast collects, uses, and protects your personal data",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/logo-icon.png" alt="CanvasCast" className="w-8 h-8" />
            <span className="text-xl font-bold">CanvasCast</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-gray-400 hover:text-white transition">
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-medium transition"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500/20 mb-6">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-gray-400 text-lg">
            Last updated: January 20, 2026
          </p>
        </div>

        {/* Introduction */}
        <section className="mb-12">
          <p className="text-gray-300 leading-relaxed">
            At CanvasCast, we take your privacy seriously. This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you use our AI-powered video generation
            platform. Please read this policy carefully. If you do not agree with the terms of this
            privacy policy, please do not access the site or use our services.
          </p>
        </section>

        {/* Data Collection Section */}
        <section className="mb-12">
          <div className="flex items-start gap-3 mb-4">
            <FileText className="w-6 h-6 text-brand-400 flex-shrink-0 mt-1" />
            <h2 className="text-2xl font-bold">Data Collection</h2>
          </div>

          <div className="space-y-6 text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Personal Information</h3>
              <p className="leading-relaxed">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Email address (for authentication and communication)</li>
                <li>Profile information (name, display preferences)</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Account credentials (managed through Supabase Auth)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Content You Create</h3>
              <p className="leading-relaxed">
                When you use CanvasCast, we collect and process:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Video prompts and scripts you submit</li>
                <li>Generated videos, images, and audio files</li>
                <li>Project settings and preferences</li>
                <li>Uploaded documents (PDFs, DOCX files, audio recordings)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Usage Data</h3>
              <p className="leading-relaxed">
                We automatically collect certain information about your device and how you interact
                with our platform:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>IP address and browser type</li>
                <li>Pages visited and features used</li>
                <li>Time and date of access</li>
                <li>Video generation metrics and performance data</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How We Use Your Data Section */}
        <section className="mb-12">
          <div className="flex items-start gap-3 mb-4">
            <Lock className="w-6 h-6 text-brand-400 flex-shrink-0 mt-1" />
            <h2 className="text-2xl font-bold">How We Use Your Data</h2>
          </div>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Provide, operate, and maintain our video generation services</li>
              <li>Process your payments and manage your credit balance</li>
              <li>Generate AI-powered videos using third-party services (OpenAI, Google Gemini)</li>
              <li>Send you transactional emails about your projects and account</li>
              <li>Improve our platform and develop new features</li>
              <li>Monitor and analyze usage patterns to enhance user experience</li>
              <li>Detect, prevent, and address technical issues and abuse</li>
              <li>Comply with legal obligations and enforce our terms of service</li>
            </ul>
          </div>
        </section>

        {/* Third-Party Services Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Third-Party Services</h2>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              CanvasCast integrates with the following third-party services to provide our platform:
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">OpenAI</h3>
                <p className="text-sm">For script generation, text-to-speech, and transcription services</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Google Gemini</h3>
                <p className="text-sm">For AI-powered image generation (Imagen)</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Stripe</h3>
                <p className="text-sm">For secure payment processing</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Supabase</h3>
                <p className="text-sm">For database, authentication, and file storage</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">PostHog</h3>
                <p className="text-sm">For analytics and product insights (optional, requires consent)</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">Upstash</h3>
                <p className="text-sm">For rate limiting and job queue management</p>
              </div>
            </div>

            <p className="leading-relaxed">
              These services have their own privacy policies. We recommend reviewing them to understand
              how they handle your data.
            </p>
          </div>
        </section>

        {/* Cookie Usage Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Cookie Usage</h2>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              We use cookies and similar tracking technologies to track activity on our platform and
              store certain information. Types of cookies we use:
            </p>

            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Essential Cookies</h3>
                <p className="text-sm">Required for authentication and basic platform functionality</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Analytics Cookies</h3>
                <p className="text-sm">Help us understand how you use CanvasCast (requires your consent)</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Preference Cookies</h3>
                <p className="text-sm">Remember your settings and customization choices</p>
              </div>
            </div>

            <p className="leading-relaxed">
              You can control cookie preferences through our consent banner or your browser settings.
              Note that disabling certain cookies may affect platform functionality.
            </p>
          </div>
        </section>

        {/* Data Retention Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Data Retention</h2>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              We retain your personal information for as long as necessary to provide our services and
              comply with legal obligations:
            </p>

            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                <strong className="text-white">Account Data:</strong> Retained until you request account deletion
              </li>
              <li>
                <strong className="text-white">Generated Videos:</strong> Stored for 90 days by default,
                with premium retention options available
              </li>
              <li>
                <strong className="text-white">Project Metadata:</strong> Retained for historical records and analytics
              </li>
              <li>
                <strong className="text-white">Billing Records:</strong> Retained for 7 years to comply with tax regulations
              </li>
              <li>
                <strong className="text-white">Audit Logs:</strong> Retained for 12 months for security and compliance
              </li>
            </ul>

            <p className="leading-relaxed mt-4">
              You will receive email notifications before we delete your assets, giving you time to
              download them if needed.
            </p>
          </div>
        </section>

        {/* Data Security Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Data Security</h2>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              We implement industry-standard security measures to protect your personal information:
            </p>

            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>End-to-end encryption for data in transit (TLS/SSL)</li>
              <li>Encrypted storage for sensitive data at rest</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Role-based access control for our team</li>
              <li>Automated backup and disaster recovery systems</li>
              <li>Content moderation to prevent abuse</li>
            </ul>

            <p className="leading-relaxed mt-4">
              However, no method of transmission over the Internet or electronic storage is 100% secure.
              While we strive to protect your personal information, we cannot guarantee its absolute security.
            </p>
          </div>
        </section>

        {/* Your Rights (GDPR) Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Your Rights (GDPR)</h2>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              Under the General Data Protection Regulation (GDPR) and other privacy laws, you have
              certain rights regarding your personal data:
            </p>

            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Right to Access</h3>
                <p className="text-sm">
                  Request a copy of all personal data we hold about you
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Right to Rectification</h3>
                <p className="text-sm">
                  Request corrections to inaccurate or incomplete data
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Right to Erasure ("Right to be Forgotten")</h3>
                <p className="text-sm">
                  Request deletion of your personal data under certain circumstances
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Right to Data Portability</h3>
                <p className="text-sm">
                  Export your data in a machine-readable format (JSON)
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Right to Restriction of Processing</h3>
                <p className="text-sm">
                  Request that we limit how we use your data
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-1">Right to Object</h3>
                <p className="text-sm">
                  Object to processing of your data for marketing or analytics purposes
                </p>
              </div>
            </div>

            <p className="leading-relaxed mt-4">
              To exercise these rights, visit your <Link href="/app/settings" className="text-brand-400 hover:text-brand-300 underline">Account Settings</Link> or
              contact us using the information below.
            </p>
          </div>
        </section>

        {/* Children's Privacy Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Children's Privacy</h2>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              CanvasCast is not intended for use by children under the age of 13. We do not knowingly
              collect personal information from children under 13. If you are a parent or guardian and
              believe your child has provided us with personal information, please contact us immediately.
            </p>
          </div>
        </section>

        {/* Changes to This Policy Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Changes to This Privacy Policy</h2>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by:
            </p>

            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Updating the "Last Updated" date at the top of this policy</li>
              <li>Sending you an email notification for material changes</li>
              <li>Displaying a prominent notice on our platform</li>
            </ul>

            <p className="leading-relaxed mt-4">
              You are advised to review this Privacy Policy periodically for any changes. Changes to
              this Privacy Policy are effective when they are posted on this page.
            </p>
          </div>
        </section>

        {/* Contact Section */}
        <section className="mb-12">
          <div className="flex items-start gap-3 mb-4">
            <Mail className="w-6 h-6 text-brand-400 flex-shrink-0 mt-1" />
            <h2 className="text-2xl font-bold">Contact Us</h2>
          </div>

          <div className="space-y-4 text-gray-300">
            <p className="leading-relaxed">
              If you have questions or concerns about this Privacy Policy or our data practices,
              please contact us at:
            </p>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="space-y-2">
                <p>
                  <strong className="text-white">Email:</strong>{" "}
                  <a
                    href="mailto:privacy@canvascast.ai"
                    className="text-brand-400 hover:text-brand-300 underline"
                  >
                    privacy@canvascast.ai
                  </a>
                </p>
                <p>
                  <strong className="text-white">Data Protection Officer:</strong>{" "}
                  <a
                    href="mailto:dpo@canvascast.ai"
                    className="text-brand-400 hover:text-brand-300 underline"
                  >
                    dpo@canvascast.ai
                  </a>
                </p>
                <p className="pt-2">
                  <strong className="text-white">Response Time:</strong> We aim to respond to all
                  privacy inquiries within 48 hours
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Related Links */}
        <section className="border-t border-white/10 pt-8">
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <Link href="/terms" className="text-brand-400 hover:text-brand-300 underline">
              Terms of Service
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/app/settings/delete-account" className="text-brand-400 hover:text-brand-300 underline">
              Delete Account
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/api/account/export" className="text-brand-400 hover:text-brand-300 underline">
              Export Data
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 mt-16">
        <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
          © 2026 CanvasCast. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
