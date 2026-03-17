import { useState } from 'react';
import '../../styles/landing.css'; 

// ─── TYPES ────────────────────────────────────────────────────────────
type TabId =
  | 'wallet'
  | 'thresholds'
  | 'chains'
  | 'notifications'
  | 'fees'
  | 'nft'
  | 'api'
  | 'danger';

interface Chain {
  id:       string;
  name:     string;
  rpc:      string;
  on:       boolean;
  txCount:  number;
  tvl:      string;
}

// ─── STATIC DATA ──────────────────────────────────────────────────────
const TABS: {
  id: TabId; icon: string; label: string;
  desc: string; badge?: string; danger?: boolean;
}[] = [
  { id: 'wallet',        icon: '◉', label: 'Wallet',        desc: 'Connection & addresses'     },
  { id: 'thresholds',    icon: '◈', label: 'Thresholds',    desc: 'Dust & spam sensitivity'    },
  { id: 'chains',        icon: '⬡', label: 'Chains',        desc: 'Active networks'            },
  { id: 'notifications', icon: '🔔', label: 'Notifications', desc: 'Alerts & webhooks', badge: '3' },
  { id: 'fees',          icon: '⟁', label: 'Fees',          desc: 'Revenue & gas config'       },
  { id: 'nft',           icon: '◆', label: 'NFT Pass',      desc: 'Subscription & perks'       },
  { id: 'api',           icon: '⟳', label: 'API',           desc: 'Keys & integrations'        },
  { id: 'danger',        icon: '⚠', label: 'Danger Zone',   desc: 'Reset & delete', danger: true },
];

const CHAINS_DATA: Chain[] = [
  { id: 'eth',      name: 'Ethereum', rpc: 'Mainnet',      on: true,  txCount: 42, tvl: '$32.4K' },
  { id: 'polygon',  name: 'Polygon',  rpc: 'PoS Mainnet',  on: true,  txCount: 18, tvl: '$8.2K'  },
  { id: 'arbitrum', name: 'Arbitrum', rpc: 'One',          on: true,  txCount: 12, tvl: '$4.1K'  },
  { id: 'base',     name: 'Base',     rpc: 'Coinbase L2',  on: true,  txCount: 9,  tvl: '$2.8K'  },
  { id: 'optimism', name: 'Optimism', rpc: 'OP Mainnet',   on: false, txCount: 0,  tvl: '—'      },
  { id: 'solana',   name: 'Solana',   rpc: 'Mainnet Beta', on: false, txCount: 0,  tvl: '—'      },
];

const NFT_PERKS = [
  { icon: '∞',  text: 'Unlimited automation rules'        },
  { icon: '🔥', text: 'Batch burn — zero protocol fees'   },
  { icon: '⚡', text: 'Priority gas queue'                },
  { icon: '📊', text: 'Advanced analytics dashboard'      },
  { icon: '🔑', text: 'Full API access — no rate limit'   },
  { icon: '◈',  text: 'Early access to new features'      },
];

const API_CODE = `const wip = new WIPClient({
  apiKey: process.env.WIP_API_KEY,
});

// Get wallet summary
const summary = await wip.wallet
  .getSummary('0x1a2b…');

// Recover dust
await wip.recovery
  .recoverDust(address);

// Stream live logs
wip.automation
  .subscribe(address, onLog);`;

// ─── ROOT ──────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('wallet');

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <p className="settings-eyebrow">Configuration</p>
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-layout">

        {/* Side nav */}
        <nav className="settings-nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={[
                'settings-nav-item',
                tab === t.id  ? 'settings-nav-item--active' : '',
                t.danger      ? 'settings-nav-item--danger' : '',
              ].join(' ')}
              onClick={() => setTab(t.id)}
            >
              <span className="settings-nav-icon">{t.icon}</span>
              <span className="settings-nav-text">
                <span className="settings-nav-label">{t.label}</span>
                <span className="settings-nav-desc">{t.desc}</span>
              </span>
              {t.badge && (
                <span className="settings-nav-badge">{t.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Panel content */}
        <div className="settings-content">
          {tab === 'wallet'        && <WalletPanel />}
          {tab === 'thresholds'    && <ThresholdsPanel />}
          {tab === 'chains'        && <ChainsPanel />}
          {tab === 'notifications' && <NotificationsPanel />}
          {tab === 'fees'          && <FeesPanel />}
          {tab === 'nft'           && <NFTPassPanel />}
          {tab === 'api'           && <APIPanel />}
          {tab === 'danger'        && <DangerPanel />}
        </div>

      </div>
    </div>
  );
}

