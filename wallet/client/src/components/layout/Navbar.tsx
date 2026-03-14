import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/globals.css';
import '../../styles/animations.css';

interface NavbarProps {
   walletAddress: string | null;
   isMobile: boolean;
   scrolled: boolean;
        }

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/automation', label: 'Automation' },
  { to: '/recovery', label: 'Recovery' },
  { to: '/settings', label: 'Settings' },
];

 export default function Navbar({ walletAddress, isMobile, scrolled }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className={`topnav ${scrolled ? 'scrolled' : ''}`}>
   <div className="topnav-inner flex justify-between items-center w-full">

        {/* Brand */}
        <div className="topnav-brand">WALLET INTELLIGENCE PROTOCOL</div>

        {/* Desktop Links */}
       {!isMobile && ( <div className="topnav-links flex gap-md desktop-only">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `topnav-link btn btn-ghost btn-sm ${isActive ? 'active' : ''}`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Wallet / Actions */}
        <div className="topnav-actions flex items-center gap-sm">
          {walletAddress ? (
            <div className="wallet-chip flex items-center gap-xs">
              <div className="pulse-dot" style={{ width: 6, height: 6 }} />
              <span className="mono-address">
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </span>
              <span className="health-chip">94</span>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm">Connect</button>
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
      <div className="mobile-menu mobile-only flex flex-col gap-sm">
      {NAV_ITEMS.map(({ to, label }) => (
      <NavLink
      key={to}
      to={to}
      className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
      onClick={() => setMobileOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
