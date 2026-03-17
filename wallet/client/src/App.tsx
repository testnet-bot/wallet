import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './app/layout';
import LandingPage from './app/page';
import DashboardPage from './app/dashboard/page';
import AutomationPage from './app/automation/page';
import RecoveryPage from './app/recovery/page';
import SettingsPage from './app/settings/page';

// TEMP LOG to confirm App mounts
console.log("App.tsx rendered");

export default function App() {
  return (
    <BrowserRouter>
      {/* TEMP VISUAL TO CONFIRM APP MOUNTS */}
      <div
        style={{
          background: 'purple',
          color: 'white',
          width: '100vw',
          height: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: 'bold',
          fontSize: '16px',
          zIndex: 9999,
        }}
      >
        APP COMPONENT MOUNTED
      </div>

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />

          {/* DASHBOARD PAGE */}
          <Route
            path="dashboard"
            element={
              <>
                {console.log("DashboardPage rendered")}
                <div
                  style={{
                    background: 'lime',
                    color: 'black',
                    padding: 4,
                    fontWeight: 'bold',
                  }}
                >
                  DASHBOARD PAGE LOADED
                </div>
                <DashboardPage />
              </>
            }
          />

          {/* AUTOMATION PAGE */}
          <Route
            path="automation"
            element={
              <>
                {console.log("AutomationPage rendered")}
                <div
                  style={{
                    background: 'orange',
                    color: 'black',
                    padding: 4,
                    fontWeight: 'bold',
                  }}
                >
                  AUTOMATION PAGE LOADED
                </div>
                <AutomationPage />
              </>
            }
          />

          {/* RECOVERY PAGE */}
          <Route
            path="recovery"
            element={
              <>
                {console.log("RecoveryPage rendered")}
                <div
                  style={{
                    background: 'red',
                    color: 'white',
                    padding: 4,
                    fontWeight: 'bold',
                  }}
                >
                  RECOVERY PAGE LOADED
                </div>
                <RecoveryPage />
              </>
            }
          />

          {/* SETTINGS PAGE */}
          <Route
            path="settings"
            element={
              <>
                {console.log("SettingsPage rendered")}
                <div
                  style={{
                    background: 'pink',
                    color: 'black',
                    padding: 4,
                    fontWeight: 'bold',
                  }}
                >
                  SETTINGS PAGE LOADED
                </div>
                <SettingsPage />
              </>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
