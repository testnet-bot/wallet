import { useState } from 'react'
import '../../styles/components.css'

type Schedule = 'every_block' | 'hourly' | 'daily' | 'weekly'

interface AutoRecoveryConfig {
enabled: boolean
schedule: Schedule
minDustUsd: number
targetToken: string
autoCompound: boolean
}

interface AutoRecoveryStats {
totalRecoveredUsd: number
lastRunAt: string | null
runCount: number
nextRunAt: string | null
}

interface AutoRecoveryToggleProps {
defaultConfig?: Partial<AutoRecoveryConfig>
stats?: AutoRecoveryStats
onChange?: (config: AutoRecoveryConfig) => void
}

const SCHEDULES: { id: Schedule; label: string; desc: string }[] = [
{id: 'every_block', label: 'Every Block', desc: '~12s'},
{id: 'hourly', label: 'Hourly', desc: '1h'},
{id: 'daily', label: 'Daily', desc: '24h'},
{id: 'weekly', label: 'Weekly', desc: '7d'}
]

const MIN_DUST_OPTIONS = [0.1, 0.50, 1.00, 5.00]
const TARGET_TOKENS = ['ETH', 'USDC', 'USDT', 'WBTC']

const DEFAULT_CONFIG: AutoRecoveryConfig = {
enabled: true,
schedule: 'hourly',
minDustUsd: 0.10,
targetToken: 'ETH',
autoCompound: false
}

const DEFAULT_STATS: AutoRecoveryStats = {
totalRecoveredUsd: 847.20,
lastRunAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
runCount: 142,
nextRunAt: new Date(Date.now() + 1000 * 60 * 13).toISOString()
}

function formatRelativeTime(iso: string | null): string {
if (!iso) return '—'
const diff = Date.now() - new Date(iso).getTime()
const mins = Math.floor(diff / 60000)
if (mins < 1) return 'just now'
if (mins < 60) return `${mins}m ago`
const hrs = Math.floor(mins / 60)
if (hrs < 24) return `${hrs}h ago`
return `${Math.floor(hrs / 24)}d ago`
}

function formatNextRun(iso: string | null): string {
if (!iso) return '—'
const diff = new Date(iso).getTime() - Date.now()
const mins = Math.floor(diff / 60000)
if (mins <= 0) return 'now'
if (mins < 60) return `in ${mins}m`
return `in ${Math.floor(mins / 60)}h`
}

export default function AutoRecoveryToggle({
defaultConfig = {},
stats = DEFAULT_STATS,
onChange
}: AutoRecoveryToggleProps) {

const [enabled, setEnabled] = useState<boolean>(DEFAULT_CONFIG.enabled)
const [schedule, setSchedule] = useState<Schedule>(DEFAULT_CONFIG.schedule)
const [minDustUsd, setMinDustUsd] = useState<number>(DEFAULT_CONFIG.minDustUsd)
const [targetToken, setTargetToken] = useState<string>(DEFAULT_CONFIG.targetToken)
const [autoCompound, setAutoCompound] = useState<boolean>(DEFAULT_CONFIG.autoCompound)

const [expanded, setExpanded] = useState(false)

const toggleEnabled = () => Date({ enabled: !enabled })

return (
<div className={`art-wrapper ${enabled ? 'art--on' : 'art--off'}`}>
<div className="art-top-row">
<div className="art-icon-wrap">
<span className="art-icon">◈</span>
{enabled && <div className="art-icon-pulse" />}
</div>
<div className="art-title-block">
<span className="art-title">Auto Dust Recovery</span>
<span className={`art-status ${enabled ? 'art-status--on' : 'art-status--off'}`}>
      {enabled
       ? `Running ${SCHEDULES.find(s => s.id === schedule)?.label.toLowerCase()}`
      : 'Paused click to enable'}
       </span>
</div>
<button
className={`toggle-track ${enabled ? 'on' : ''}`}
onClick={toggleEnabled}
aria-label={enabled ? 'Disable auto recovery' : 'Enable auto recovery'}
style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
>
<div className="toggle-thumb" />
</button>
</div>

{enabled && (
<div className="art-stats-row">
<div className="art-stat">
<span className="art-stat-val mono-value pnl-positive">
${stats.totalRecoveredUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
</span>
<span className="art-stat-label">recovered total</span>
</div>
<div className="art-stat-divider" />
<div className="art-stat">
<span className="art-stat-val mono-value">{stats.runCount}</span>
<span className="art-stat-label">runs</span>
</div>
<div className="art-stat-divider" />
<div className="art-stat">
<span className="art-stat-val mono-value">{formatRelativeTime(stats.lastRunAt)}</span>
<span className="art-stat-label">last run</span>
</div>
<div className="art-stat-divider" />
<div className="art-stat">
<span className="art-stat-val mono-value" style={{ color: 'var(--accent)' }}>
{formatNextRun(stats.nextRunAt)}
</span>
<span className="art-stat-label">next run</span>
</div>
</div>
)}

<button
className="art-expand-btn"
onClick={() => setExpanded(v => !v)}
aria-expanded={expanded}
>
<span>Configure</span>
<span className={`art-chevron ${expanded ? 'art-chevron--open' : ''}`}>›</span>
</button>

{expanded && (
<div className="art-config animate-slide-down">
<div className="art-config-row">
<div className="art-config-label-block">
<span className="art-config-label">Schedule</span>
<span className="art-config-desc">How often to scan and recover dust</span>
</div>
 <div className="art-chip-group">
 {SCHEDULES.map(s => (
    <button
    key={s.id}
    className={`art-chip ${schedule === s.id ? 'art-chip--active' : ''}`}
    onClick={() => setSchedule(s.id)}
    disabled={!enabled}
    >
    {s.label}
    </button>
    ))}
    </div>
</div>

<div className="art-config-row">
<div className="art-config-label-block">
<span className="art-config-label">Min Dust Value</span>
<span className="art-config-desc">Only recover tokens worth at least this much</span>
</div>
<div className="art-chip-group">
{MIN_DUST_OPTIONS.map(val => (
    <button
    key={val}
    className={`art-chip ${minDustUsd === val ? 'art-chip--active' : ''}`}
    onClick={() => setMinDustUsd(val)}
    disabled={!enabled}
    >
    ${val.toFixed(2)}
    </button>
    ))}
</div>
</div>

<div className="art-config-row">
<div className="art-config-label-block">
<span className="art-config-label">Consolidate Into</span>
<span className="art-config-desc">Recovered dust is swapped to this token</span>
</div>
<div className="art-chip-group">
{TARGET_TOKENS.map(tok => (
    <button
    key={tok}
    className={`art-chip art-chip--mono ${targetToken === tok ? 'art-chip--active' : ''}`}
    onClick={() => setTargetToken(tok)}
    disabled={!enabled}
    >
    {tok}
    </button>
    ))}
</div>
</div>

<div className="art-config-row">
<div className="art-config-label-block">
<span className="art-config-label">Auto-Compound</span>
<span className="art-config-desc">Re-stake recovered value immediately after recovery</span>
</div>
<button
className={`toggle-track ${autoCompound ? 'on' : ''}`}
onClick={() => update({ autoCompound: !autoCompound })}
disabled={!enabled}
style={{ border: 'none', cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.4 }}
>
<div className="toggle-thumb" />
</button>
</div>
</div>
)}
</div>
)
}
