

 import { useState } from 'react';

// ─── FILE: client/components/actions/BurnTokenButton.tsx ─────────────
// Single-token burn button with loading + success states

interface BurnTokenButtonProps {
  tokenSymbol?: string;
  tokenAddress?: string;
  chainId?: number;
  onSuccess?: () => void;
  disabled?: boolean;
}

export default function BurnTokenButton({
  tokenSymbol = 'Token',
  tokenAddress,
  chainId,
  onSuccess,
  disabled = false,
}: BurnTokenButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleBurn = async () => {
    if (state !== 'idle' || disabled) return;
    setState('loading');

    try {
      // Plug in real burn logic here
      // await burnToken({ tokenAddress, chainId });
      await new Promise(r => setTimeout(r, 1800));
      setState('done');
      onSuccess?.();
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2500);
    }
  };

  const isLoading = state === 'loading';
  const isDone    = state === 'done';
  const isError   = state === 'error';

  return (
    <button
      className={`btn-burn-token ${state}`}
      onClick={handleBurn}
      disabled={disabled || isLoading}
      title={`Burn ${tokenSymbol}`}
    >
      {isLoading && <div className="btn-ring" />}
      {!isLoading && (
        <span className="btn-burn-icon">
          {isDone ? '✓' : isError ? '✕' : '🔥'}
        </span>
      )}
      <span>
        {isLoading
          ? `Burning ${tokenSymbol}…`
          : isDone
          ? 'Burned!'
          : isError
          ? 'Failed — retry'
          : `Burn ${tokenSymbol}`}
      </span>

      <style>{`
        .btn-burn-token {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-sm);
          padding: 10px 20px;
          border-radius: var(--radius-pill);
          border: 1px solid rgba(255, 77, 106, 0.25);
          background: var(--red-dim);
          color: var(--red);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-base);
          white-space: nowrap;
        }

        .btn-burn-token:hover:not(:disabled) {
          background: rgba(255, 77, 106, 0.2);
          box-shadow: 0 0 20px rgba(255, 77, 106, 0.2);
        }

        .btn-burn-token:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .btn-burn-token:active:not(:disabled) {
          transform: scale(0.97);
        }

        .btn-burn-token.done  {
          background: var(--green-dim);
          color: var(--green);
          border-color: rgba(0,232,122,0.25);
        }

        .btn-burn-token.error {
          background: rgba(255,181,71,0.1);
          color: var(--amber);
          border-color: rgba(255,181,71,0.25);
        }

        .btn-ring {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,77,106,0.3);
          border-top-color: var(--red);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        .btn-burn-icon { font-size: 14px; }
      `}</style>
    </button>
  );
}
