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

export function feedbackBetterWayText(item: NarratableFeedbackItem): string {
  const leadIn =
    item.type === 'grammar' || item.type === 'pronunciation'
      ? 'A better way to say this is:'
      : 'A more natural way to say this is:';
  return `${leadIn} ${item.betterWay || ''}`;
}

export const YOU_SAID_TEXT = 'You said';

export function feedbackNarrationTexts(item: NarratableFeedbackItem): string[] {
  return [feedbackIntroText(item), YOU_SAID_TEXT, feedbackBetterWayText(item), item.whyExplanation || '']
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== '.');
}
