/**
 * Sanitizes model speech and tool text output to protect against:
 * 1. Cross-lingual Devanagari/Hindi script leakage (e.g. 'कार्यालय' -> 'office ')
 * 2. Phonetic speech-to-text hallucinations in low-resource Sinhala (e.g. 'බග්ග' -> 'ගැන')
 */

const DEVANAGARI_WORD_MAP: Record<string, string> = {
  'कार्यालयයක': 'office එකක',
  'कार्यालयක': 'office එකක',
  'कार्यालय': 'office',
  'विद्यालय': 'school එක',
  'विश्वविद्यालय': 'campus එක',
  'होटल': 'hotel එක',
};

// Common low-resource Sinhala speech transcription hallucinations
const SINHALA_HALLUCINATION_MAP: Array<[RegExp, string]> = [
  [/\bබග්ග\b/g, 'ගැන'],
  [/තැන බග්ග/g, 'තැන ගැන'],
];

export function sanitizeModelText(text: string | null | undefined): string {
  if (!text) return '';
  let cleaned = String(text);

  // 1. Replace known Devanagari phrases with natural Sri Lankan Singlish
  for (const [hindi, replacement] of Object.entries(DEVANAGARI_WORD_MAP)) {
    if (cleaned.includes(hindi)) {
      cleaned = cleaned.split(hindi).join(replacement);
    }
  }

  // 2. Strip any remaining rogue Devanagari characters (U+0900 to U+097F)
  if (/[\u0900-\u097F]/.test(cleaned)) {
    cleaned = cleaned.replace(/[\u0900-\u097F]+/g, '').replace(/\s{2,}/g, ' ');
  }

  // 3. Strip rogue Arabic, Farsi, Persian, Urdu characters (U+0600 to U+06FF, U+0750 to U+077F, U+08A0 to U+08FF, U+FB50 to U+FDFF, U+FE70 to U+FEFF)
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(cleaned)) {
    cleaned = cleaned.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').replace(/\s{2,}/g, ' ');
  }

  // 4. Fix known phonetic hallucinations in spoken Sinhala transcripts
  for (const [pattern, replacement] of SINHALA_HALLUCINATION_MAP) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return cleaned.trim();
}