// ─── WALLET ────────────────────────────────────────────────────────────
function WalletPanel() {
  const [watchOnly,   setWatchOnly]   = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currency,    setCurrency]    = useState('USD');

  return (
    <Panel title="Wallet Configuration" desc="Manage connected wallets and access modes">
      <Row label="Primary Wallet" desc="Connected via MetaMask">
        <div className="wallet-address-chip">
          <div className="pulse-dot" />
          <span className="wallet-address-text">0x1a2b3c…7a8b</span>
          <Btn variant="ghost" size="sm">Disconnect</Btn>
        </div>
      </Row>

      <Row label="Watch-Only Mode" desc="Monitor portfolio without signing transactions">
        <Toggle on={watchOnly} onChange={setWatchOnly} />
      </Row>

      <Row label="Additional Wallets" desc="Track up to 5 wallets simultaneously">
        <Btn variant="ghost" size="sm">+ Add Wallet</Btn>
      </Row>

      <Row label="Auto-Refresh" desc="Sync portfolio data in the background every 30s">
        <Toggle on={autoRefresh} onChange={setAutoRefresh} />
      </Row>

      <Row label="Display Currency" desc="Show all portfolio values in">
        <select
          className="settings-select"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
        >
          <option>USD</option>
          <option>EUR</option>
          <option>GBP</option>
          <option>ETH</option>
          <option>BTC</option>
        </select>
      </Row>

      <Row label="Connected Since" desc="Wallet first linked to WIP">
        <span className="api-key-text">Jan 12, 2025</span>
      </Row>
    </Panel>
  );
}

// ─── THRESHOLDS ────────────────────────────────────────────────────────
function ThresholdsPanel() {
  const [dust,       setDust]       = useState('0.10');
  const [spamConf,   setSpamConf]   = useState(85);
  const [scoreAlert, setScoreAlert] = useState(80);
  const [batchMin,   setBatchMin]   = useState('3');
  const [zeroTol,    setZeroTol]    = useState('30 days');

  return (
    <Panel title="Thresholds & Sensitivity" desc="Fine-tune when WIP triggers automation on your wallet">
      <Row label="Dust Threshold" desc="Tokens below this USD value are classified as recoverable dust">
        <ChipGroup
          options={['0.001', '0.01', '0.10', '1.00']}
          value={dust}
          onChange={setDust}
          prefix="$"
        />
      </Row>

      <Row label="Spam Confidence" desc="ML confidence required before flagging a token as spam">
        <div className="slider-group">
          <input
            type="range" min={50} max={99} step={1}
            value={spamConf}
            onChange={e => setSpamConf(Number(e.target.value))}
            className="settings-slider"
          />
          <span className="slider-value">{spamConf}%</span>
        </div>
      </Row>

      <Row label="Health Score Alert" desc="Alert when wallet health score drops below this value">
        <div className="slider-group">
          <input
            type="range" min={50} max={95} step={5}
            value={scoreAlert}
            onChange={e => setScoreAlert(Number(e.target.value))}
            className="settings-slider"
          />
          <span className="slider-value">{scoreAlert}</span>
        </div>
      </Row>

      <Row label="Minimum Batch Size" desc="Don't trigger batch operations until at least N tokens qualify">
        <ChipGroup
          options={['1', '3', '5', '10']}
          value={batchMin}
          onChange={setBatchMin}
        />
      </Row>

      <Row label="Zero-Value Sweep After" desc="Auto-sweep tokens with zero activity after this period">
        <select
          className="settings-select"
          value={zeroTol}
          onChange={e => setZeroTol(e.target.value)}
        >
          <option>7 days</option>
          <option>30 days</option>
          <option>90 days</option>
          <option>Never</option>
        </select>
      </Row>
    </Panel>
  );
}

