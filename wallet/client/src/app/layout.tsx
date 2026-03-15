import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import "../styles/globals.css";  
import "../styles/animations.css"; 
import "../styles/dashboard.css";
import { NAV_ITEMS } from '../components/layout/Navbar';
import PageContainer from '../components/layout/PageContainer';
import { useScreenSize } from '../hooks/useScreenSize';
import ConnectWallet from '../components/wallet/ConnectWallet';
import WalletStatus from '../components/wallet/WalletStatus';
import WalletAddress from '../components/wallet/WalletAddress';
import WalletTransactions from '../components/wallet/WalletTransactions';
import WalletScanner from '../components/wallet/WalletScanner';


export default function Layout() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { isMobile } = useScreenSize();


  // Track scroll for header styling
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="app-shell" style={{ width: '100%', minHeight: '100%' }}>
      
      {/* ─── HEADER ONLY ─────────────────────────────────────────────── */}
      <header className={`topnav ${scrolled ? 'scrolled' : ''}`}>
        <div className="topnav-inner flex justify-between items-center w-full">
          
          {/* Brand */}
          <div className="topnav-brand">WALLET INTELLIGENCE PROTOCOL</div>

          {/* Desktop links */}
          {!isMobile && (
            <div className="topnav-links flex gap-md">
              {NAV_ITEMS.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `topnav-link btn btn-ghost btn-sm ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Wallet / Actions */}
          <div className="topnav-actions flex items-center gap-sm">
          {walletAddress ? (
          <div className="wallet-chip flex items-center gap-xs">
          <div className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span className="mono-address">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
          <span className="health-chip">94</span>
          </div>
          ) : (
          <button
          className="btn btn-primary btn-sm"
          onClick={() => setWalletOpen(true)}
          >
          Connect
          </button>
          )}

            {/* Mobile Hamburger */}
            {isMobile && (
              <button
                className="hamburger mobile-only"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobile && mobileOpen && (
          <div className="mobile-menu flex flex-col gap-sm">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>
      {/* ─── PAGE CONTENT ──────── */}
 <PageContainer style={{ background: 'black' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', width: '100%' }}>
        <Outlet />
          </div>
          </PageContainer>
   {/* ─── WALLET OVERLAY ─── */}
   {walletOpen && (
   <div
   className="wallet-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
   onClick={() => setWalletOpen(false)}
   >
   <div
   className="wallet-modal bg-bg-base p-6 rounded-lg relative"
   onClick={(e) => e.stopPropagation()}
   >
   <ConnectWallet onConnect={(addr: string) => setWalletAddress(addr)} />
   <WalletStatus 
   connected={!!walletAddress} 
   account={walletAddress} 
   />
   <WalletAddress account={walletAddress} />
   <WalletTransactions account={walletAddress} />
   <WalletScanner account={walletAddress} connected={!!walletAddress} />
   </div>
   </div>
   )}
     </div>
  );
}
