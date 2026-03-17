import React, { useEffect } from 'react';

// ─── DUST SUMMARY CARD ───────────────────────────────────────────────
export function DustSummary({ totalDust = '$847.20', dustTokens = MOCK_DUST }) {
  // ✅ SAFETY: ensure array
  const safeDustTokens = Array.isArray(dustTokens) ? dustTokens : [];

  return (
    <div className="ds-card card animate-slide-up stagger-3">
      <div className="ds-header">
        <span className="label-eyebrow">Recoverable Dust</span>
        <span className="ds-total mono-value pnl-positive">{totalDust}</span>
      </div>

      <div className="divider" />

      <div className="ds-list">
        {safeDustTokens.map(token => (
          <div key={token.id} className="ds-row">
            <div className="ds-token">
              <span className={`chain-badge chain-${token.chain}`}>
                <span className="chain-dot" />
                {token.chain}
              </span>
              <span className="ds-symbol">{token.symbol}</span>
            </div>
            <span className="ds-value mono-value pnl-positive">{token.value}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary w-full" style={{ marginTop: 'var(--space-sm)' }}>
        Recover All Dust
      </button>
    </div>
  );
}

const MOCK_DUST = [
  { id: '1', symbol: 'ETH',   chain: 'eth',      value: '$320.40' },
  { id: '2', symbol: 'USDC',  chain: 'base',     value: '$210.80' },
  { id: '3', symbol: 'MATIC', chain: 'polygon',  value: '$189.20' },
  { id: '4', symbol: 'ARB',   chain: 'arbitrum', value: '$126.80' },
];

// ─── CLEAN POINTS CARD ───────────────────────────────────────────────
export function CleanPointsCard({ points = 2480, level = 'Diamond', nextLevel = 3000 }) {
  // ✅ SAFETY: prevent NaN / divide issues
  const safePoints = Number(points) || 0;
  const safeNext = Number(nextLevel) || 1;

  const pct = Math.max(0, Math.min(100, Math.round((safePoints / safeNext) * 100)));

  return (
    <div className="cp-card card animate-slide-up stagger-4">
      <div className="cp-header">
        <span className="label-eyebrow">Clean Points</span>
        <span className="cp-level">{level}</span>
      </div>

      <div className="cp-value-row">
        <span className="cp-value mono-value">{safePoints.toLocaleString()}</span>
        <span className="cp-pts-label">pts</span>
      </div>

      <div>
        <div className="cp-bar-labels">
          <span className="cp-progress-label">
            {safePoints.toLocaleString()} / {safeNext.toLocaleString()}
          </span>
          <span className="cp-next-label">Next: Master</span>
        </div>
        <div className="health-bar-track" style={{ height: 6, marginTop: 8 }}>
          <div
            className="health-bar-fill"
            style={{ width: `${pct}%`, background: 'var(--accent)' }}
          />
        </div>
      </div>

      <div className="cp-actions-grid">
        {CP_ACTIONS.map(a => (
          <div key={a.id} className="cp-action">
            <span className="cp-action-icon">{a.icon}</span>
            <span className="cp-action-label">{a.label}</span>
            <span className="cp-action-pts mono-value pnl-positive">+{a.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CP_ACTIONS = [
  { id: '1', icon: '🔥', label: 'Burn spam',    pts: 50 },
  { id: '2', icon: '♻️', label: 'Recover dust', pts: 25 },
  { id: '3', icon: '⚡', label: 'Auto sweep',   pts: 10 },
  { id: '4', icon: '🎯', label: 'Daily clean',  pts: 100 },
];

export default DustSummary;

/* ─── STYLES (React-safe injection) ─────────────────────────────────── */
const styles = `
.ds-card { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.ds-header { display: flex; align-items: center; justify-content: space-between; }
.ds-total { font-size: 18px; }
.ds-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.ds-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
.ds-token { display: flex; align-items: center; gap: var(--space-sm); }
.ds-symbol { font-size: 13px; font-weight: 600; }
.ds-value { font-size: 13px; }

.cp-card { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.cp-header { display: flex; align-items: center; justify-content: space-between; }
.cp-level {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 10px; border-radius: var(--radius-pill);
  background: rgba(0, 212, 255, 0.15); color: var(--accent); border: 1px solid var(--border-accent);
}
.cp-value-row { display: flex; align-items: baseline; gap: 4px; }
.cp-value { font-size: 32px; }
.cp-pts-label { font-size: 14px; color: var(--text-secondary); }
.cp-bar-labels { display: flex; justify-content: space-between; }
.cp-progress-label, .cp-next-label { font-size: 11px; color: var(--text-tertiary); }
.cp-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--border); }
.cp-action { display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: var(--radius-sm); background: var(--bg-elevated); }
.cp-action-icon { font-size: 14px; }
.cp-action-label { font-size: 11px; color: var(--text-secondary); flex: 1; }
.cp-action-pts { font-size: 11px; }
`;

export function DustSummaryStyles() {
  useEffect(() => {
    const id = 'ds-cp-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = styles;
      document.head.appendChild(el);
    }
  }, []);

  return null;
}
