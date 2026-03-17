

import React, { useState, useEffect, useMemo } from 'react';
import RecoverDustButton from '../../components/actions/RecoverDustButton';
import BatchBurnButton from '../../components/actions/BatchBurnButton';
 import SweepSpamButton from '../../components/actions/SweepSpamButton';
import WalletHealthCard from '../../components/dashboard/WalletHealthCard';
import DustSummary from '../../components/dashboard/DustSummary';
import "../../styles/components.css";
import { useTokens } from '../../hooks/useTokens';
import TokenList from '../../components/dashboard/TokenList';
import { executeManualSwap, executeAutoSwap } from '../../services/tokenService';

// ─── TYPES ─────────
type ItemType = 'all' | 'dust' | 'spam' | 'zero';

interface RecoveryItem {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  chainLabel: string;
  balance: number;
  usdValue: number;
  isSpam?: boolean;
  type: 'dust' | 'spam' | 'zero';
  logo?: string;
}

// ─── COMPONENT ──────
interface RecoveryPageProps {
  walletAddress?: string;
  nftHolder?: boolean;
}

export default function RecoveryPage({ walletAddress, nftHolder = false }: RecoveryPageProps) {
 

  const { tokens, refresh } = useTokens();
  console.log("Tokens:", tokens);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // NFT Auto-Swap
  const [autoSwapEnabled, setAutoSwapEnabled] = useState<boolean>(nftHolder);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'swapping' | 'done' | 'error'>('idle');

  const spamTokens = tokens.filter(t => t.isSpam);
  const dustTokens = tokens.filter(t => Number(t.balance) > 0 && !t.isSpam);

  const allVisibleSelected = tokens.length > 0 && tokens.every(t => selected.has(t.id));

  // ── Derived Values ─────────
  const selectedItems = tokens.filter(t => selected.has(t.id));
  const selectedValue = selectedItems.reduce((sum, t) => sum + t.usdValue, 0);
  const dustTotal = dustTokens.reduce((sum, t) => sum + t.usdValue, 0);
  const spamCount = spamTokens.length;
  const zeroCount = tokens.filter(t => Number(t.balance) === 0).length;

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const selectAll = () => setSelected(new Set(tokens.map(t => t.id)));
  const clearAll = () => setSelected(new Set());

  // ── Batch Burn Setup ──────
  const batchTokens = spamTokens
    .filter(t => selected.has(t.id) || selected.size === 0)
    .map(t => ({
      id: t.id,
      symbol: t.symbol,
      tokenAddress: t.tokenAddress,
      chainId: t.chainId || 1,
    }));

  const [burningToken, setBurningToken] = useState<string | null>(null);
  const [burnLog, setBurnLog] = useState<string[]>([]);

  const handleBatchProgress = (tokenSymbol: string, status: 'start' | 'success' | 'error') => {
    setBurningToken(status === 'start' ? tokenSymbol : null);
    setBurnLog(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${tokenSymbol} - ${status.toUpperCase()}`
    ]);
  };

  // ── NFT Auto-Swap Effect ───────
  useEffect(() => {
   if (!autoSwapEnabled || !nftHolder || !walletAddress) return;

    const swapDust = async () => {
      setSwapStatus('swapping');
      try {
        await executeAutoSwap(walletAddress);
        setSwapStatus('done');
        refresh();
      } catch {
        setSwapStatus('error');
      }
    };
    swapDust();
  }, [autoSwapEnabled, nftHolder, walletAddress, refresh]);

  const handleManualSwap = async () => {
  if (dustTokens.length === 0 || !walletAddress) return;
    setSwapStatus('swapping');
    try {
      await executeManualSwap(walletAddress);
      setSwapStatus('done');
      refresh();
    } catch {
      setSwapStatus('error');
    }
  };

  return ( 
    <div className="recovery-page">
  <div>Recovery Page Loaded. Tokens: {tokens.length}</div>;
      {/* ── HEADER CARDS ───── */}
      <div className="recovery-header grid grid-cols-1 md:grid-cols-2 gap-4">
    <WalletHealthCard tokens={tokens} /> 
       <DustSummary/>
      </div> 
      */

      {/* NFT Auto-Swap Toggle */}
      {nftHolder && (
        <div className="auto-swap-toggle my-4">
          <button
            className={`btn-auto-swap ${autoSwapEnabled ? 'on' : 'off'}`}
            onClick={() => setAutoSwapEnabled(prev => !prev)}
          >
            {autoSwapEnabled ? 'Auto-Swap ON' : 'Auto-Swap OFF'}{' '}
            {swapStatus === 'swapping' && ' ⏳'}
            {swapStatus === 'done' && ' ✓'}
            {swapStatus === 'error' && ' ⚠️'}
          </button>
        </div>
      )}

      {/* Manual Swap */}
      {dustTokens.length > 0 && (
        <div className="manual-swap my-2">
          <button
            className="btn-manual-swap"
            onClick={handleManualSwap}
            disabled={swapStatus === 'swapping'}
          >
            Swap Dust Tokens
          </button>
        </div>
      )}

      {/* ── TOKEN LIST ────── */}
      <div className="recovery-tokenlist my-6">
        <TokenList
          selectable
         selectedIds={Array.from(selected)}
         onSelect={(id: string) => toggle(id)}
        />
      </div>

      {/* ── BATCH BURN ─────── */}
      {batchTokens.length > 0 && (
        <div className="recovery-batchburn mt-4">
        <BatchBurnButton 
            tokens={batchTokens}
            onProgress={handleBatchProgress}
            onComplete={() => {
              refresh();
              setSelected(new Set());
            }}
          />
        </div>
      )}

      {/* ── LIVE BURN PROGRESS ───── */}
      {burningToken && (
        <div className="burn-progress my-2 p-2 bg-yellow-50 rounded border border-yellow-200 text-yellow-800">
          Burning <strong>{burningToken}</strong>…
        </div>
      )}

      {/* ── BATCH LOG ─────── */}
      {burnLog.length > 0 && (
        <div className="burn-log mt-4 p-2 bg-gray-50 rounded border border-gray-200 text-gray-700 max-h-48 overflow-y-auto font-mono text-sm">
          {burnLog.map((line, idx) => <div key={idx}>{line}</div>)}
        </div>
      )}

      <style>{`
        .btn-auto-swap { padding: 10px 16px; border-radius: var(--radius-pill); font-weight: 600; background: var(--blue-dim); color: var(--blue); cursor: pointer; }
        .btn-auto-swap.off { background: #eee; color: #666; }
        .btn-manual-swap { padding: 10px 16px; border-radius: var(--radius-pill); font-weight: 600; background: var(--purple-dim); color: var(--purple); cursor: pointer; }
        .btn-manual-swap:disabled { opacity: 0.5; cursor: not-allowed; }
        .burn-progress { animation: pulse 1s infinite alternate; }
        @keyframes pulse { 0% { opacity:0.8; } 100% { opacity:1; } }
      `}</style>
    </div>
  );
}
