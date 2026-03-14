
 import { useState, useRef, useEffect } from 'react';

const FEATURES = [
  {
  id: 'dust',
  icon: '◈',
  title: 'Dust Recovery',
  desc: 'Aggregate micro-balances across every chain and recover them in a single batch transaction.',
  stat: '$847',
  statLabel: 'Avg recovered',
  },
  {
  id: 'spam',
  icon: '⬡',
  title: 'Spam Detection',
  desc: 'ML-powered scanner flags and burns unsolicited tokens with 99.2% accuracy.',
  stat: '99.2%',
  statLabel: 'Accuracy',
  },
  {
  id: 'auto',
  icon: '⟳',
  title: 'Auto Clean',
  desc: 'Set rules once. WIP monitors and cleans your wallet on autopilot, every block.',
  stat: '24/7',
  statLabel: 'Monitoring',
  },
  {
  id: 'pass',
  icon: '◉',
  title: 'NFT Pass',
  desc: 'Hold the Upcoming Pass NFT for unlimited automation, batch burns, and priority processing.',
  stat: '0 fees',
  statLabel: 'For pass holders',
  },
  ];

  const MOCK_LOGS = [
  { time: '14:23:01', type: 'success', label: 'BURNED', msg: '3 spam tokens on Base' },
  { time: '14:22:47', type: 'accent', label: 'RECOVERED', msg: '$12.40 dust → ETH' },
  { time: '14:21:03', type: 'warning', label: 'FLAGGED', msg: 'Suspicious airdrop detected' },
  { time: '14:20:11', type: 'success', label: 'SWEPT', msg: '7 zero-value tokens removed' },
  { time: '14:19:55', type: 'accent', label: 'SCORE', msg: 'Health score: 94 (+2)' },
  ];

  const SCORE_ITEMS = [
  { label: 'Token Quality', pct: 96, color: 'var(--green)' },
  { label: 'Dust Level', pct: 88, color: 'var(--accent)' },
  { label: 'Gas Efficiency', pct: 92, color: 'var(--accent)' },
  { label: 'Spam Index', pct: 99, color: 'var(--green)' },
  ];

  const CHAINS = [
  { id: 'eth', name: 'Ethereum' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'base', name: 'Base' },
  { id: 'optimism', name: 'Optimism' },
  { id: 'solana', name: 'Solana' },
  ];

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
      entries.forEach(entry => {
      if (entry.isIntersecting && entry.target instanceof HTMLElement) {
      const idx = parseInt(entry.target.dataset.index || '0');
      setActiveSection(idx);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

  const sections = container.querySelectorAll<HTMLElement>('.snap-section');
      sections.forEach(s => observer.observe(s));

          return () => observer.disconnect();
  }, []);
 
  useEffect(() => {
    const existing = document.getElementById('landing-styles');
    if (!existing) {
    const style = document.createElement('style');
    style.id = 'landing-styles';
    style.textContent = pageStyles;
    document.head.appendChild(style);
    }
    }, []);


 return (
  <div className="snap-container" ref={containerRef}>
  {/* ── HERO SECTION ─────── */}
      <section className="snap-section hero-section" data-index="0">
        <div className="bg-mesh" />
        <div className="hero-grid-bg" />

        <div className="hero-content">
          {/* Eyebrow */}
         <p className="label-eyebrow anim-fade-up delay-1">
            Wallet Intelligence Protocol
          </p>

         {/* Giant Tesla-style headline */}
          <h1 className="display-hero anim-fade-up delay-2">
            <span className="hero-line-1">CLEAN</span>
            <br />
            <span className="hero-line-2">WALLET.</span>
            <br />
            <span className="hero-line-3 accent-text">REAL</span>
            <br />
            <span className="hero-line-4">VALUE.</span>
          </h1>

         {/* Tesla 2-CTA pattern */}
        <div className="hero-ctas anim-fade-up delay-3">
            <button className="btn btn-primary">
              Connect Wallet
            </button>
            <button className="btn btn-ghost">
              See How It Works
            </button>
          </div>
        </div>

       { /* Tesla stat rail at bottom */}
        <div className="hero-stat-rail anim-fade-up delay-4">
          <div className="stat-rail">
            <div className="stat-rail-item">
              <div className="stat-rail-value mono-value">$2.4M+</div>
              <div className="stat-rail-label">Dust Recovered</div>
            </div>
            <div className="stat-rail-item">
              <div className="stat-rail-value mono-value">18K+</div>
              <div className="stat-rail-label">Spam Burned</div>
            </div>
            <div className="stat-rail-item">
              <div className="stat-rail-value mono-value">99.2%</div>
              <div className="stat-rail-label">Accuracy</div>
            </div>
            <div className="stat-rail-item">
              <div className="stat-rail-value mono-value">12</div>
              <div className="stat-rail-label">Chains Supported</div>
            </div>
          </div>
        </div>

       {/* Scroll indicator */}
       <div className="scroll-hint">
          <div className="scroll-line" />
          <span className="label-eyebrow">scroll</span>
        </div>
      </section>

      {/* ── FEATURES SECTION ────── */}
      <section className="snap-section features-section" data-index="1">
        <div className="bg-mesh" style={{ '--mesh-color': 'rgba(0, 232, 122, 0.06)' } as React.CSSProperties} />
        <div className="section-inner">
          <p className="label-eyebrow">What We Do</p>
          <h2 className="display-section">
            FULL<br />
            <span className="accent-text">CONTROL.</span>
          </h2>

          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div key={f.id} className={`feature-card card animate-slide-up stagger-${i + 1}`}>
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
                <div className="feature-stat">
                  <span className="mono-value accent-text">{f.stat}</span>
                  <span className="label-eyebrow">{f.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    {/* ── AUTOMATION SECTION ────── */}
      <section className="snap-section automation-section" data-index="2">
        <div className="section-inner two-col">
          <div className="section-copy">
            <p className="label-eyebrow">Automation Engine</p>
            <h2 className="display-section">
              SET IT.<br />
              <span className="accent-text">FORGET IT.</span>
            </h2>
            <p className="section-body">
              Rules-based automation watches your wallet 24/7. Spam detected, dust recovered, wallet score maintained — all without lifting a finger.
            </p>
            <div className="section-ctas">
              <button className="btn btn-primary">Configure Automation</button>
              <button className="btn btn-ghost">Learn More</button>
            </div>
          </div>

          {/* Terminal log preview (Zerion DNA) */}
         <div className="terminal-preview card">
            <div className="terminal-header">
              <div className="terminal-dot red" />
              <div className="terminal-dot amber" />
              <div className="terminal-dot green" />
              <span className="label-eyebrow" style={{ marginLeft: 'auto' }}>automation log</span>
            </div>
            <div className="terminal-body">
              {MOCK_LOGS.map((log, i) => (
                <div key={i} className={`log-line stagger-${i + 1} animate-slide-right`}>
                  <span className="log-time mono-address">{log.time}</span>
                  <span className={`log-type ${log.type}`}>{log.label}</span>
                  <span className="log-msg">{log.msg}</span>
                </div>
              ))}
              <div className="log-cursor" />
            </div>
          </div>
        </div>
      </section>

      {/* ── HEALTH SCORE SECTION ───── */}
      <section className="snap-section health-section" data-index="3">
        <div className="section-inner two-col reverse">
          {/* Zerion-style score display */}
        <div className="score-display-wrapper">
            <div className="score-card card">
              <p className="label-eyebrow">Wallet Health Score</p>
              <div className="score-hero-value mono-value">
                <span className="score-number">94</span>
                <span className="score-max">/100</span>
              </div>
              <div className="score-breakdown">
                {SCORE_ITEMS.map((item, i) => (
                  <div key={item.label} className="score-row">
                    <span className="score-label">{item.label}</span>
                    <div className="health-bar-track">
                      <div
                        className="health-bar-fill"
                        style={{
                          width: `${item.pct}%`,
                          background: item.color,
                          animationDelay: `${i * 0.1}s`
                        }}
                      />
                    </div>
                    <span className="score-pct mono-value">{item.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="section-copy">
            <p className="label-eyebrow">Health Intelligence</p>
            <h2 className="display-section">
              KNOW YOUR<br />
              <span className="accent-text">SCORE.</span>
            </h2>
            <p className="section-body">
              Your wallet health score surfaces exactly what's dragging down your portfolio — spam tokens, unclaimed dust, gas inefficiencies — ranked by impact.
            </p>
            <button className="btn btn-primary">Check My Score</button>
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ───── */}
     <section className="snap-section cta-section" data-index="4">
        <div className="bg-mesh" />
        <div className="cta-inner">
          <p className="label-eyebrow">Start Now</p>
          <h2 className="display-hero">
            YOUR WALLET.<br />
            <span className="accent-text">EVOLVED.</span>
          </h2>
          <p className="cta-body">
            Connect your wallet. Get your score. Start recovering value in under 60 seconds.
          </p>
          <div className="cta-actions">
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '16px 40px' }}>
              Connect Wallet — Free
            </button>
            <button className="btn btn-ghost">View Documentation</button>
          </div>
          <div className="cta-chains">
            {CHAINS.map(c => (
              <span key={c.id} className={`chain-badge chain-${c.id}`}>
                <span className="chain-dot" />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION DOTS (Tesla-style indicator) ──── */}
    <div className="section-dots">
        {[0,1,2,3,4].map(i => (
          <div
            key={i}
            className={`section-dot ${activeSection === i ? 'active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── PAGE STYLES ───────── */

const pageStyles = `
/* ─── HERO ─── */
.hero-section {
background: var(--bg-base);
align-items: flex-start;
padding-top: var(--nav-height);
}

.hero-grid-bg {
position: absolute;
inset: 0;
background-image:
linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
background-size: 60px 60px;
mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
pointer-events: none;
}

.hero-content {
position: relative;
z-index: 1;
max-width: var(--content-max);
width: 100%;
margin: 0 auto;
padding: 0 var(--space-xl);
display: flex;
flex-direction: column;
gap: var(--space-xl);
}

.hero-line-1, .hero-line-2, .hero-line-4 { color: var(--text-primary); }
.hero-line-3 { color: var(--accent); }
.accent-text { color: var(--accent); }

.hero-ctas {
display: flex;
gap: var(--space-md);
flex-wrap: wrap;
}

.hero-stat-rail {
position: absolute;
bottom: 0;
left: 0;
right: 0;
padding: 0 var(--space-xl) var(--space-xl);
max-width: var(--content-max);
margin: 0 auto;
width: 100%;
}

.scroll-hint {
position: absolute;
bottom: var(--space-xl);
right: var(--space-xl);
display: flex;
flex-direction: column;
align-items: center;
gap: var(--space-sm);
opacity: 0.4;
}

.scroll-line {
width: 1px;
height: 40px;
background: var(--text-secondary);
animation: float 2s ease-in-out infinite;
}

/* ─── SECTIONS ───*/
.section-inner {
max-width: var(--content-max);
width: 100%;
margin: 0 auto;
padding: 0 var(--space-xl);
display: flex;
flex-direction: column;
gap: var(--space-xl);
}

.section-inner.two-col {
flex-direction: row;
align-items: center;
gap: var(--space-3xl);
}

.section-inner.two-col.reverse { flex-direction: row-reverse; }

.section-copy {
flex: 1;
display: flex;
flex-direction: column;
gap: var(--space-lg);
}

.section-body {
font-size: 18px;
line-height: 1.7;
color: var(--text-secondary);
max-width: 480px;
}

.section-ctas { display: flex; gap: var(--space-md); flex-wrap: wrap; }

/* ─── FEATURES ───*/
.features-section { background: var(--bg-base); }

.features-grid {
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: var(--space-md);
}

.feature-card {
padding: var(--space-xl);
display: flex;
flex-direction: column;
gap: var(--space-md);
transition: transform var(--transition-base), border-color var(--transition-base);
cursor: default;
}

.feature-card:hover {
transform: translateY(-4px);
border-color: var(--border-accent);
}

.feature-icon {
font-size: 28px;
color: var(--accent);
line-height: 1;
}

.feature-title {
font-size: 16px;
font-weight: 700;
color: var(--text-primary);
}

.feature-desc {
font-size: 14px;
line-height: 1.6;
color: var(--text-secondary);
flex: 1;
}

.feature-stat {
display: flex;
flex-direction: column;
gap: 2px;
padding-top: var(--space-md);
border-top: 1px solid var(--border);
}

.feature-stat .mono-value {
font-size: 20px;
}

/* ─── TERMINAL ───*/
.automation-section { background: var(--bg-base); }

.terminal-preview {
flex: 1;
overflow: hidden;
}

.terminal-header {
display: flex;
align-items: center;
gap: var(--space-sm);
padding: var(--space-md) var(--space-lg);
border-bottom: 1px solid var(--border);
}

.terminal-dot {
width: 10px;
height: 10px;
border-radius: 50%;
}
.terminal-dot.red    { background: var(--red); }
.terminal-dot.amber  { background: var(--amber); }
.terminal-dot.green  { background: var(--green); }

.terminal-body {
padding: var(--space-md) var(--space-lg);
display: flex;
flex-direction: column;
gap: var(--space-sm);
font-family: var(--font-mono);
font-size: 13px;
}

.log-line {
display: flex;
align-items: center;
gap: var(--space-sm);
padding: 4px 0;
}

.log-time { color: var(--text-tertiary); font-size: 11px; }

.log-type {
padding: 1px 6px;
border-radius: 3px;
font-size: 10px;
font-weight: 700;
letter-spacing: 0.06em;
flex-shrink: 0;
}
.log-type.success { background: var(--green-dim); color: var(--green); }
.log-type.accent  { background: var(--accent-dim); color: var(--accent); }
.log-type.warning { background: var(--amber-dim); color: var(--amber); }

.log-msg { color: var(--text-secondary); font-size: 12px; }

.log-cursor {
width: 8px;
height: 14px;
background: var(--accent);
opacity: 0.7;
animation: breathe 1.2s ease-in-out infinite;
margin-top: var(--space-sm);
}

/*── SCORE SECTION ───*/
.health-section { background: var(--bg-base); }

.score-display-wrapper { flex: 1; }

.score-card {
padding: var(--space-xl);
display: flex;
flex-direction: column;
gap: var(--space-lg);
}

.score-hero-value {
display: flex;
align-items: baseline;
gap: 4px;
}

.score-number {
font-family: var(--font-mono);
font-size: 80px;
font-weight: 600;
font-variant-numeric: tabular-nums;
color: var(--green);
line-height: 1;
}

.score-max {
font-family: var(--font-mono);
font-size: 28px;
color: var(--text-secondary);
}

.score-breakdown {
display: flex;
flex-direction: column;
gap: var(--space-md);
}

.score-row {
display: grid;
grid-template-columns: 140px 1fr 36px;
align-items: center;
gap: var(--space-md);
}

.score-label { font-size: 13px; color: var(--text-secondary); }
.score-pct   { font-size: 13px; font-family: var(--font-mono); text-align: right; }

/* ─── CTA ───*/
.cta-section {
background: var(--bg-base);
align-items: center;
}

.cta-inner {
position: relative;
z-index: 1;
max-width: var(--content-max);
width: 100%;
margin: 0 auto;
padding: 0 var(--space-xl);
display: flex;
flex-direction: column;
gap: var(--space-xl);
align-items: center;
text-align: center;
}

.cta-body {
font-size: 20px;
color: var(--text-secondary);
max-width: 520px;
}

.cta-actions { display: flex; gap: var(--space-md); flex-wrap: wrap; justify-content: center; }

.cta-chains { display: flex; gap: var(--space-sm); flex-wrap: wrap; justify-content: center; }

/* ─── SECTION DOTS ───*/
.section-dots {
position: fixed;
right: var(--space-xl);
top: 50%;
transform: translateY(-50%);
display: flex;
flex-direction: column;
gap: var(--space-sm);
z-index: 50;
}

.section-dot {
width: 6px;
height: 6px;
border-radius: 50%;
background: var(--border);
transition: all var(--transition-base);
}

.section-dot.active {
background: var(--accent);
transform: scale(1.4);
}
.cta-body {
font-size: 20px;
color: var(--text-secondary);
max-width: 520px;
}

.cta-actions { display: flex; gap: var(--space-md); flex-wrap: wrap; justify-content: center; }

.cta-chains { display: flex; gap: var(--space-sm); flex-wrap: wrap; justify-content: center; }

/* ─── RESPONSIVE ── */
@media (max-width: 1024px) {
.features-grid { grid-template-columns: repeat(2, 1fr); }
.section-inner.two-col,
.section-inner.two-col.reverse { flex-direction: column; }
.section-dots { display: none; }
}

@media (max-width: 600px) {
.features-grid { grid-template-columns: 1fr; }
.hero-content  { padding: 0 var(--space-md); }
.hero-stat-rail { padding: 0 var(--space-md) var(--space-xl); }
.score-row { grid-template-columns: 100px 1fr 32px; }
.hero-ctas { flex-direction: column; }
.cta-actions { flex-direction: column; align-items: center; }
}
`;