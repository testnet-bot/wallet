import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useAccount, useConfig, usePublicClient, useWalletClient } from "wagmi"
import { 
  erc20Abi, 
  parseEther, 
  type Address, 
  getAddress, 
  getFunctionSelector, 
  type AbiFunction,
  type Hash,
  type Transaction
} from "viem"

 interface WalletTransactionsProps {
    account: string | null;
    }

/* ---------- TYPES & INTERFACES ---------- */
interface Threat {
  id: string
  type: "phishing" | "drainer" | "defi" | "incoming" | "contract"
  address: Address
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  timestamp: number
  rawTx?: Hash
}

/* ---------- ENVIRONMENT & CONFIG ---------- */
const ENV = {
  TREASURY: (import.meta.env.VITE_TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  PHISHING_API: "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json"
}

const REVENUE = {
  MANUAL: 0.025,
  AUTO: 0.0125,
  BASE_UNIT: parseEther("0.0005")
}

/* ---------- SELECTOR ENGINE (dynamic) ---------- */
const createSelector = (fn: Partial<AbiFunction> & { name: string }) =>
  getFunctionSelector({ type: "function", stateMutability: "nonpayable", inputs: [], outputs: [], ...fn } as AbiFunction)

const DEFI_SIGNATURES = {
  APPROVE: "0x095ea7b3",
  SET_APPROVAL_FOR_ALL: "0xa22cb465",
  SWAPS: [
    createSelector({ name: "swapExactTokensForTokens", inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ]}),
    createSelector({ name: "swapExactETHForTokens", inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ]})
  ]
}

/* ---------- RISK ENGINE ---------- */
function calculateRiskScore(events: any[]) {
  let score = 0
  for (const e of events) {
    if (e.type === "phishing") score += 10
    if (e.type === "defi") score += 2
    if (e.type === "contract") score += 1
    if (e.type === "incoming") score -= 1
  }
  return score
}

