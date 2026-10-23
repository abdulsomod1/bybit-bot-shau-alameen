// Shared types between main and renderer processes

export interface ApiCredentials {
  apiKey: string;
  apiSecret: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  launchAtLogin: boolean;
  pollingIntervalMs: number;
  showNotifications: boolean;
  soundAlerts: boolean;
  language: string;
}

export interface BotStatus {
  status: 'running' | 'paused' | 'stopped' | 'disconnected' | 'starting' | 'error';
  message?: string;
  lastUpdate?: string;
  lastSuccessfulUpdate?: string;
  currentIP?: string;
  lastWorkingIP?: string;
  errorCount: number;
  updateCount: number;
  pendingUpdates: number;
}

export interface Advertisement {
  id: string;
  accountId?: string;
  direction: 'BUY' | 'SELL';
  asset: string;
  fiatCurrency: string;
  price: string;
  availableQuantity: string;
  minOrderAmount: string;
  maxOrderAmount: string;
  status: 'online' | 'offline' | string;
  lastUpdateTime?: string;
  paymentMethods?: string[];
  isSelected?: boolean;
  createdTime?: string;
}

export interface CompetitorAd {
  id: string;
  userName: string;
  nickname: string;
  direction: 'BUY' | 'SELL';
  asset: string;
  fiatCurrency: string;
  price: string;
  availableQuantity: string;
  minOrderAmount: string;
  maxOrderAmount: string;
  paymentMethods?: string[];
  lastUpdateTime?: string;
  rank?: number;
  completionRate?: number;
}

export interface CompetitorRanking {
  marketKey: string;
  direction: 'BUY' | 'SELL';
  asset: string;
  fiatCurrency: string;
  competitors: CompetitorAd[];
  firstRanked?: CompetitorAd;
  secondRanked?: CompetitorAd;
  thirdRanked?: CompetitorAd;
  lastRefresh?: string;
  dataStale: boolean;
  refreshError?: string;
}

export type StrategyType = 'match_1st' | 'match_2nd' | 'match_3rd' | 'under_3rd' | 'fixed' | 'offset_fixed' | 'monitor_only';

export interface PricingRule {
  id: string;
  name: string;
  direction: 'BUY' | 'SELL';
  asset: string;
  fiatCurrency: string;
  strategy: StrategyType;
  fixedPrice?: number;
  offsetAmount: number;
  offsetType: 'percentage' | 'fixed';
  minPrice?: number;
  maxPrice?: number;
  maxChangePercent: number;
  minIntervalMs: number;
  maxUpdatesPerHour: number;
  maxUpdatesPerDay: number;
  pricePrecision: number;
  maxDeviationPercent: number;
  manualApproval: boolean;
  dryRun: boolean;
  enabled: boolean;
  paymentMethodIds?: string[];
  targetPosition?: number;
  priceOffset?: number;
}

export interface PricingDecision {
  ruleId: string;
  adId: string;
  currentPrice: number;
  targetPrice: number;
  competitorPrice: number;
  competitorRank: number;
  withinLimits: boolean;
  reason?: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug';
  category: string;
  message: string;
  details?: string;
  adId?: string;
  previousValue?: string;
  newValue?: string;
}

export interface ApiConnectionStatus {
  connected: boolean;
  lastCheck?: string;
  apiKeyPrefix?: string;
  error?: string;
  errorCode?: string;
}

export interface BybitP2PAdv {
  id: string;
  user_id: string;
  account_id: string;
  merchant_id: string;
  create_time: number;
  update_time: number;
  side: 'Buy' | 'Sell';
  assets: string;
  fiat_en: string;
  fiat_ccy: string;
  price: string;
  price_type: number;
  premium: string;
  auto_reply: string;
  pay_term: string;
  min_amount: string;
  max_amount: string;
  amount: string;
  tradable_amount: string;
  frozen_amount: string;
  released_amount: string;
  payment_ids: string;
  payment_names: string;
  user_nickname: string;
  remark: string;
  status: number;
  advertiser_user_id: string;
  ad_close_reason: number;
  fee_accepted: string;
  counter_party_kyc_level: number;
  counter_party_vip_level: number;
  counter_party_register_time: number;
  online_time: number;
  locked_amount: string;
  api_key_whitelist_ip: string;
  completed_business_count?: number;
  total_trade_count?: number;
}

export interface BybitP2PMarketResponse {
  ret_code: number;
  ret_msg: string;
  result: {
    count: number;
    list: BybitP2PAdv[];
  };
}

export interface BotState {
  status: 'stopped' | 'running' | 'paused' | 'starting' | 'error';
  message?: string;
  last_update?: string;
  last_successful_update?: string;
  current_ip?: string;
  last_working_ip?: string;
  error_count: number;
  update_count: number;
  ip_whitelist_enabled?: boolean;
  ip_whitelist?: string[];
}

export interface RankingSnapshot {
  marketKey: string;
  competitors: CompetitorAd[];
  snapshotTime: string;
}
