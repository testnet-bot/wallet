import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './app/layout';
import LandingPage from './app/page';
import DashboardPage from './app/dashboard/page';
import AutomationPage from './app/automation/page';
import RecoveryPage from './app/recovery/page';
import SettingsPage from './app/settings/page';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />

          {/* DASHBOARD PAGE */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* AUTOMATION PAGE */}
          <Route path="automation" element={<AutomationPage />} />

          {/* RECOVERY PAGE */}
          <Route path="recovery" element={<RecoveryPage />} />

          {/* SETTINGS PAGE */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