/* ---------- COMPONENT ---------- */
export default function WalletTransactions({ account }: WalletTransactionsProps) {
  const { address, chain } = useAccount()
  const config = useConfig()

  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [phishingList, setPhishingList] = useState<Set<string>>(new Set())
  const [threats, setThreats] = useState<Threat[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [logs, setLogs] = useState<{ msg: string; type: "info" | "warn" | "danger" }[]>([])

  const userAddr = useMemo(() => address ? getAddress(address) : null, [address])
  const processedTxs = useRef<Set<string>>(new Set())

  const addLog = useCallback((msg: string, type: "info" | "warn" | "danger" = "info") => {
    setLogs(prev => [{ msg, type }, ...prev].slice(0, 8))
  }, [])

  /* ---------- LOAD PHISHING LIST (dynamic) ---------- */
  useEffect(() => {
    const loadRegistry = async () => {
      try {
        const res = await fetch(ENV.PHISHING_API)
        const data = await res.json()
        setPhishingList(new Set(data.blacklist.map((a: string) => a.toLowerCase())))
        addLog("Security registry synchronized", "info")
      } catch {
        addLog("Phishing registry failed to load", "warn")
      }
    }
    loadRegistry()
  }, [addLog])

  /* ---------- ANALYZE TRANSACTION ---------- */
  const analyzeTransaction = useCallback((tx: Transaction): Threat | null => {
    if (!tx.to || !userAddr) return null
    const target = getAddress(tx.to)
    const targetLower = target.toLowerCase()

    if (phishingList.has(targetLower)) {
      return { id: tx.hash, type: "phishing", address: target, severity: "CRITICAL", timestamp: Date.now() }
    }
    if (tx.input.startsWith(DEFI_SIGNATURES.APPROVE) || tx.input.startsWith(DEFI_SIGNATURES.SET_APPROVAL_FOR_ALL)) {
      return { id: tx.hash, type: "drainer", address: target, severity: "HIGH", timestamp: Date.now(), rawTx: tx.hash }
    }
   if (DEFI_SIGNATURES.SWAPS.includes(tx.input.slice(0, 10) as `0x${string}`)) {
      return { id: tx.hash, type: "defi", address: target, severity: "LOW", timestamp: Date.now() }
    }
    return null
  }, [phishingList, userAddr])

  /* ---------- SECURITY SCAN (dynamic & latest) ---------- */
  const runSecurityScan = useCallback(async () => {
    if (!userAddr || !chain) return
    if (!publicClient) return
    setIsScanning(true)

    try {
      const block = await publicClient.getBlock({ blockTag: "latest", includeTransactions: true })
      const currentThreats: Threat[] = []
      for (const tx of (block.transactions as any[])) {
        if (processedTxs.current.has(tx.hash)) continue
        const threat = analyzeTransaction(tx)
        if (threat) currentThreats.push(threat)
        processedTxs.current.add(tx.hash)
      }
      if (currentThreats.length > 0) {
        setThreats(prev => [...currentThreats, ...prev].slice(0, 20))
        addLog(`Alert: ${currentThreats.length} threats detected`, "danger")
      }
    } catch {
      addLog("Deep scan error", "warn")
    } finally {
      setIsScanning(false)
    }
  }, [userAddr, chain, publicClient, analyzeTransaction, addLog])

  /* ---------- REAL‑TIME BLOCK SUBSCRIBER ---------- */
  useEffect(() => {
    if (!userAddr || !chain || !publicClient) return
    const unwatch = publicClient.watchBlocks({ onBlock: () => runSecurityScan() })
    addLog("Sentinel Monitoring Active", "info")
    return () => unwatch()
  }, [userAddr, chain, publicClient, runSecurityScan, addLog])

  /* ---------- EXECUTE DEFENSE (batch revoke + revenue) ---------- */
  const executeDefense = async (targets: Threat[], mode: "MANUAL" | "AUTO") => {
    if (!walletClient || !userAddr || !chain) return
    const rate = mode === "AUTO" ? REVENUE.AUTO : REVENUE.MANUAL
    const fee = (REVENUE.BASE_UNIT * BigInt(Math.floor(rate * 10000))) / 10000n * BigInt(targets.length)

    try {
      addLog(`Simulating protection for ${targets.length} assets...`, "info")

      for (const t of targets) {
        await walletClient.writeContract({
          abi: erc20Abi,
          address: t.address,
          functionName: "approve",
          args: [t.address, 0n]
        })
      }
      await walletClient.sendTransaction({ to: ENV.TREASURY, value: fee })

      addLog("Defense Executed Successfully", "info")
      setThreats(prev => prev.filter(p => !targets.find(t => t.id === p.id)))
    } catch (err: any) {
      addLog(`Defense Failed: ${err?.shortMessage || "rejected or gas error"}`, "warn")
    }
  }

  /* ---------- RENDER UI ---------- */
  return (
    <div className="relative overflow-hidden bg-zinc-950 text‑zinc‑100 p‑8 rounded‑[2rem] border border‑zinc‑800 shadow‑2xl transition‑all font‑sans">
      <div className={`absolute ‑top‑10 ‑right‑10 w‑64 h‑64 blur‑[120px] rounded‑full opacity‑20 ${threats.length > 0 ? 'bg‑red‑500' : 'bg‑emerald‑400'}`} />

      <header className="flex justify‑between items‑start mb‑10">
        <div>
          <h2 className="text‑2xl font‑black uppercase">Sentinel.PRO</h2>
        </div>
        <button onClick={runSecurityScan} className={`p‑3 rounded‑2xl border border‑zinc‑800 ${isScanning ? 'animate‑spin' : ''}`}>🔄</button>
      </header>

      <main className="space‑y‑4 min‑h‑[300px]">
        {threats.length > 0 ? threats.map(t => (
          <div key={t.id} className="group flex justify‑between items‑center p‑5 bg‑zinc‑900/40 rounded‑2xl border border‑zinc‑800">
            <div>
              <p className="text‑sm font‑bold">{t.address.slice(0,8)}…{t.address.slice(-6)}</p>
              <p className="text‑[10px] uppercase origin"> {t.type} detected</p>
            </div>
            <button onClick={() => executeDefense([t], "MANUAL")} className="px‑3 py‑1 bg‑red‑600 text‑white rounded‑xl">REVOKE</button>
          </div>
        )) : (
          <div className="flex justify‑center py‑20 text‑sm text‑zinc‑400">
            Scanning mempool for threats…
          </div>
        )}
      </main>

      <footer className="mt‑8 space‑y‑4 text‑xs font‑mono text‑zinc‑500">
        {threats.length > 0 && (
          <button onClick={() => executeDefense(threats, "AUTO")} className="w‑full py‑3 bg‑white text‑black rounded‑xl">
            Batch Revoke & Protect ({(REVENUE.AUTO*100).toFixed(2)}% fee)
          </button>
        )}
        {logs.map((l, i) => (
          <div key={i} className={`${l.type === 'danger' ? 'text‑red‑400' : l.type === 'warn' ? 'text‑yellow‑400' : 'text‑zinc‑400'}`}>
            {`> ${l.msg}`}
          </div>
        ))}
      </footer>
    </div>
  )
}
