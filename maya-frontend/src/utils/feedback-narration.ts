/**
 * The exact sentences the feedback screen speaks for one correction card, in play order.
 *
 * Shared by the analyzing screen (prefetch) and the feedback screen (playback) so both
 * request identical text, and mirrored on the backend by
 * SessionsService.feedbackNarrationTexts (server-side prewarm). Change all three together.
 */
export interface NarratableFeedbackItem {
  type?: string;
  title?: string;
  subtitle?: string;
  betterWay?: string;
  whyExplanation?: string;
}

export function feedbackIntroText(item: NarratableFeedbackItem): string {
  const title = (item.title || '').trim();
  const subtitle = (item.subtitle || '').trim();
  return title.endsWith('.') ? `${title} ${subtitle}` : `${title}. ${subtitle}`;
}

/**
 * Fixed lead-in, synthesized once and cached; spoken right before the corrected sentence.
 * Kept separate from the sentence so each card only needs the (shorter) sentence generated:
 * on the 2-vCPU server Piper needs ~3.7s per second of speech.
 */
export const BETTER_WAY_LEAD_INS = ['A better way to say this is:', 'A more natural way to say this is:'] as const;

export function feedbackLeadInText(item: NarratableFeedbackItem): string {
  return item.type === 'grammar' || item.type === 'pronunciation' ? BETTER_WAY_LEAD_INS[0] : BETTER_WAY_LEAD_INS[1];
}

export function feedbackBetterWaySentence(item: NarratableFeedbackItem): string {
  return (item.betterWay || '').trim();
}

export const YOU_SAID_TEXT = 'You said';

export function feedbackNarrationTexts(item: NarratableFeedbackItem): string[] {
  return [feedbackIntroText(item), YOU_SAID_TEXT, feedbackLeadInText(item), feedbackBetterWaySentence(item), item.whyExplanation || '']
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== '.');
}
