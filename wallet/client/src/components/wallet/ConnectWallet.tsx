import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'

import WalletAddress from './WalletAddress'
import WalletScanner from './WalletScanner'
import WalletStatus from './WalletStatus'
import WalletTransactions from './WalletTransactions'

interface ConnectWalletProps {
    onConnect: (addr: string) => void;
    }


export default function ConnectWallet({ onConnect }: ConnectWalletProps) {
  // 1. Core Wagmi Hooks (v2 Standard)
  const { address, isConnected, chain, status: accountStatus } = useAccount()
  const { connect, connectors, error: connectError, isPending } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  // 2. Session State
  const [stayConnected, setStayConnected] = useState(() => localStorage.getItem('stayConnected') === 'true')
  const [duration, setDuration] = useState(3600)
  const [timeLeft, setTimeLeft] = useState(3600)
  const [signature, setSignature] = useState<string | null>(null)
  const signingRef = useRef(false)

  // 3. Robust Disconnect Handler
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectAsync()
      setSignature(null)
      localStorage.removeItem('walletNonce')
      localStorage.removeItem('lastWallet')
      localStorage.setItem('stayConnected', 'false')
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }, [disconnectAsync])

  /* SESSION TIMER LOGIC */
  useEffect(() => {
    if (!stayConnected || !isConnected) return
    localStorage.setItem('stayConnected', 'true')
    
    setTimeLeft(duration)
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleDisconnect()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [stayConnected, duration, isConnected, handleDisconnect])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return hrs > 0 ? `${hrs}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  /* DYNAMIC SIGNATURE LOGIC */
  const handleSignature = useCallback(async () => {
    if (!address || signature) return
    if (signingRef.current) return
      signingRef.current = true

    const nonce = Math.floor(Math.random() * 1000000).toString()
    localStorage.setItem("walletNonce", nonce)
    const msg = `Wallet Intelligence Login\nTimestamp: ${Date.now()}\nNonce: ${nonce}`

    try {
      const sig = await signMessageAsync({ message: msg })
      setSignature(sig)
    } catch (err) {
      console.error('Signature rejected:', err)
    } finally {
        signingRef.current = false
        }
  }, [address, signature, signMessageAsync])

  /* AUTO-SIGN ON CONNECTION */
  useEffect(() => {
    if (isConnected && address && !signature) {
      handleSignature()
      onConnect(address);
    }
  }, [isConnected, address, signature, handleSignature, onConnect]);
  /* WALLET RECONNECT RECOVERY */
  useEffect(() => {
    const lastWallet = localStorage.getItem("lastWallet")

      if (isConnected && address) {
      localStorage.setItem("lastWallet", address)
            }

  if (!isConnected && lastWallet) {
  console.log("Previous wallet detected:", lastWallet)
           }
  }, [isConnected, address])

  return (
    <div className="connect-wallet-container">
      {/* 4. Dynamic Connector Buttons (Future-Proof: Lists whatever is in wagmiConfig) */}
      {!isConnected && (
        <div className="connector-list">
          {connectors.map((c) => (
           <button
           key={c.id}
           onClick={() => connect({ connector: c })}
           className="btn-connect"
           disabled={isPending}
                   >
          {isPending ? "Connecting..." : `Connect ${c.name}`}
          </button>
          ))}
          {connectError && <p className="error-text">{connectError.message}</p>}
        </div>
      )}

      {/* 5. Connected Dashboard */}
      {isConnected && address && (
        <>
          <div className="wallet-info-card">
            <div className="status-header">
              <span className="pulse-dot" />
              <WalletStatus 
                account={address} 
                chain={chain} 
                connected={isConnected} 
                stayConnected={stayConnected} 
              />
              <button onClick={handleDisconnect} className="btn-disconnect">Log Out</button>
            </div>
            
            <WalletAddress account={address} chain={chain} />
            
            <WalletScanner 
              account={address} 
              chain={chain} 
              connected={isConnected}
              stayConnected={stayConnected}
              onDisconnect={handleDisconnect}
            />
           <WalletTransactions account={address} />
          </div>

          {/* 6. Robust Session Controls */}
          <div className="session-management">
            <label className="toggle-label">
              <input 
                type="checkbox" 
                checked={stayConnected} 
                onChange={e => setStayConnected(e.target.checked)} 
              />
              Enable Persistent Session
            </label>
            
            {stayConnected && (
              <div className="duration-picker">
                <input 
                  type="range" 
                  min={600} 
                  max={86400} 
                  step={600}
                  value={duration} 
                  onChange={e => setDuration(parseInt(e.target.value))} 
                />
                <div className="time-remaining">Expires in: {formatTime(timeLeft)}</div>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        .connect-wallet-container { display: flex; flex-direction: column; gap: 1rem; max-width: 400px; }
        .connector-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .btn-connect { padding: 12px; border-radius: 8px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-weight: bold; }
        .wallet-info-card { padding: 1rem; border: 1px solid #eee; border-radius: 12px; background: #fafafa; }
        .status-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; animation: pulse 2s infinite; }
        .btn-disconnect { padding: 4px 12px; font-size: 12px; color: #ef4444; border: 1px solid #ef4444; background: none; border-radius: 6px; cursor: pointer; }
        .session-management { padding: 1rem; background: #f1f5f9; border-radius: 8px; }
        .error-text { color: #ef4444; font-size: 12px; margin-top: 0.5rem; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
      `}</style>
    </div>
  )
}
