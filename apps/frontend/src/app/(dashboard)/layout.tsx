'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Providers } from '@/app/providers';
import Link from 'next/link';
import {
  LayoutDashboard,
  Server,
  BriefcaseBusiness,
  ScrollText,
  Settings,
  LogOut,
  Shield,
  MonitorSmartphone,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { href: '/agents', label: 'Agents', icon: Server, permission: 'agents.view' },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness, permission: 'jobs.view' },
  { href: '/audit', label: 'Audit Logs', icon: ScrollText, permission: 'audit.view' },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'org.manage' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, clearUser } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    }
    clearUser();
    router.push('/login');
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <Providers>
      <div className="h-screen flex overflow-hidden bg-surface-950">
        {/* Sidebar Overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-surface-900 border-r border-surface-800 
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-800">
              <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
                <MonitorSmartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight leading-none">MASSVISION</h1>
                <p className="text-[10px] text-brand-400 font-semibold tracking-[0.2em] uppercase">Reap3r</p>
              </div>
              <button
                className="ml-auto lg:hidden text-surface-400 hover:text-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                        : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800'}
                    `}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User */}
            <div className="border-t border-surface-800 p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-400 text-sm font-bold flex-shrink-0">
                  {user.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                  <p className="text-xs text-surface-500 truncate">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-surface-500 hover:text-red-400 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 flex items-center px-4 border-b border-surface-800 bg-surface-900/50 backdrop-blur-sm">
            <button
              className="lg:hidden text-surface-400 hover:text-white mr-3"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <Shield className="w-3.5 h-3.5" />
                <span>{user.organization_name || 'MASSVISION'}</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
