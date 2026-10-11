import { MissionReportData } from '@/components/roadmap/mission-report-modal';

export interface FeedbackItem {
  type: 'grammar' | 'more_natural' | 'pronunciation';
  badge: string;
  title: string;
  subtitle: string;
  youSaid: string;
  youSaidHighlight?: string;
  youSaidDetail?: string;
  betterWay: string;
  betterWayHighlight?: string;
  ipa?: string;
  whyExplanation: string;
  spokenIntro: string;
  userTurnIndex: number;
  userAudioUrl?: string;
}

export interface ExtendedSessionReport extends MissionReportData {
  id?: string;
  sessionId?: string;
  callParams?: Record<string, any>;
  sessionTurns?: Array<{ role: 'user' | 'model'; text: string; turnIndex?: number; audioUrl?: string }>;
  activeHints?: string[];
  feedbackItems?: FeedbackItem[];
}

let inMemoryReport: ExtendedSessionReport | null = null;
let inMemoryFeedbackItems: FeedbackItem[] | null = null;

export function setLatestFeedbackItems(items: FeedbackItem[]) {
  inMemoryFeedbackItems = items;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem('maya_latest_feedback_items', JSON.stringify(items));
    } catch {}
  }
}

export function getLatestFeedbackItems(): FeedbackItem[] | null {
  const sanitize = (list: FeedbackItem[]): FeedbackItem[] => {
    return list.map((item) => ({
      ...item,
      // Dead in-memory blob URLs (blob:http://...) from previous sessions cannot be loaded
      userAudioUrl: (item.userAudioUrl && !item.userAudioUrl.startsWith('blob:')) ? item.userAudioUrl : undefined,
    }));
  };

  if (inMemoryFeedbackItems) return sanitize(inMemoryFeedbackItems);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem('maya_latest_feedback_items');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          inMemoryFeedbackItems = sanitize(parsed);
          return inMemoryFeedbackItems;
        }
      }
    } catch {}
  }
  return null;
}

export function setLatestSessionReport(report: ExtendedSessionReport) {
  inMemoryReport = report;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem('maya_latest_session_report', JSON.stringify(report));
    } catch {}
  }
}

export function getLatestSessionReport(): ExtendedSessionReport | null {
  if (inMemoryReport) return inMemoryReport;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem('maya_latest_session_report');
      if (raw) {
        inMemoryReport = JSON.parse(raw);
        return inMemoryReport;
      }
    } catch {}
  }
  return null;
}
