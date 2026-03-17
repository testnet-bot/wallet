import React, { useState } from "react";

import { recoverDust } from "../../services/walletService";

interface Props {
  walletAddress: string;
  onSuccess?: () => void;
}

export default function RecoverDustButton({ walletAddress, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecover = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);

    try {
      const result = await recoverDust(walletAddress);
      if (result?.error) throw new Error(result.error || "Recovery failed");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Recovery failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-button-wrapper">
      <button
        className="btn btn-primary btn-sm"
        onClick={handleRecover}
        disabled={loading}
      >
        {loading ? "Recovering..." : "Recover Dust"}
      </button>
      {error && <p className="error-text" style={{ color: "var(--red)", marginTop: "4px" }}>{error}</p>}
    </div>
  );
}

// Optional: inject button-specific styles if needed
const styles = `
.action-button-wrapper { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
`;

if (typeof document !== "undefined") {
  const id = "recover-dust-btn-styles";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = styles;
    document.head.appendChild(el);
  }
}