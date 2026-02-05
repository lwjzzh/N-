
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, Zap, LucideIcon, PenTool, Grid } from 'lucide-react';

const SidebarItem: React.FC<{ to: string; icon: LucideIcon; label: string }> = ({ to, icon: Icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
        }`
      }
    >
      <Icon className="w-4 h-4" />
      {label}
    </NavLink>
  );
};

const Layout: React.FC = () => {
  return (
    <div className="flex h-screen bg-background text-text overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-surface/50 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            <Zap className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">OmniFlow</span>
        </div>

        <div className="flex-1 px-4 py-2 space-y-1">
          <SidebarItem to="/" icon={Grid} label="应用库 (App Library)" />
          <SidebarItem to="/apps" icon={PenTool} label="配置应用 (Config Apps)" />
        </div>

        <div className="px-4 py-2 space-y-1">
            <SidebarItem to="/settings" icon={Settings} label="设置 (Settings)" />
        </div>

        <div className="p-4 border-t border-border">
            <div className="text-xs text-zinc-500 px-2">
                v0.2.1 Beta
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background relative flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
