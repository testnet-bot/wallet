import React, { useState } from 'react';
import { recoverDust } from '../../services/walletService';

interface Props {
  walletAddress: string;
  onSuccess?: () => void;
}

export default function RecoverDustButton({ walletAddress, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecover = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await recoverDust(walletAddress);
      if (result.error) throw new Error('Recovery failed');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleRecover} disabled={loading}>
        {loading ? 'Recovering...' : 'Recover Dust'}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
