import { MissionReportData } from '@/components/roadmap/mission-report-modal';

export interface ExtendedSessionReport extends MissionReportData {
  callParams?: Record<string, any>;
}

let inMemoryReport: ExtendedSessionReport | null = null;

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
