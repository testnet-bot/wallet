import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useBalance } from 'wagmi';
import { formatUnits } from 'viem';


// ─── FETCH TOKENS LOGIC ────────────────────────────────────────

// ─── TOKENLIST COMPONENT ───────────────────────────────────────
export default function TokenList() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: native } = useBalance({ address });

  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('value');

  // ─── SYNC WALLET TOKENS ──────────────────────────────────────
  const syncWallet = useCallback(async () => {
    if (!isConnected || !address) return;
    setLoading(true);
    setError(null);
    try {
    const res = await fetch(
        `http://localhost:3001/tokens/list?walletAddress=${address}`
        );

        const erc20s = await res.json();
   

      const nativeItem = native ? [{
        id: 'native',
        symbol: native.symbol,
        name: native.symbol === 'ETH' ? 'Ethereum' : 'Native Token',
        balance: native ? formatUnits(native.value, native.decimals) : "0",
        usdValue: 0,
        chainLabel: native.symbol,
        isSpam: false
      }] : [];

      setTokens([...nativeItem, ...erc20s]);
    } catch (e) {
      console.error("Sync error", e);
      setError('Unable to load tokens');
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, chainId, native]);

  useEffect(() => { syncWallet(); }, [syncWallet]);

  // ─── FILTER + SORT ─────
  const filtered = tokens
    .filter(t => filter === 'all' ? true : filter === 'spam' ? t.isSpam : !t.isSpam)
    .sort((a, b) => {
      if (sortBy === 'value') return b.usdValue - a.usdValue;
      if (sortBy === 'name') return a.symbol.localeCompare(b.symbol);
      return 0;
    });

  // ─── RENDER ───────
  return (
    <div className="tl-container card">
      <div className="tl-header">
        <span className="label-eyebrow">
          {isConnected ? loading ? "Syncing Blockchain Data..." : error ? "Error loading tokens" : `Wallet Assets (${tokens.length})` : "Connect wallet to view tokens"}
        </span>

        {isConnected && (
          <div className="tl-controls">
            <div className="tl-tabs">
              {[
                { id: 'all', label: 'All' },
                { id: 'clean', label: 'Clean' },
                { id: 'spam', label: 'Spam' },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`tl-tab ${filter === tab.id ? 'active' : ''}`}
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select className="tl-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
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
        {loading && <div style={{ padding: '1rem' }}>Loading tokens...</div>}
        {error && <div style={{ padding: '1rem', color: 'red' }}>{error}</div>}
        {!loading && !error && filtered.map((token, i) => (
          <div key={token.id} className={`token-row tl-row ${token.isSpam ? 'spam' : ''} animate-slide-up stagger-${Math.min(i + 1, 8)}`}>
            <div className="tl-token-info">
              <div className="token-icon">
                {token.logo ? (
                  <img src={token.logo} alt={token.symbol} width="28" height="28" style={{ borderRadius: '50%' }} />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>{token.symbol[0]}</span>
                )}
                {token.isSpam && <div className="spam-badge-overlay" title="Spam token">!</div>}
              </div>

              <div className="token-info">
                <div className="token-name">{token.name}</div>
                <div className="token-meta">
                  <span className={`chain-badge chain-${token.chain}`}>
                    <span className="chain-dot" />
                    {token.chainLabel}
                  </span>
                  {token.isSpam && <span className="spam-label">spam</span>}
                </div>
              </div>
            </div>

            <div className="tl-balance">
              <div className="token-usd">{token.balance} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{token.symbol}</span></div>
            </div>

            <div className="token-values">
              <div className="token-usd">${token.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            <div className={`tl-change ${token.change24h >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
              <span className={`pnl-badge ${token.change24h >= 0 ? 'positive' : 'negative'}`}>
                {token.change24h >= 0 ? '+' : ''}{token.change24h}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
