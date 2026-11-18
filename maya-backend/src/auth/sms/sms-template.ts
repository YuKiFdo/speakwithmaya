/**
 * SMS broadcast templates: {{name}}, {{first_name}}, {{link}}, with an optional fallback
 * after "|" (e.g. {{first_name|there}}). Unknown variables render as empty text.
 *
 * Kept identical to maya-frontend/src/utils/sms-template.ts (the admin preview), so what
 * the admin sees is exactly what is sent.
 */
export interface SmsTemplateVars {
  name?: string | null;
  first_name?: string | null;
  link?: string | null;
}

export const SMS_TEMPLATE_VARIABLES = ['name', 'first_name', 'link'] as const;

const VAR_RE = /\{\{\s*([a-z_]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/gi;

export function firstNameOf(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** Renders the template; if a link is given but {{link}} is not used, it is appended. */
export function renderSmsTemplate(template: string, vars: SmsTemplateVars): string {
  const values: Record<string, string> = {
    name: (vars.name || '').trim(),
    first_name: (vars.first_name ?? firstNameOf(vars.name)).trim(),
    link: (vars.link || '').trim(),
  };
  let usedLink = false;
  let out = template.replace(VAR_RE, (_m, key: string, fallback?: string) => {
    const k = key.toLowerCase();
    if (k === 'link') usedLink = true;
    return values[k] || (fallback ?? '');
  });
  if (values.link && !usedLink) out = `${out.trimEnd()} ${values.link}`;
  // Tidy spaces left by empty variables ("Hi , ..." -> "Hi, ...")
  return out.replace(/[ \t]+([,.!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
}

/** True when the template only uses GSM-7 characters (160 per SMS); otherwise UCS-2 (70). */
export function isGsm7(text: string): boolean {
  return /^[\n\r A-Za-z0-9@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/.test(text);
}

/** SMS parts needed: 160/153 chars (GSM-7) or 70/67 (Unicode, e.g. Sinhala, emoji). */
export function smsSegments(text: string): { chars: number; segments: number; unicode: boolean } {
  const unicode = !isGsm7(text);
  const chars = [...text].length;
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return { chars, unicode, segments: chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi) };
}
