import { Platform } from 'react-native';
import { getBackendBaseUrl } from '@/utils/backend-url';

/**
 * SMS broadcasts can carry a tracked link (https://app.speakwithmaya.com/...?r=<token>),
 * unique per recipient. When the web app opens with ?r, report the click once and remove
 * the parameter from the address bar (so reloads, shares and screenshots do not carry it).
 */
export function reportSmsLinkClick(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return;
  }
  const token = url.searchParams.get('r');
  if (!token || !/^[A-Za-z0-9]{8}$/.test(token)) return;

  // Strip it right away; the click is reported below
  url.searchParams.delete('r');
  try {
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }

  // Once per token per browser (a reopened tab should not count again)
  const key = `maya:sms-click:${token}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable: still report */
  }

  void fetch(`${getBackendBaseUrl()}/v1/track/sms-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    keepalive: true,
  }).catch(() => {});
}
