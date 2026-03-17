const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5173";

export interface SwapResult {
  success: boolean;
  message?: string;
}

// ─── SAFE JSON PARSER ─────────────────────────────
async function safeJson(res: Response) {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// ─── FETCH TOKENS ────────────────────────────────
export async function fetchWalletTokens(walletAddress: string) {
  try {
    const res = await fetch(`${API_BASE}/wallet/${walletAddress}/tokens`);

    if (!res.ok) {
      console.error("Fetch tokens API error:", res.status);
      return [];
    }

    const data = await safeJson(res);

    // ensure array
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Fetch wallet tokens failed:", err);
    return [];
  }
}

// ─── MANUAL SWAP ────────────────────────────────
export async function executeManualSwap(walletAddress: string): Promise<SwapResult> {
  try {
    const res = await fetch(`${API_BASE}/tokens/manual-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}` };
    }

    const data = await safeJson(res);

    return {
      success: Boolean(data?.success),
      message: data?.message || "Swap failed",
    };
  } catch (err) {
    console.error("Manual swap failed:", err);
    return { success: false, message: String(err) };
  }
}

// ─── AUTO SWAP ──────────────────────────────────
export async function executeAutoSwap(walletAddress: string): Promise<SwapResult> {
  try {
    const res = await fetch(`${API_BASE}/tokens/auto-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });

    if (!res.ok) {
      return { success: false, message: `HTTP ${res.status}` };
    }

    const data = await safeJson(res);

    return {
      success: Boolean(data?.success),
      message: data?.message || "Auto swap failed",
    };
  } catch (err) {
    console.error("Auto swap failed:", err);
    return { success: false, message: String(err) };
  }
}