// ─── CHAINS ────────────────────────────────────────────────────────────
function ChainsPanel() {
  const [chains, setChains] = useState(CHAINS_DATA);

  const toggle = (id: string) =>
    setChains(cs => cs.map(c => c.id === id ? { ...c, on: !c.on } : c));

  return (
    <Panel title="Active Chains" desc="Enable chains to include in portfolio scanning and automation">
      <div className="chains-list">
        {chains.map(c => (
          <div key={c.id} className="chain-row">
            <span className={`chain-badge chain-badge--${c.id}`}>
              <span className="chain-dot" />
              {c.name}
            </span>

            <span className="chain-rpc">{c.rpc}</span>

            {c.on ? (
              <div className="chain-stats">
                <div className="chain-stat">
                  <span className="chain-stat-value">{c.txCount}</span>
                  <span className="chain-stat-label">txns</span>
                </div>
                <div className="chain-stat">
                  <span className="chain-stat-value chain-stat-value--positive">{c.tvl}</span>
                  <span className="chain-stat-label">TVL</span>
                </div>
              </div>
            ) : (
              <span className="chain-inactive-label">Inactive</span>
            )}

            <Toggle on={c.on} onChange={() => toggle(c.id)} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────
function NotificationsPanel() {
  const [events, setEvents] = useState({
    spamDetected:  true,
    dustAvailable: true,
    scoreDropped:  true,
    burnCompleted: false,
    weeklyReport:  true,
    recoveryReady: true,
  });
  const [email,   setEmail]   = useState('');
  const [webhook, setWebhook] = useState('');

  const toggle = (k: keyof typeof events) =>
    setEvents(p => ({ ...p, [k]: !p[k] }));

  const EVENT_ROWS: { key: keyof typeof events; label: string; desc: string }[] = [
    { key: 'spamDetected',  label: 'Spam Detected',  desc: 'Alert when new unsolicited tokens arrive'       },
    { key: 'dustAvailable', label: 'Dust Available',  desc: 'Alert when recoverable dust exceeds threshold'  },
    { key: 'scoreDropped',  label: 'Score Dropped',   desc: 'Alert when health score falls below your limit' },
    { key: 'burnCompleted', label: 'Burn Completed',  desc: 'Notify after each batch burn transaction'       },
    { key: 'weeklyReport',  label: 'Weekly Report',   desc: 'Summary of all actions and recovered value'     },
    { key: 'recoveryReady', label: 'Recovery Ready',  desc: 'Alert when enough dust accumulates to recover'  },
  ];

  return (
    <Panel title="Notifications" desc="Choose which events trigger alerts and how they are delivered">
      {EVENT_ROWS.map(r => (
        <Row key={r.key} label={r.label} desc={r.desc}>
          <Toggle on={events[r.key]} onChange={() => toggle(r.key)} />
        </Row>
      ))}

      <div className="settings-section-divider">Delivery Channels</div>

      <Row label="Email" desc="Receive alerts at this address">
        <input
          className="settings-input settings-input--wide"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </Row>

      <Row label="Webhook" desc="POST event payloads to your endpoint">
        <input
          className="settings-input settings-input--wide"
          type="url"
          placeholder="https://your-app.com/webhook"
          value={webhook}
          onChange={e => setWebhook(e.target.value)}
        />
      </Row>

      <Row label="Telegram Bot" desc="Receive instant alerts via Telegram">
        <Btn variant="ghost" size="sm">Connect Bot</Btn>
      </Row>
    </Panel>
  );
}
// ─── FEES ──────────────────────────────────────────────────────────────
function FeesPanel() {
  const [feeRate, setFeeRate] = useState('1%');
  const [gasMode, setGasMode] = useState('Standard');
  const [maxGwei, setMaxGwei] = useState('50');

  return (
    <Panel title="Fee Management" desc="Protocol revenue configuration and gas settings">
      <div className="fees-stats-strip">
        <div className="fee-stat-card">
          <span className="fee-stat-value fee-stat-value--positive">$142.80</span>
          <span className="fee-stat-label">Total Fees Earned</span>
        </div>
        <div className="fee-stat-card">
          <span className="fee-stat-value fee-stat-value--negative">$18.40</span>
          <span className="fee-stat-label">Gas Spent</span>
        </div>
        <div className="fee-stat-card">
          <span className="fee-stat-value fee-stat-value--accent">$124.40</span>
          <span className="fee-stat-label">Net Revenue</span>
        </div>
      </div>

      <Row label="Protocol Fee" desc="Fee charged per recovery operation (waived with NFT Pass)">
        <ChipGroup
          options={['0%', '0.5%', '1%', '2%']}
          value={feeRate}
          onChange={setFeeRate}
        />
      </Row>

      <Row label="Gas Strategy" desc="Speed vs. cost priority for all transactions">
        <select
          className="settings-select"
          value={gasMode}
          onChange={e => setGasMode(e.target.value)}
        >
          <option>Economic (slow)</option>
          <option>Standard</option>
          <option>Fast</option>
          <option>Instant (max fee)</option>
        </select>
      </Row>

      <Row label="Max Gas Price" desc="Cap gas price to avoid high-fee periods">
        <div className="slider-group">
          <input
            className="settings-input settings-input--short"
            value={maxGwei}
            onChange={e => setMaxGwei(e.target.value)}
          />
          <span className="unit-suffix">Gwei</span>
        </div>
      </Row>

      <Row label="Revenue Address" desc="Protocol fees are forwarded to this wallet">
        <div className="wallet-address-chip">
          <span className="wallet-address-text">0x1a2b…7a8b</span>
          <Btn variant="ghost" size="sm">Change</Btn>
        </div>
      </Row>
    </Panel>
  );
}

// ─── NFT PASS ──────────────────────────────────────────────────────────
function NFTPassPanel() {
  return (
    <Panel title="NFT Pass" desc="Your protocol subscription and exclusive tier perks">
      <div className="nft-pass-layout">

        {/* Pass visual card */}
        <div className="nft-pass-card">
          <div className="nft-pass-glow-1" />
          <div className="nft-pass-glow-2" />
          <span className="nft-pass-eyebrow">WIP Protocol Pass</span>
          <span className="nft-pass-tier">Diamond</span>
          <span className="nft-pass-id">#0042</span>
          <div className="nft-pass-perks">
            {NFT_PERKS.map(p => (
              <div key={p.text} className="nft-perk-row">
                <span className="nft-perk-icon">{p.icon}</span>
                <span className="nft-perk-text">{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info column */}
        <div className="nft-pass-info">
          <div className="nft-info-row">
            <div>
              <div className="nft-info-label">Token ID</div>
              <div className="nft-info-sub">Your NFT identifier</div>
            </div>
            <span className="nft-info-value">#0042</span>
          </div>

          <div className="nft-info-row">
            <div>
              <div className="nft-info-label">Tier</div>
              <div className="nft-info-sub">Current level</div>
            </div>
            <span className="tier-badge">Diamond</span>
          </div>

          <div className="nft-info-row">
            <div>
              <div className="nft-info-label">Minted</div>
              <div className="nft-info-sub">Date acquired</div>
            </div>
            <span className="nft-info-value">Jan 12, 2025</span>
          </div>

          <div className="nft-info-row">
            <div>
              <div className="nft-info-label">Marketplace</div>
              <div className="nft-info-sub">View or list your pass</div>
            </div>
            <Btn variant="ghost" size="sm">OpenSea →</Btn>
          </div>

          <div className="nft-info-row">
            <div>
              <div className="nft-info-label">Transfer</div>
              <div className="nft-info-sub">Move pass to another wallet</div>
            </div>
            <Btn variant="ghost" size="sm">Transfer</Btn>
          </div>

          <div className="nft-upgrade-box">
            <p className="nft-upgrade-text">
              Upgrade to <strong>Master</strong> tier for multi-chain atomic
              burns, dedicated RPC endpoints, and 0% protocol fees.
            </p>
            <Btn variant="primary" size="sm">Upgrade Tier →</Btn>
          </div>
        </div>

      </div>
    </Panel>
  );
}

// ─── API ───────────────────────────────────────────────────────────────
function APIPanel() {
  const [revealed, setRevealed] = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [webhook,  setWebhook]  = useState('');

  const copyKey = async () => {
    await navigator.clipboard.writeText('wip_live_sk_a1b2c3d4e5f6g7h8i9j0').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Panel title="API Access" desc="Integrate WIP data and automation into your own applications">
      <Row label="API Key" desc="Pass as Authorization: Bearer <key>">
        <div className="api-key-row">
          <span className="api-key-text">
            {revealed
              ? 'wip_live_sk_a1b2c3d4e5f6g7h8i9j0'
              : 'wip_live_sk_••••••••••••••••••••'}
          </span>
          <Btn variant="ghost" size="sm" onClick={() => setRevealed(v => !v)}>
            {revealed ? 'Hide' : 'Reveal'}
          </Btn>
          <Btn
            variant={copied ? 'success' : 'ghost'}
            size="sm"
            onClick={copyKey}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </Btn>
        </div>
      </Row>

      <Row label="Rate Limit" desc="Requests allowed per hour on your current plan">
        <div className="rate-limit-block">
          <span className="rate-limit-value">
            1,000 <span className="unit-suffix">/ hour</span>
          </span>
          <div className="rate-limit-bar-track">
            <div className="rate-limit-bar-fill" style={{ width: '34%' }} />
          </div>
          <span className="rate-limit-sub">340 used this hour</span>
        </div>
      </Row>

      <Row label="Webhook Secret" desc="Verify incoming webhook HMAC signatures">
        <div className="api-key-row">
          <span className="api-key-text">whsec_••••••••••••••</span>
          <Btn variant="ghost" size="sm">Rotate</Btn>
        </div>
      </Row>

      <Row label="Webhook URL" desc="Receive real-time automation events via POST">
        <input
          className="settings-input settings-input--wide"
          type="url"
          placeholder="https://your-app.com/hook"
          value={webhook}
          onChange={e => setWebhook(e.target.value)}
        />
      </Row>

      <Row label="Documentation" desc="Full REST reference, SDKs and examples">
        <Btn variant="ghost" size="sm">View Docs →</Btn>
      </Row>

      <div className="code-preview-wrap">
        <div className="code-preview-header">
          <span className="code-preview-title">Quick Start</span>
          <span className="code-preview-lang">Node.js</span>
        </div>
        <pre className="code-preview-block">{API_CODE}</pre>
      </div>
    </Panel>
  );
}

// ─── DANGER ────────────────────────────────────────────────────────────
function DangerPanel() {
  const [modal,    setModal]    = useState<null | 'reset' | 'delete'>(null);
  const [inputVal, setInputVal] = useState('');

  const ACTIONS = [
    {
      id: 'history',
      label: 'Clear Automation History',
      desc: 'Delete all automation logs and activity records. Rules are preserved.',
      destructive: false,
      onClick: () => {},
    },
    {
      id: 'rules',
      label: 'Reset All Rules',
      desc: 'Delete all custom automation rules and restore factory defaults.',
      destructive: false,
      onClick: () => setModal('reset'),
    },
    {
      id: 'revoke',
      label: 'Revoke API Key',
      desc: 'Immediately invalidates your API key. A new key is auto-generated.',
      destructive: false,
      onClick: () => {},
    },
    {
      id: 'delete',
      label: 'Delete Account',
      desc: 'Permanently delete all WIP data for this wallet. Cannot be undone.',
      destructive: true,
      onClick: () => setModal('delete'),
    },
  ];

  return (
    <Panel title="Danger Zone" desc="Irreversible actions — proceed with care">
      <div className="danger-list">
        {ACTIONS.map(a => (
          <div
            key={a.id}
            className={`danger-row ${a.destructive ? 'danger-row--destructive' : ''}`}
          >
            <div className="danger-row-info">
              <span className={`danger-row-label ${a.destructive ? 'danger-row-label--red' : ''}`}>
                {a.label}
              </span>
              <span className="danger-row-desc">{a.desc}</span>
            </div>
            <button
              className={a.destructive ? 'btn-danger-hard' : 'btn-danger-soft'}
              onClick={a.onClick}
            >
              {a.label.split(' ').slice(0, 2).join(' ')}
            </button>
          </div>
        ))}
      </div>

      {modal === 'reset' && (
        <ConfirmModal
          title="Reset All Rules?"
          desc="This deletes all custom automation rules and restores WIP defaults. Cannot be undone."
          confirmLabel="Reset Rules"
          onConfirm={() => setModal(null)}
          onCancel={() => setModal(null)}
        />
      )}

      {modal === 'delete' && (
        <ConfirmModal
          title="Delete Account?"
          desc='All WIP data for this wallet will be permanently removed. Type DELETE to confirm.'
          confirmLabel="Delete Account"
          confirmWord="DELETE"
          inputVal={inputVal}
          onInputChange={setInputVal}
          onConfirm={() => { setModal(null); setInputVal(''); }}
          onCancel={() => { setModal(null); setInputVal(''); }}
          destructive
        />
      )}
    </Panel>
  );
}


// ─── SHARED PRIMITIVES ─────────────────────────────────────────────────

function Panel({ title, desc, children }: {
  title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h2 className="settings-panel-title">{title}</h2>
        <p className="settings-panel-desc">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Row({ label, desc, children }: {
  label: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-info">
        <span className="setting-row-label">{label}</span>
        {desc && <span className="setting-row-desc">{desc}</span>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, disabled = false }: {
  on: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div
      className={[
        'toggle-wrap',
        on       ? 'toggle-wrap--on'       : '',
        disabled ? 'toggle-wrap--disabled' : '',
      ].join(' ')}
      onClick={() => !disabled && onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <div className="toggle-thumb" />
    </div>
  );
}

function ChipGroup({ options, value, onChange, prefix = '' }: {
  options: string[]; value: string;
  onChange: (v: string) => void; prefix?: string;
}) {
  return (
    <div className="chip-group">
      {options.map(o => (
        <button
          key={o}
          className={`chip-btn ${value === o ? 'chip-btn--active' : ''}`}
          onClick={() => onChange(o)}
        >
          {prefix}{o}
        </button>
      ))}
    </div>
  );
}

function Btn({ variant = 'ghost', size = 'sm', onClick, children }: {
  variant?: 'primary' | 'ghost' | 'success';
  size?: 'sm' | 'md';
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`btn btn--${variant} btn--${size}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ConfirmModal({ title, desc, confirmLabel, confirmWord, inputVal,
  onInputChange, onConfirm, onCancel, destructive = false }: {
  title: string; desc: string; confirmLabel: string;
  confirmWord?: string; inputVal?: string;
  onInputChange?: (v: string) => void;
  onConfirm: () => void; onCancel: () => void;
  destructive?: boolean;
}) {
  const canConfirm = !confirmWord || inputVal === confirmWord;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-desc">{desc}</p>
        {confirmWord && onInputChange && (
          <input
            className="settings-input"
            style={{ width: '100%' }}
            placeholder={`Type "${confirmWord}" to confirm`}
            value={inputVal}
            onChange={e => onInputChange(e.target.value)}
            autoFocus
          />
        )}
        <div className="modal-actions">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={destructive ? 'btn-danger-hard' : 'btn btn--primary btn--sm'}
            onClick={canConfirm ? onConfirm : undefined}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
