import type { Metadata } from "next";
import Link from "next/link";
import { LegalNavbar } from "@/components/LegalNavbar";
import { LegalFooter } from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "Terms of Service - SpeakwithMaya",
  description:
    "Read the terms and conditions governing your use of the SpeakwithMaya AI English speaking coach platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <LegalNavbar />

      <main className="flex-1 py-12 md:py-16">
        <div className="max-w-[920px] mx-auto px-5 sm:px-8">
          {/* Header Banner */}
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF3FE] text-[#0D4EFD] text-[12px] font-semibold tracking-wide uppercase mb-4">
              <span className="w-2 h-2 rounded-full bg-[#0D4EFD]"></span>
              Legal Agreement
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-[42px] font-extrabold tracking-[-0.03em] text-[#0F172A] leading-tight mb-4">
              Terms & Conditions
            </h1>
            <p className="text-[15px] sm:text-[16px] text-[#64748B] max-w-[700px] leading-relaxed">
              These Terms and Conditions constitute a legally binding agreement between you and <strong>IDEACIPHER (PVT) LTD</strong> regarding your access to and use of <strong>SpeakwithMaya</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[#94A3B8] mt-4 pt-4 border-t border-[#E2E8F0]">
              <span>Last Updated: November 2026</span>
              <span>·</span>
              <span>Governing Jurisdiction: Sri Lanka</span>
            </div>
          </div>

          {/* Quick Summary Card */}
          <div className="mb-10 p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-bold text-[#0F172A] mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#EDF3FE] text-[#0D4EFD] text-xs">ℹ</span>
              Key Summary
            </h2>
            <p className="text-[13.5px] text-[#475569] leading-relaxed">
              SpeakwithMaya is an AI conversational English-speaking coach. By creating an account or subscribing to any plan (including our direct mobile carrier <strong>Starter Plan</strong> or paid online tiers), you agree to these terms, our <Link href="/privacy" className="text-[#0D4EFD] underline font-medium">Privacy Policy</Link>, and our <Link href="/refund" className="text-[#0D4EFD] underline font-medium">Refund Policy</Link>. Online card/wallet transactions are securely processed via Central Bank-approved gateway <strong>PayHere</strong>, and mobile carrier airtime subscriptions are processed through authorized Sri Lankan telecommunication operators (Dialog, Mobitel, Hutch).
            </p>
          </div>

          {/* Content Document */}
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 sm:p-10 md:p-12 shadow-[0_8px_30px_rgba(15,23,42,0.03)] space-y-10 text-[14.5px] text-[#334155] leading-relaxed">
            
            {/* Section 1 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                1. Acceptance of Terms
              </h3>
              <p>
                By creating an account, accessing, or using the SpeakwithMaya website, web application, or associated mobile services (collectively, the &ldquo;Service&rdquo;), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you must discontinue using the Service immediately.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                2. Description of Digital Service
              </h3>
              <p>
                SpeakwithMaya provides an interactive AI English coach designed to help individuals build spoken English fluency, confidence, and natural conversational skills. The Service includes real-time voice calls, sentence feedback, situational roleplays, and personalized progress roadmaps.
              </p>
              <p>
                The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. While we strive for continuous availability, periodic maintenance or infrastructure upgrades may occasionally require brief service interruptions.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                3. User Account & Registration
              </h3>
              <p>
                To access features and track learning progress, you must register using a valid mobile phone number and verify ownership via One-Time Password (OTP). You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li>Provide accurate, current, and complete registration information.</li>
                <li>Maintain the confidentiality and security of your account credentials.</li>
                <li>Promptly notify us of any unauthorized use or security breach of your account.</li>
                <li>Accept responsibility for all activities that occur under your registered account.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                4. Subscriptions, Pricing & Currency
              </h3>
              <p>
                SpeakwithMaya offers multiple access models: a free trial experience, direct mobile carrier billing (the Starter Plan), and tiered premium subscription plans.
              </p>

              {/* Starter Plan Box */}
              <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-[#EDF3FE] text-[#0D4EFD] text-xs font-bold uppercase tracking-wider">
                    Starter Plan · Mobile Carrier Billing
                  </span>
                </div>
                <p className="text-[13.5px] text-[#475569] leading-relaxed">
                  Users registering with a supported Sri Lankan mobile carrier (Dialog, Mobitel, Hutch) can access the platform via the <strong>Starter Plan</strong> through direct airtime billing:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-[13.5px] text-[#475569]">
                  <li>
                    <strong>Prepaid Subscribers:</strong> Billed at <strong>LKR 12 + applicable taxes per day</strong>, deducted automatically from your mobile airtime balance.
                  </li>
                  <li>
                    <strong>Postpaid Subscribers:</strong> Billed at <strong>LKR 360 + applicable taxes per month</strong>, added directly to your monthly mobile carrier invoice.
                  </li>
                  <li>
                    <strong>Activation:</strong> Activated automatically upon entering your mobile number and completing One-Time Password (OTP) verification during account creation.
                  </li>
                  <li>
                    <strong>Daily Access:</strong> Grants daily speaking practice time and AI feedback with Maya. Practice quotas reset daily and do not carry forward.
                  </li>
                  <li>
                    <strong>No Lock-In Contract:</strong> Cancel anytime without penalties or cancellation fees.
                  </li>
                </ul>
              </div>

              {/* General Pricing Terms */}
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li><strong>Currency:</strong> All subscription prices are stated and billed in Sri Lankan Rupees (LKR) with government taxes (such as VAT / SSCL / telecommunication levies) charged in accordance with Sri Lankan law.</li>
                <li><strong>Tiered Plans:</strong> Higher-tier plans (Basic, Pro, Premium) with extended monthly quotas are available for purchase via online payment cards and digital wallets.</li>
                <li><strong>Practice Quotas:</strong> Each subscription tier includes defined daily or monthly AI conversation minutes. Unused minutes expire at the end of each billing cycle and do not carry forward.</li>
                <li><strong>Price Adjustments:</strong> We reserve the right to revise subscription fees upon giving at least 14 days prior notice via SMS, app notification, or email. Active billing cycles will remain unchanged until their scheduled renewal.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                5. Payment Processing (Mobile Carrier Billing & PayHere)
              </h3>
              <p>
                To provide accessible and seamless billing across Sri Lanka, SpeakwithMaya supports two authorized payment channels:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#475569]">
                <li>
                  <strong>Direct Carrier Billing (Dialog, Mobitel, Hutch):</strong> For Starter Plan subscriptions, billing transactions are executed directly through telecommunications operator gateways (Ideamart / mSpace). Charges are deducted from prepaid mobile airtime or added to postpaid billing statements. No credit card or banking information is required.
                </li>
                <li>
                  <strong>Online Card & Wallet Payments (PayHere):</strong> For monthly/annual tiered plans and minute add-on purchases, payments are processed securely through <strong>PayHere</strong>, a licensed Payment Service Provider approved by the Central Bank of Sri Lanka (CBSL) operating under PCI-DSS Level 1 compliance. SpeakwithMaya never stores raw credit/debit card numbers or bank credentials.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                6. Recurring Billing, Carrier Airtime Deductions & Auto-Renewal
              </h3>
              <p>
                By starting a subscription, you acknowledge and agree to recurring charges:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#475569]">
                <li>
                  <strong>Starter Plan (Mobile Carrier):</strong> Prepaid accounts are charged LKR 12 + applicable taxes each day on a recurring basis. If your prepaid mobile balance is insufficient at renewal time, access will be temporarily held until balance replenishment triggers the regular daily cycle. Postpaid accounts renew automatically each monthly billing cycle at LKR 360 + applicable taxes.
                </li>
                <li>
                  <strong>Online Recurring Subscriptions (PayHere):</strong> When enrolled in a recurring card subscription, you authorize PayHere to charge the specified subscription fee at the start of each renewal interval (monthly or annually) until cancelled.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                7. Cancellation & Termination
              </h3>
              <p>
                You may cancel your subscription at any time without penalty:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#475569]">
                <li>
                  <strong>Cancelling Starter Plan (Carrier Billing):</strong> You can cancel carrier billing at any time by tapping the <strong>Unsubscribe</strong> button in your app Profile / Settings, by following operator SMS cancellation instructions, or by emailing <a href="mailto:speakwithmaya.com@gmail.com" className="text-[#0D4EFD] underline font-medium">speakwithmaya.com@gmail.com</a> with your registered mobile phone number. Cancellation takes effect immediately, stopping future daily airtime deductions.
                </li>
                <li>
                  <strong>Cancelling Online Card Subscriptions:</strong> Navigate to your Account / Subscription settings within the web app or email <a href="mailto:speakwithmaya.com@gmail.com" className="text-[#0D4EFD] underline font-medium">speakwithmaya.com@gmail.com</a>. Cancellation takes effect at the end of your current paid billing period with full feature retention until that date.
                </li>
                <li>
                  <strong>Refunds:</strong> Refund requests are governed strictly by our <Link href="/refund" className="text-[#0D4EFD] underline font-medium">Refund & Cancellation Policy</Link>.
                </li>
              </ul>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                8. Acceptable Use & Conduct
              </h3>
              <p>
                You agree to use SpeakwithMaya solely for personal educational purposes. You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li>Interfere with, intercept, or attempt to reverse engineer the application, underlying AI protocols, or server communications.</li>
                <li>Transmit offensive, defamatory, harassing, obscene, or unlawful speech during AI speaking practice calls.</li>
                <li>Automate calls or scrape data using automated bots, crawlers, or unauthorized scripts.</li>
                <li>Share, resell, or transfer your account access to third parties without prior written consent.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                9. AI Technology & Educational Disclaimer
              </h3>
              <p>
                SpeakwithMaya uses advanced generative artificial intelligence to simulate realistic human conversations and provide pronunciation/grammar feedback. While we continuously refine our models for maximum pedagogical accuracy, conversational responses are computer-generated and may occasionally contain unintentional grammatical nuances or errors. The Service is an educational practice tool and does not guarantee specific exam scores or employment outcomes.
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                10. Intellectual Property Rights
              </h3>
              <p>
                All trademarks, logos, audio materials, user interface designs, curriculum roadmaps, and software code associated with SpeakwithMaya are the exclusive property of <strong>IDEACIPHER (PVT) LTD</strong>. Users receive a limited, revocable, non-exclusive license to access the platform for personal learning.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                11. Limitation of Liability
              </h3>
              <p>
                To the fullest extent permissible by applicable law, IDEACIPHER (PVT) LTD and its directors, employees, or partners shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from your use of or inability to use the Service. Our total aggregate liability for any claims relating to the Service shall not exceed the total fees paid by you in the three (3) months preceding the claim.
              </p>
            </section>

            {/* Section 12 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                12. Governing Law & Jurisdiction
              </h3>
              <p>
                These Terms and Conditions and any disputes arising out of or related to your use of SpeakwithMaya shall be governed by and construed in accordance with the <strong>laws of the Democratic Socialist Republic of Sri Lanka</strong>. Both parties submit to the exclusive jurisdiction of the competent courts of Sri Lanka.
              </p>
            </section>

            {/* Section 13 */}
            <section className="space-y-3 pt-4 border-t border-[#E2E8F0]">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                13. Merchant Contact Information
              </h3>
              <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-[13.5px]">
                <p><strong>Entity Name:</strong> IDEACIPHER (PVT) LTD</p>
                <p><strong>Trading Name:</strong> SpeakwithMaya</p>
                <p><strong>Registered Country:</strong> Sri Lanka</p>
                <p><strong>Support & Legal Inquiries:</strong> <a href="mailto:speakwithmaya.com@gmail.com" className="text-[#0D4EFD] underline font-medium">speakwithmaya.com@gmail.com</a></p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <LegalFooter active="terms" />
    </div>
  );
}
