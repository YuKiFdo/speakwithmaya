import type { Metadata } from "next";
import Link from "next/link";
import { LegalNavbar } from "@/components/LegalNavbar";
import { LegalFooter } from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — SpeakwithMaya",
  description:
    "Review SpeakwithMaya's refund and cancellation guidelines, PayHere payment processing timelines, and customer guarantee.",
};

export default function RefundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <LegalNavbar />

      <main className="flex-1 py-12 md:py-16">
        <div className="max-w-[920px] mx-auto px-5 sm:px-8">
          {/* Header Banner */}
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF3FE] text-[#0D4EFD] text-[12px] font-semibold tracking-wide uppercase mb-4">
              <span className="w-2 h-2 rounded-full bg-[#0D4EFD]"></span>
              Customer Guarantee & Billing
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-[42px] font-extrabold tracking-[-0.03em] text-[#0F172A] leading-tight mb-4">
              Refund & Cancellation Policy
            </h1>
            <p className="text-[15px] sm:text-[16px] text-[#64748B] max-w-[720px] leading-relaxed">
              We want you to feel completely confident practicing with <strong>SpeakwithMaya</strong>. This policy details our cancellation process, refund criteria, and <strong>PayHere</strong> payment reversal timelines.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[#94A3B8] mt-4 pt-4 border-t border-[#E2E8F0]">
              <span>Last Updated: October 2026</span>
              <span>·</span>
              <span>Payment Processor: PayHere (CBSL Approved)</span>
            </div>
          </div>

          {/* Quick Summary Card */}
          <div className="mb-10 p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-bold text-[#0F172A] mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#EDF3FE] text-[#0D4EFD] text-xs">✓</span>
              Quick Policy Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[12px] font-bold text-[#0D4EFD] uppercase tracking-wider block mb-1">
                  7-Day Guarantee
                </span>
                <p className="text-[13px] text-[#475569]">
                  Eligible for a full refund within 7 days of initial subscription if practice time is under 30 minutes.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[12px] font-bold text-[#0D4EFD] uppercase tracking-wider block mb-1">
                  Cancel Anytime
                </span>
                <p className="text-[13px] text-[#475569]">
                  Cancel recurring renewals instantly from your Account dashboard without any cancellation penalty.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[12px] font-bold text-[#0D4EFD] uppercase tracking-wider block mb-1">
                  PayHere Direct
                </span>
                <p className="text-[13px] text-[#475569]">
                  Refunds are reversed directly to your original payment method via the PayHere gateway within 5–10 business days.
                </p>
              </div>
            </div>
          </div>

          {/* Content Document */}
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 sm:p-10 md:p-12 shadow-[0_8px_30px_rgba(15,23,42,0.03)] space-y-10 text-[14.5px] text-[#334155] leading-relaxed">
            
            {/* Section 1 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                1. Digital Service Policy Overview
              </h3>
              <p>
                SpeakwithMaya is a digital AI speaking coach service operated by <strong>IDEACIPHER (PVT) LTD</strong>. Because access to real-time AI conversation minutes and speaking evaluation is provided immediately upon payment, traditional physical return policies do not apply. Instead, our refund framework is designed to provide fair recourse while protecting against excessive computational resource exploitation.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                2. Subscription Cancellation Rules
              </h3>
              <p>
                You have full control over your subscription and can cancel at any time:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[#475569]">
                <li><strong>No Lock-In Contract:</strong> All subscriptions are month-to-month or year-to-year. There are no cancellation fees or lock-in contracts.</li>
                <li><strong>How to Cancel:</strong> You can initiate cancellation through your account settings or by emailing <a href="mailto:support@speakwithmaya.com" className="text-[#0D4EFD] underline font-medium">support@speakwithmaya.com</a> with your registered mobile phone number.</li>
                <li><strong>Retained Access:</strong> Once cancelled, recurring renewals will cease immediately. You will retain full access to all features, remaining practice minutes, and feedback tools until the conclusion of your current paid billing period.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                3. Refund Eligibility Criteria
              </h3>
              <p>
                We consider refunds under the following clear conditions:
              </p>
              <div className="space-y-3 text-[14px]">
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                  <h4 className="font-bold text-[#0F172A]">A. Initial Purchase Satisfaction Guarantee (7 Days)</h4>
                  <p className="text-[#475569]">
                    If you subscribed to a paid plan for the first time and find that SpeakwithMaya does not fit your learning needs, you are eligible for a <strong>100% full refund</strong> provided that:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-[#475569]">
                    <li>The refund request is submitted within <strong>seven (7) calendar days</strong> of the initial payment date.</li>
                    <li>Your account has utilized <strong>less than thirty (30) cumulative minutes</strong> of AI speaking practice during this initial period.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                  <h4 className="font-bold text-[#0F172A]">B. Technical Malfunction or Extended Outage</h4>
                  <p className="text-[#475569]">
                    If you experience persistent technical failures (e.g. unable to establish audio connections) directly attributable to our infrastructure for more than 48 continuous hours, and our engineering team is unable to resolve the issue, a prorated or full refund for the affected period will be granted.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                  <h4 className="font-bold text-[#0F172A]">C. Erroneous Duplicate Billing</h4>
                  <p className="text-[#475569]">
                    In the rare event of a duplicate charge due to gateway timeout or payment re-submission, the duplicate transaction will be immediately refunded in full without questions.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                4. PayHere Payment Processing & Reversal Timelines
              </h3>
              <p>
                All refunds are processed strictly through the payment channel originally used via the <strong>PayHere</strong> payment gateway in compliance with banking regulations in Sri Lanka:
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13.5px] border border-[#E2E8F0] rounded-xl overflow-hidden mt-2">
                  <thead className="bg-[#F8FAFC] text-[#0F172A] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-4 font-bold">Payment Method</th>
                      <th className="py-3 px-4 font-bold">Refund Mechanism</th>
                      <th className="py-3 px-4 font-bold">Expected Time to Reflect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-[#475569]">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[#0F172A]">Card (Same-Day)</td>
                      <td className="py-3 px-4">Instant Bank Void via PayHere</td>
                      <td className="py-3 px-4 text-[#10B981] font-semibold">Immediate / 24 hours</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[#0F172A]">Card (Post-Settlement)</td>
                      <td className="py-3 px-4">PayHere Card Refund API</td>
                      <td className="py-3 px-4">5 to 10 business days*</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[#0F172A]">eZ Cash / Genie / Frimi</td>
                      <td className="py-3 px-4">Direct Merchant Transfer</td>
                      <td className="py-3 px-4">3 to 7 business days</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[#0F172A]">Internet Bank Transfer</td>
                      <td className="py-3 px-4">Direct Bank Deposit (SLIPS/CEFT)</td>
                      <td className="py-3 px-4">2 to 5 business days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[12.5px] text-[#64748B] italic">
                * Note: The exact reflection date on your bank card statement depends on your card-issuing bank&rsquo;s internal clearing cycle (Commercial Bank, Sampath Bank, HNB, Seylan, NTB, etc.).
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                5. Non-Refundable Circumstances
              </h3>
              <p>Refunds will not be issued under the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-[#475569]">
                <li>Requests submitted beyond the initial 7-day guarantee window.</li>
                <li>Accounts that have utilized thirty (30) or more minutes of conversational practice during the active billing period.</li>
                <li>Recurring subscription renewals where the user failed to cancel before the automatic renewal date.</li>
                <li>Account suspensions resulting from violations of our Terms of Service (e.g. abusive language or unauthorized platform scraping).</li>
                <li>Dissatisfaction caused by user-side hardware faults (e.g. broken microphone, poor local internet connection, or unsupported browser).</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                6. How to Request a Refund
              </h3>
              <p>
                To request a refund, follow these simple steps:
              </p>
              <ol className="list-decimal pl-6 space-y-2 text-[#475569]">
                <li>
                  Send an email to <a href="mailto:support@speakwithmaya.com" className="text-[#0D4EFD] underline font-medium">support@speakwithmaya.com</a> with the subject line <strong>&ldquo;Refund Request - [Your Registered Phone Number]&rdquo;</strong>.
                </li>
                <li>
                  Include your <strong>PayHere Payment Reference Number</strong> or the receipt received via email/SMS.
                </li>
                <li>
                  Provide a brief note explaining the reason for your refund request so we can continuously improve Maya.
                </li>
              </ol>
              <p>
                Our billing support team will review your request, verify quota usage, and respond within <strong>twenty-four (24) to forty-eight (48) hours</strong>. If approved, the refund will be initiated immediately through PayHere.
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-3 pt-4 border-t border-[#E2E8F0]">
              <h3 className="text-[18px] font-bold text-[#0F172A] tracking-[-0.01em]">
                7. Merchant Contact & Support Desk
              </h3>
              <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-[13.5px]">
                <p><strong>Merchant Name:</strong> IDEACIPHER (PVT) LTD</p>
                <p><strong>Brand:</strong> SpeakwithMaya</p>
                <p><strong>Billing & Support Email:</strong> <a href="mailto:support@speakwithmaya.com" className="text-[#0D4EFD] underline font-medium">support@speakwithmaya.com</a></p>
                <p><strong>Support Operating Hours:</strong> Monday – Saturday, 9:00 AM – 6:00 PM (Sri Lanka Time, UTC+5:30)</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <LegalFooter active="refund" />
    </div>
  );
}
