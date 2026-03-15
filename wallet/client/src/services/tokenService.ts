const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export async function fetchWalletTokens(walletAddress: string) {
  try {
    const res = await fetch(`${API_BASE}/tokens/list?walletAddress=${walletAddress}`);
    return await res.json(); // Expected: [{ symbol, balance, type }]
  } catch (err) {
    console.error("Fetch wallet tokens failed:", err);
    return [];
  }
}
