import { useState, useEffect } from 'react';
import LandingPage from './page';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import "../styles/globals.css";  
import "../styles/animations.css"; 
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/layout/PageContainer';
import { useScreenSize } from '../hooks/useScreenSize';

// ─── NAV ICONS ───────────────────────────────────────────────────────
const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const IconAutomation = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
  </svg>
);

const IconRecovery = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconWallet = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
  </svg>
);

// ─── CONSTANTS ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/automation', label: 'Automation', icon: IconAutomation },
  { to: '/recovery', label: 'Recovery', icon: IconRecovery },
  { to: '/settings', label: 'Settings', icon: IconSettings },
];

// ─── SIDEBAR COMPONENT ───────────────────────────────────────────────
function Sidebar({ walletAddress }: { walletAddress: string | null }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark"><span>W</span></div>
        <div className="logo-text">
          <span className="logo-name">WIP</span>
          <span className="logo-sub">Protocol</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {walletAddress ? (
          <div className="wallet-pill-sidebar">
            <div className="pulse-dot" />
            <span className="mono-address">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm w-full">
            <IconWallet />
            Connect Wallet
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── MOBILE TAB BAR ──────────────────────────────────────────────────
function MobileTabBar() {
  return (
    <nav className="mobile-tabbar">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `mobile-tab-item ${isActive ? 'active' : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// ─── ROOT LAYOUT ─────────────────────────────────────────────────────
export default function Layout() {
  const [scrolled, setScrolled] = useState(false);
  const [walletAddress] = useState(null);
  const location = useLocation();
  const { isMobile } = useScreenSize();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  return (
   <div className={isMobile ? 'mobile-mode app-shell' : 'desktop-mode app-shell'}>
  {!isMobile && <Sidebar className="desktop-only" walletAddress={walletAddress} />}
      <div className="main-content">
         <Navbar scrolled={scrolled} walletAddress={walletAddress} isMobile={isMobile} />
            <PageContainer>
                <Outlet />
                  </PageContainer>
                  </div>
   {isMobile && <MobileTabBar className="mobile-only" />}
    </div>
  );
}
