import { describe, it, expect } from 'vitest';
import { renderSmsTemplate, smsSegments } from './sms-template.js';

describe('renderSmsTemplate', () => {
  it('fills name, first_name and link', () => {
    expect(
      renderSmsTemplate('Hi {{first_name}}, practise today: {{link}}', {
        name: 'Nimal Perera',
        link: 'https://app.speakwithmaya.com/?r=Ab3xK9mQ',
      }),
    ).toBe('Hi Nimal, practise today: https://app.speakwithmaya.com/?r=Ab3xK9mQ');
  });

  it('uses the fallback when the value is missing, and tidies empty variables', () => {
    expect(renderSmsTemplate('Hi {{first_name|there}}!', { name: '' })).toBe('Hi there!');
    expect(renderSmsTemplate('Hi {{name}}, welcome back', { name: null })).toBe('Hi, welcome back');
  });

  it('appends the link when {{link}} is not used', () => {
    expect(renderSmsTemplate('New lessons are live.', { link: 'https://app.speakwithmaya.com/?r=x' })).toBe(
      'New lessons are live. https://app.speakwithmaya.com/?r=x',
    );
  });

  it('is case/space tolerant and blanks unknown variables', () => {
    expect(renderSmsTemplate('{{ First_Name }} {{unknown}}ok', { name: 'Ann Lee' })).toBe('Ann ok');
  });
});

describe('smsSegments', () => {
  it('GSM-7: 160 chars per single SMS, 153 per part', () => {
    expect(smsSegments('a'.repeat(160))).toMatchObject({ segments: 1, unicode: false });
    expect(smsSegments('a'.repeat(161))).toMatchObject({ segments: 2, unicode: false });
  });
  it('Unicode (Sinhala/emoji): 70 per single SMS, 67 per part', () => {
    expect(smsSegments('ආ'.repeat(70))).toMatchObject({ segments: 1, unicode: true });
    expect(smsSegments('ආ'.repeat(71))).toMatchObject({ segments: 2, unicode: true });
  });
});
