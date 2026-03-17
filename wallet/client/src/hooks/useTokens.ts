import { useState, useEffect, useMemo, useCallback } from "react";
import apiClient from "../services/apiClient";

export interface TokenType {
  id: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  balance: string;
  usdValue: number;
  isSpam: boolean;
  chainId: number;
  isZero?: boolean;
  [key: string]: any;
}

export const useTokens = (walletAddress?: string) => {
  const [tokens, setTokens] = useState<TokenType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/wallet/${walletAddress}/tokens`);

      // SAFETY: ensure array
      const data = Array.isArray(response?.data) ? response.data : [];

      const fetchedTokens: TokenType[] = data.map((t: any) => {
        const balanceNum = Number(t.balance);
        const usd = Number(t.usdValue);

        return {
          id: t.id || t.tokenAddress || Math.random().toString(),
          tokenAddress: t.tokenAddress || "",
          symbol: t.symbol || "UNK",
          name: t.name || "Unknown",
          balance: t.balance || "0",
          usdValue: isNaN(usd) ? 0 : usd,
          isSpam: Boolean(t.isSpam),
          chainId: t.chainId || 1,
          isZero: isNaN(balanceNum) ? true : balanceNum <= 0,
          ...t,
        };
      });

      setTokens(fetchedTokens);
    } catch (err: any) {
      console.error("Failed to fetch tokens:", err);
      setError(err?.message || "Failed to fetch tokens");
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // SAFE DERIVED DATA

  const spamTokens = useMemo(
    () => tokens.filter(t => t?.isSpam),
    [tokens]
  );

  const dustTokens = useMemo(
    () =>
      tokens.filter(t => {
        const balance = Number(t.balance);
        return !t.isSpam && !isNaN(balance) && balance > 0;
      }),
    [tokens]
  );

  const zeroTokens = useMemo(
    () => tokens.filter(t => t?.isZero),
    [tokens]
  );

  const totalValue = useMemo(
    () =>
      tokens.reduce((sum, t) => {
        const val = Number(t.usdValue);
        return sum + (isNaN(val) ? 0 : val);
      }, 0),
    [tokens]
  );

  const refresh = () => fetchTokens();

  return {
    tokens,
    spamTokens,
    dustTokens,
    zeroTokens,
    totalValue,
    loading,
    error,
    refresh,
  };
};
