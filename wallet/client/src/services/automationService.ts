import apiClient from './apiClient';

/**
 * Premium Automation Service
 * Upgraded: Handles PrivateKey injection for Flashbots-shielded background execution.
 */

export interface AutomationRule {
  id: number;
  walletAddress: string;
  type: 'AUTO_BURN' | 'AUTO_RECOVERY';
  chain: string;
  active: boolean;
  targetBalance?: string;
  createdAt: string;
}

export interface CreateRulePayload {
  type: 'AUTO_BURN' | 'AUTO_RECOVERY';
  chain: string;
  privateKey: string; // Required for the Backend Engine to sign bundles
  targetBalance?: string;
}

export const automationService = {
  // ─── Rules Management ────────────────────────────────────
  
  /**
   * Fetches all rules for a wallet.
   * Matches Backend: GET /api/automation/rules?address=...
   */
  getRules: (address: string) =>
    apiClient.get<{ success: boolean; rules: AutomationRule[] }>(`/automation/rules?address=${address}`),

  /**
   * Creates a new rule with PrivateKey for workers.
   * Matches Backend: POST /api/automation/rules
   */
  createRule: (address: string, payload: CreateRulePayload) =>
    apiClient.post<{ success: boolean; rule: AutomationRule }>('/automation/rules', {
      address,
      ...payload
    }),

  /**
   * Updates an existing rule (Toggle active or change config)
   * Matches Backend: PATCH /api/automation/rules/:id
   */
  updateRule: (id: number, data: { active?: boolean; targetBalance?: string; privateKey?: string }) =>
    apiClient.patch<{ success: boolean; updated: AutomationRule }>(`/automation/rules/${id}`, data),

  /**
   * Deletes a rule permanently.
   * Matches Backend: DELETE /api/automation/rules/:id
   */
  deleteRule: (id: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/automation/rules/${id}`),

  // ─── Logs & Streaming ────────────────────────────────────

  /**
   * Real-time Log Streaming via SSE (Server-Sent Events)
   * Connects to the Worker output for live status updates.
   */
  subscribeLogs: (
    address: string,
    onLog: (log: any) => void,
    onError?: (err: Event) => void
  ): (() => void) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const source = new EventSource(`${base}/automation/logs/stream?address=${address}`);

    source.onmessage = (e) => {
      try { 
        onLog(JSON.parse(e.data)); 
      } catch { 
        /* ignore malformed events */ 
      }
    };

    if (onError) source.onerror = onError;

    return () => source.close();
  },

  /**
   * Fetches Historical Automation Stats
   */
  getStats: (address: string) =>
    apiClient.get(`/automation/stats?address=${address}`),
};

export default automationService;
