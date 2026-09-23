export interface PriceConfig {
  modelId: string;
  audioInputPerMillion: number;
  audioOutputPerMillion: number;
  textInputPerMillion: number;
  textOutputPerMillion: number;
  audioTokensPerSecIn: number;
  audioTokensPerSecOut: number;
  exchangeRateUsdToLkr: number;
}

export interface ConversationProfile {
  id: 'A' | 'B' | 'C' | string;
  name: string;
  description: string;
  userSpeakingSecPerMin: number;
  aiSpeakingSecPerMin: number;
  silenceSecPerMin: number;
  isGatedMic: boolean;
  avgTurnsPerMin: number;
  contextRebillPerTurnTokens: number;
}

export interface CostBreakdown {
  profileId: string;
  profileName: string;
  userSpeechSec: number;
  aiSpeechSec: number;
  audioInTokens: number;
  audioOutTokens: number;
  contextTokens: number;
  audioInCostUsd: number;
  audioOutCostUsd: number;
  contextCostUsd: number;
  totalCostUsdPerMin: number;
  totalCostLkrPerMin: number;
  budgetTargetLkr: number;
  isWithinBudget: boolean;
  marginLkrPerMin: number;
}

export interface SensitivityPoint {
  parameter: string;
  value: number | string;
  costUsdPerMin: number;
  costLkrPerMin: number;
  isWithinBudget: boolean;
}

export interface CostReportData {
  generatedAt: string;
  priceConfig: PriceConfig;
  profiles: CostBreakdown[];
  exchangeRateSensitivity: SensitivityPoint[];
  aiReplyLengthSensitivity: SensitivityPoint[];
  sessionLengthSensitivity: SensitivityPoint[];
  budgetGateStatus: 'PASS' | 'FAIL_NEEDS_MITIGATION';
  mitigations: string[];
}
