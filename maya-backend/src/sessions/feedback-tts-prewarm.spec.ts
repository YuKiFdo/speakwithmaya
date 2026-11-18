import { describe, it, expect } from 'vitest';
import { SessionsService } from './sessions.service.js';

// These strings must stay identical to what maya-frontend/src/app/onboarding/feedback.tsx
// (startCardAudioSequence) sends to POST /v1/sessions/tts, or prewarmed clips never hit.
describe('SessionsService.feedbackNarrationTexts', () => {
  it('grammar card: intro, "You said", "A better way" lead-in, explanation', () => {
    expect(
      SessionsService.feedbackNarrationTexts({
        type: 'grammar',
        title: 'Let’s make this more correct.',
        subtitle: 'Here’s a sentence from your conversation and how you can improve it.',
        betterWay: 'No, I am planning to do it as a freelance job.',
        whyExplanation: "When expressing future plans, you need the verb 'to be' before 'planning'.",
      }),
    ).toEqual([
      'Let’s make this more correct. Here’s a sentence from your conversation and how you can improve it.',
      'You said',
      'A better way to say this is: No, I am planning to do it as a freelance job.',
      "When expressing future plans, you need the verb 'to be' before 'planning'.",
    ]);
  });

  it('more_natural card uses the "more natural" lead-in and adds a period to a bare title', () => {
    const [intro, , betterWay] = SessionsService.feedbackNarrationTexts({
      type: 'more_natural',
      title: 'Sound more natural',
      subtitle: 'Try this.',
      betterWay: 'I am heading out.',
      whyExplanation: 'More fluent.',
    });
    expect(intro).toBe('Sound more natural. Try this.');
    expect(betterWay).toBe('A more natural way to say this is: I am heading out.');
  });

  it('skips empty explanation', () => {
    const texts = SessionsService.feedbackNarrationTexts({ type: 'pronunciation', title: 'T.', subtitle: 'S', betterWay: 'beach' });
    expect(texts).toEqual(['T. S', 'You said', 'A better way to say this is: beach']);
  });
});
