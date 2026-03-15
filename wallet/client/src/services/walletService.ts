const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export async function recoverDust(walletAddress: string) {
  try {
    const res = await fetch(`${API_BASE}/recovery/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    });
    return await res.json();
  } catch (err) {
    console.error("Recover dust failed:", err);
    return { error: true };
  }
}

export async function burnSpam(walletAddress: string) {
  try {
    const res = await fetch(`${API_BASE}/burn/burnSpam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    });
    return await res.json();
  } catch (err) {
    console.error("Burn spam failed:", err);
    return { error: true };
  }
}
