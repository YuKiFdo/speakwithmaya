/**
 * Universal canonical lesson parser & formatter for Maya AI Roadmap Curriculum.
 *
 * Adheres strictly to the canonical plain-text format:
 *
 * Lesson: Ordering Food at a Restaurant
 *
 * What you’ll practice:
 * - Asking for a table and looking at the menu
 * - Ordering food and drinks naturally
 * - Asking about ingredients and recommendations
 * - Making simple special requests
 * - Asking for the bill and paying politely
 * - Practicing common restaurant phrases with confidence
 */

export const DEFAULT_CANONICAL_TEMPLATE = `Lesson: Ordering Food at a Restaurant

What you’ll practice:
- Asking for a table and looking at the menu
- Ordering food and drinks naturally
- Asking about ingredients and recommendations
- Making simple special requests
- Asking for the bill and paying politely
- Practicing common restaurant phrases with confidence`;

export function parseCanonicalLessonContent(raw: string): { title?: string; practicePoints: string[] } {
  if (!raw || typeof raw !== 'string') return { practicePoints: [] };
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  let title: string | undefined;
  const practicePoints: string[] = [];

  for (const line of lines) {
    const lessonMatch = line.match(/^lesson:\s*(.+)$/i);
    if (lessonMatch) {
      title = lessonMatch[1].trim();
      continue;
    }
    const bulletMatch = line.match(/^[-*•]\s*(.+)$/);
    if (bulletMatch) {
      practicePoints.push(bulletMatch[1].trim());
      continue;
    }
  }

  return { title, practicePoints };
}

export function formatCanonicalLessonContent(title: string, practicePoints: string[] = []): string {
  const points = (practicePoints || []).map((p) => `- ${p}`).join('\n');
  return `Lesson: ${title || 'Speaking Practice'}\n\nWhat you’ll practice:\n${points}`;
}
