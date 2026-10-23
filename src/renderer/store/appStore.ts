import { create } from 'zustand';

export const useAppStore = create<any>((set) => ({
  page: 'dashboard',
  setPage: (page: string) => set({ page }),
  // Bot status
  status: null, setStatus: (status: any) => set({ status }),
  // Ads
  ads: [], setAds: (ads: any[]) => set({ ads }),
  // Rules
  rules: [], setRules: (rules: any[]) => set({ rules }),
  // Rankings
  rankings: [], setRankings: (rankings: any[]) => set({ rankings }),
  // Logs
  logs: [], setLogs: (logs: any[]) => set({ logs }),
  // Credentials
  credentials: null, setCredentials: (credentials: any) => set({ credentials }),
  // App settings
  settings: null, setSettings: (settings: any) => set({ settings }),
  // Bot state
  botState: null, setBotState: (botState: any) => set({ botState }),
}));
