import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";

export type Token = {
  id: string;
  symbol: string;
  name: string;
  logo?: string | null;
  balance: number | string;
  usdValue: number;
  change24h?: number;
  chainLabel?: string;
  isSpam?: boolean;
  tokenAddress?: string;
  chainId?: number;
};

interface TokenListProps {
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  filter?: "all" | "clean" | "spam";
  sortBy?: "value" | "name";
  tokens?: Token[];
  walletAddress?: string;
  autoRefresh?: boolean;
  onTokensChange?: (tokens: Token[]) => void;
}

export default function TokenList({
  selectable = false,
  selectedIds = [],
  onSelect,
  filter: externalFilter,
  sortBy: externalSort,
  tokens: externalTokens,
  walletAddress: customAddress,
  autoRefresh = true,
  onTokensChange,
}: TokenListProps) {
  const { address: connectedAddress, isConnected } = useAccount();
  const address = customAddress || connectedAddress;

  const { data: native } = useBalance({
    address: address as `0x${string}` | undefined,
  });

  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(externalFilter || "all");
  const [sortBy, setSortBy] = useState(externalSort || "value");

  // ── FETCH TOKENS ───────────────────────────────
  const fetchTokens = useCallback(async () => {
    if (!isConnected && !customAddress) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `http://localhost:3001/tokens/list?walletAddress=${address}`
      );

      if (!res.ok) throw new Error("API error");

      let erc20s: Token[] = [];
      try {
        const data = await res.json();
        erc20s = Array.isArray(data) ? data : [];
      } catch {
        erc20s = [];
      }

      const nativeItem: Token[] =
        native && native.value
          ? [
              {
                id: "native",
                symbol: native.symbol || "ETH",
                name: native.symbol === "ETH" ? "Ethereum" : "Native Token",
                balance: formatUnits(native.value, native.decimals),
                usdValue: 0,
                change24h: 0,
                chainLabel: native.symbol || "native",
                isSpam: false,
              },
            ]
          : [];

      const safeExternal = Array.isArray(externalTokens) ? externalTokens : null;

      const allTokens = safeExternal || [...nativeItem, ...erc20s];

      setTokens(Array.isArray(allTokens) ? allTokens : []);

      if (onTokensChange) onTokensChange(allTokens || []);
    } catch (err) {
      console.error("Token sync error:", err);
      setError("Unable to load tokens");
      setTokens([]);
      if (onTokensChange) onTokensChange([]);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, native, externalTokens, customAddress, onTokensChange]);

  // ── AUTO REFRESH ────────────────────────────────
  useEffect(() => {
    fetchTokens();

    if (autoRefresh) {
      const interval = setInterval(fetchTokens, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchTokens, autoRefresh]);

  // ── FILTER & SORT ───────────────────────────────
  const filteredTokens = useMemo(() => {
    const currentFilter = externalFilter || filter;
    const currentSort = externalSort || sortBy;

    const base = Array.isArray(externalTokens)
      ? externalTokens
      : Array.isArray(tokens)
      ? tokens
      : [];

    return base
      .filter((t) =>
        currentFilter === "all"
          ? true
          : currentFilter === "spam"
          ? t?.isSpam
          : !t?.isSpam
      )
      .sort((a, b) => {
        if (currentSort === "value") return (b?.usdValue || 0) - (a?.usdValue || 0);
        if (currentSort === "name") return (a?.symbol || "").localeCompare(b?.symbol || "");
        return 0;
      });
  }, [tokens, externalTokens, filter, sortBy, externalFilter, externalSort]);

  const handleSelect = (id: string) => {
    if (!selectable || !onSelect) return;
    onSelect(id);
  };

  return (
    <div className="tl-container card">
      <div className="tl-header">
        <span className="label-eyebrow">
          {address
            ? loading
              ? "Syncing Blockchain Data..."
              : error
              ? "Error loading tokens"
              : `Wallet Assets (${filteredTokens.length})`
            : "Connect wallet to view tokens"}
        </span>

        {address && (
          <div className="tl-controls">
            <div className="tl-tabs">
              {[
                { id: "all", label: "All" },
                { id: "clean", label: "Clean" },
                { id: "spam", label: "Spam" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`tl-tab ${filter === tab.id ? "active" : ""}`}
                  onClick={() => setFilter(tab.id as "all" | "clean" | "spam")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              className="tl-sort"
              value={sortBy as "value" | "name"}
              onChange={(e) => setSortBy(e.target.value as "value" | "name")}
            >
              <option value="value">By Value</option>
              <option value="name">By Name</option>
            </select>
          </div>
        )}
      </div>

      <div className="tl-col-labels">
        <span>Token</span>
        <span>Balance</span>
        <span>Value</span>
        <span>24h</span>
      </div>

      <div className="divider" />

      <div className="tl-list">
        {loading && <div style={{ padding: "1rem" }}>Loading tokens...</div>}
        {error && <div style={{ padding: "1rem", color: "red" }}>{error}</div>}

        {!loading &&
          !error &&
          filteredTokens.map((token, i) => {
            const change = token?.change24h ?? 0;
            const isSelected = safeSelectedIds.includes(token?.id);

            return (
              <div
                key={token?.id || i}
                className={`token-row tl-row ${
                  token?.isSpam ? "spam" : ""
                } animate-slide-up stagger-${Math.min(i + 1, 8)} ${
                  selectable && isSelected ? "selected" : ""
                }`}
                onClick={() => handleSelect(token?.id)}
              >
                <div className="tl-token-info">
                  <div className="token-icon">
                    {token?.logo ? (
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        width="28"
                        height="28"
                        style={{ borderRadius: "50%" }}
                      />
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 700 }}>
                        {token?.symbol?.[0] || "?"}
                      </span>
                    )}

                    {token?.isSpam && (
                      <div className="spam-badge-overlay">!</div>
                    )}
                  </div>

                  <div className="token-info">
                    <div className="token-name">{token?.name || "Unknown"}</div>
                    <div className="token-meta">
                      <span className={`chain-badge chain-${token?.chainLabel || "unknown"}`}>
                        <span className="chain-dot" />
                        {token?.chainLabel || "unknown"}
                      </span>
                      {token?.isSpam && <span className="spam-label">spam</span>}
                    </div>
                  </div>
                </div>

                <div className="tl-balance">
                  <div className="token-usd">
                    {token?.balance || 0}{" "}
                    <span>{token?.symbol || "?"}</span>
                  </div>
                </div>

                <div className="token-values">
                  <div className="token-usd">
                    $
                    {(Number(token?.usdValue) || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>

                <div className={`tl-change ${change >= 0 ? "pnl-positive" : "pnl-negative"}`}>
                  <span className={`pnl-badge ${change >= 0 ? "positive" : "negative"}`}>
                    {change >= 0 ? "+" : ""}
                    {change}%
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
