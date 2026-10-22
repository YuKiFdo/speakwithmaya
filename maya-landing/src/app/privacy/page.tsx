import type { Metadata } from "next";
import Link from "next/link";
import { LegalNavbar } from "@/components/LegalNavbar";
import { LegalFooter } from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "Privacy Policy — SpeakwithMaya",
  description:
    "Learn how SpeakwithMaya protects your personal information, voice recordings, and payment data in compliance with Sri Lanka PDPA.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <LegalNavbar />

      <main className="flex-1 py-12 md:py-16">
        <div className="max-w-[920px] mx-auto px-5 sm:px-8">
          {/* Header Banner */}
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF3FE] text-[#0D4EFD] text-[12px] font-semibold tracking-wide uppercase mb-4">
              <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
              Privacy & Data Protection
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-[42px] font-extrabold tracking-[-0.03em] text-[#0F172A] leading-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-[15px] sm:text-[16px] text-[#64748B] max-w-[720px] leading-relaxed">
              At <strong>SpeakwithMaya</strong> (operated by <strong>IDEACIPHER (PVT) LTD</strong>), we value your privacy and are committed to safeguarding your personal data in accordance with Sri Lanka’s <strong>Personal Data Protection Act (PDPA), No. 9 of 2022</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[#94A3B8] mt-4 pt-4 border-t border-[#E2E8F0]">
              <span>Last Updated: October 2026</span>
              <span>·</span>
              <span>Compliance: Sri Lanka PDPA No. 9 of 2022</span>
            </div>
          </div>

          {/* Quick Summary Card */}
          <div className="mb-10 p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-bold text-[#0F172A] mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#ECFDF5] text-[#10B981] text-xs">🔒</span>
              Our Privacy Commitment at a Glance
            </h2>
            <ul className="text-[13.5px] text-[#475569] space-y-1.5 leading-relaxed">
              <li><strong>Zero Payment Card Storage:</strong> All payments are processed directly by Central Bank-licensed gateway <strong>PayHere</strong>. We never store or see your credit/debit card numbers or CVVs.</li>
              <li><strong>Voice Privacy:</strong> Your microphone is only accessed with explicit user permission while in an active call. Voice is processed in real time for speaking feedback.</li>
              <li><strong>No Data Selling:</strong> We do not sell, rent, or trade your personal information with third-party advertisers.</li>
            </ul>
          </div>

          {/* Content Document */}
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 sm:p-10 md:p-12 shadow-[0_8px_30px_rgba(15,23,42,0.03)] space-y-10 text-[14.5px] text-[#334155] leading-relaxed">
            
            {/* Section 1 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                1. Scope & Regulatory Framework
              </h3>
              <p>
                This Privacy Policy applies to personal data collected, stored, and processed through the SpeakwithMaya website, web app, and associated online interfaces. IDEACIPHER (PVT) LTD acts as the Data Controller under the provisions of the <strong>Personal Data Protection Act (PDPA), No. 9 of 2022 of Sri Lanka</strong>.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                2. Information We Collect
              </h3>
              <p>
                We only collect data necessary to provide effective English conversational coaching:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#475569]">
                <li><strong>Account & Identity Data:</strong> Mobile phone number (used for secure SMS OTP authentication), optional display name, native language preference (e.g. Sinhala/Tamil/English), and current English proficiency level.</li>
                <li><strong>Practice Audio & Speech Transcripts:</strong> Audio inputs captured while participating in speaking coaching calls. Audio is converted into text transcripts to generate pedagogical feedback, corrections, and personalized vocabulary tips.</li>
                <li><strong>Usage & Progress Analytics:</strong> Session durations, conversation minutes utilized, lesson completion milestones, streak metrics, and feedback reports.</li>
                <li><strong>Technical Data:</strong> Browser type, device operating system, IP address, and network latency indicators to maintain low-latency live audio streaming.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                3. Payment Information & Security (PayHere)
              </h3>
              <p>
                When you purchase a subscription on SpeakwithMaya, the transaction is handled through <strong>PayHere</strong>, an authorized Payment Service Provider licensed by the Central Bank of Sri Lanka.
              </p>
              <div className="p-4 rounded-xl bg-[#EDF3FE]/70 border border-[#DCE6F7] text-[13.5px] text-[#1E3A8A] space-y-1">
                <p><strong>Payment Security Guarantee:</strong></p>
                <p>
                  SpeakwithMaya operates under strict zero-trust standards for financial data. We <strong>do not collect, store, or view</strong> credit card numbers, expiration dates, CVV codes, or bank passwords. All payment details are submitted directly through PayHere&rsquo;s 256-bit TLS encrypted, PCI-DSS Level 1 compliant gateway.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                4. Voice Data as Personal Data
              </h3>
              <p>
                We recognize that your voice is sensitive personal data. We implement strict safeguards:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li><strong>Explicit Consent:</strong> The application will never access your microphone without clear browser or system permission. You can revoke microphone access at any time.</li>
                <li><strong>Ephemeral Processing:</strong> Audio streams are primarily processed transiently in real time during your conversation to generate instant conversational replies.</li>
                <li><strong>Minimal Retention:</strong> Audio recordings are not permanently stored for public distribution. Speech transcripts used to construct your personal progress history remain private to your account.</li>
                <li><strong>User-Triggered Deletion:</strong> You can request immediate deletion of your conversation history and associated progress records at any time.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                5. How We Use Your Information
              </h3>
              <p>
                We process your personal information strictly for the following lawful purposes:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li>To operate, deliver, and personalize your AI English speaking coach experience.</li>
                <li>To calculate practice quotas, session limits, and billing ledger balances.</li>
                <li>To verify your identity and protect against fraudulent access using SMS OTP.</li>
                <li>To deliver customer support, handle refund inquiries, and resolve service issues.</li>
                <li>To comply with regulatory obligations under the laws of Sri Lanka.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                6. Data Sharing & Third-Party Processors
              </h3>
              <p>
                We do not sell or monetize personal information. We share data only with verified technical infrastructure providers under binding data processing agreements:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li><strong>PayHere (Payment Gateway):</strong> For processing subscription payments, recurring charges, and refund requests in Sri Lanka.</li>
                <li><strong>Database & Authentication Infrastructure:</strong> Secure cloud databases operating with end-to-end encryption and row-level access control.</li>
                <li><strong>Telecom & SMS Aggregators:</strong> Licensed telecommunication partners in Sri Lanka for delivering One-Time Password verification SMS.</li>
                <li><strong>Legal Authorities:</strong> Only when strictly mandated by a valid court order or statutory requirement under Sri Lankan law.</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                7. Your Rights under the Sri Lanka PDPA
              </h3>
              <p>
                Under the <strong>Personal Data Protection Act No. 9 of 2022</strong>, you have enforceable rights regarding your personal data:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li><strong>Right of Access:</strong> You may request a copy of the personal data we hold about you.</li>
                <li><strong>Right to Rectification:</strong> You may correct inaccurate or outdated information in your profile.</li>
                <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> You may request complete deletion of your account, transcripts, and speaking logs.</li>
                <li><strong>Right to Withdraw Consent:</strong> You may withdraw your consent for voice processing or account communications at any time.</li>
              </ul>
              <p>
                To exercise any of these rights, email our Data Protection team at <a href="mailto:support@speakwithmaya.com" className="text-[#0D4EFD] underline font-medium">support@speakwithmaya.com</a>. We will process your verified request within 14 business days.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                8. Security & Data Retention
              </h3>
              <p>
                We employ industry-standard administrative, physical, and technical safeguards. All network communications between your device and our servers use TLS 1.3 encryption with strict Content Security Policies. Databases are isolated behind internal virtual private clouds with automatic backup encryption.
              </p>
              <p>
                We retain your account data for as long as your account remains active. If an account is inactive for more than twelve (12) months without an active subscription, or upon explicit deletion request, personal identifiers and conversation transcripts are permanently purged.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3 pt-4 border-t border-[#E2E8F0]">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                9. Data Protection Officer & Inquiries
              </h3>
              <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-[13.5px]">
                <p><strong>Data Controller:</strong> IDEACIPHER (PVT) LTD</p>
                <p><strong>Service:</strong> SpeakwithMaya</p>
                <p><strong>Location:</strong> Colombo, Sri Lanka</p>
                <p><strong>Privacy & Data Rights Desk:</strong> <a href="mailto:support@speakwithmaya.com" className="text-[#0D4EFD] underline font-medium">support@speakwithmaya.com</a></p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <LegalFooter active="privacy" />
    </div>
  );
}
