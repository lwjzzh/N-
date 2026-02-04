import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BuilderPage from './pages/Builder';
import RunnerPage from './pages/Runner';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="settings" element={<div className="p-8 text-zinc-500">Settings Page (Coming Soon)</div>} />
        </Route>
        
        {/* Full screen routes without sidebar */}
        <Route path="/builder/:id" element={<BuilderPage />} />
        <Route path="/run/:id" element={<RunnerPage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;