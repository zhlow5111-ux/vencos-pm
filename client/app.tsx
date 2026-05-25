// Tasklet shim MUST be imported first — sets up window.tasklet before any other code uses it
import './tasklet-shim';
import { setAuthToken, clearAuthToken, getAuthToken } from './tasklet-shim';

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Page, PortalMode, Property, Client, SaleDeal, RentalDeal, Invoice, MessageTemplate, BillingSchedule, Owner, SystemUser } from './types';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { PropertyList } from './components/PropertyList';
import { PropertyForm } from './components/PropertyForm';
import { SalesPipeline } from './components/SalesPipeline';
import { RentalPipeline } from './components/RentalPipeline';
import { ClientList } from './components/ClientList';
import { ClientForm } from './components/ClientForm';
import { DealForm } from './components/DealForm';
import { BillingPage } from './components/BillingPage';
import { InvoiceForm } from './components/InvoiceForm';
import { SettingsPage } from './components/SettingsPage';
import { TemplateForm } from './components/TemplateForm';
import { ScheduleForm } from './components/ScheduleForm';
import { OwnerForm } from './components/OwnerForm';
import { AccessManager } from './components/AccessManager';
import { MaintenanceTickets } from './components/MaintenanceTickets';
import { TenantPortal } from './components/TenantPortal';
import { WorkerPortal } from './components/WorkerPortal';
import { StakeholderPortal } from './components/StakeholderPortal';
import { LoginScreen } from './components/LoginScreen';
import { LogOut, Bell, BellOff, BellRing, Sun, Moon } from 'lucide-react';
import { isPushSupported, getNotificationPermission, requestNotificationPermission } from './utils/push';

// Theme toggle component
function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <div className="tooltip tooltip-bottom" data-tip={isDark ? '浅色模式' : '深色模式'}>
      <button className="btn btn-xs btn-ghost text-base-content/50 hover:text-base-content/80" onClick={onToggle}>
        {isDark ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </div>
  );
}

// Notification bell component
function NotificationBell() {
  const [permission, setPermission] = React.useState<string>('default');
  const [supported, setSupported] = React.useState(false);

  React.useEffect(() => {
    setSupported(isPushSupported());
    setPermission(getNotificationPermission() as string);
  }, []);

  if (!supported) return null;

  const handleClick = async () => {
    if (permission === 'granted') return;
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
  };

  if (permission === 'denied') {
    return (
      <div className="tooltip tooltip-bottom" data-tip="通知已被浏览器阻止">
        <button className="btn btn-xs btn-ghost text-base-content/40" disabled>
          <BellOff size={14} />
        </button>
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div className="tooltip tooltip-bottom" data-tip="通知已开启">
        <button className="btn btn-xs btn-ghost text-success">
          <BellRing size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="tooltip tooltip-bottom" data-tip="开启推送通知">
      <button className="btn btn-xs btn-ghost text-warning animate-pulse" onClick={handleClick}>
        <Bell size={14} />
      </button>
    </div>
  );
}

type ModalState =
  | null
  | { type: 'property'; data?: Property }
  | { type: 'client'; data?: Client }
  | { type: 'sale'; data?: SaleDeal }
  | { type: 'rental'; data?: RentalDeal }
  | { type: 'invoice'; data?: Invoice }
  | { type: 'template'; data?: MessageTemplate }
  | { type: 'schedule'; data?: BillingSchedule }
  | { type: 'owner'; data?: Owner }
  | { type: 'access'; data: SystemUser };

const PAGE_TITLES: Record<Page, string> = {
  dashboard: '总览',
  properties: '物业管理',
  sales: '买卖流程',
  rentals: '租赁流程',
  clients: '客户管理',
  billing: '账单管理',
  maintenance: '维修工单',
  settings: '系统设置',
};

const App: React.FC = () => {
  // DB init is handled by the server — app is always ready
  const [ready] = useState(true);
  const [user, setUser] = useState<{ id: number; name: string; role: string; phone?: string } | null>(() => {
    // Restore user session from localStorage
    const saved = localStorage.getItem('vencos_user');
    const token = getAuthToken();
    if (saved && token) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });
  const [portalMode, setPortalMode] = useState<PortalMode>('admin');
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [modal, setModal] = useState<ModalState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState<'vencos-light' | 'vencos-dark'>(() => {
    const saved = localStorage.getItem('vencos-theme');
    if (saved === 'vencos-dark') return 'vencos-dark';
    if (saved === 'vencos-light') return 'vencos-light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vencos-dark' : 'vencos-light';
  });

  // Apply theme on mount and change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vencos-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'vencos-dark' ? 'vencos-light' : 'vencos-dark');
  }, []);

  // Set portal mode based on user role when user logs in
  useEffect(() => {
    if (user) {
      if (user.role === 'tenant') setPortalMode('tenant');
      else if (user.role === 'worker') setPortalMode('worker');
      else if (user.role === 'stakeholder') setPortalMode('stakeholder');
      else setPortalMode('admin');
    }
  }, [user]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  function handleLogin(u: { id: number; name: string; role: string; phone?: string }) {
    setUser(u);
    localStorage.setItem('vencos_user', JSON.stringify(u));
  }

  function handleModalClose() { setModal(null); refresh(); }
  function handleModalSaved() { setModal(null); refresh(); }
  function handlePropertySaved(updatedProperty: Property) { setModal({ type: 'property', data: updatedProperty }); refresh(); }

  function handleQuickAdd(type: 'property' | 'client' | 'sale' | 'rental') {
    if (type === 'property') { setCurrentPage('properties'); setModal({ type: 'property' }); }
    else if (type === 'client') { setCurrentPage('clients'); setModal({ type: 'client' }); }
    else if (type === 'sale') { setCurrentPage('sales'); setModal({ type: 'sale' }); }
    else { setCurrentPage('rentals'); setModal({ type: 'rental' }); }
  }

  function handleLogout() {
    setUser(null);
    clearAuthToken();
    localStorage.removeItem('vencos_user');
    setPortalMode('admin');
    setCurrentPage('dashboard');
    setModal(null);
  }

  if (!ready) {
    return (
      <div data-theme={theme} className="flex items-center justify-center h-screen bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-3 text-sm text-base-content/60">初始化中...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isAdminRole = user.role === 'super_admin' || user.role === 'admin';

  // ===== Unified Header for ALL portals =====
  const portalSubtitle = portalMode === 'admin' ? PAGE_TITLES[currentPage]
    : portalMode === 'stakeholder' ? '业主入口'
    : portalMode === 'tenant' ? '租户入口' : '维修人员';

  const unifiedHeader = (
    <header className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0 bg-base-100 border-b border-base-300/60">
      <div>
        <h1 className="text-lg font-extrabold tracking-wider">
          <span style={{ color: '#BE5F28' }}>V</span><span style={{ color: '#D29B61' }}>E</span><span className="text-base-content">NCOS</span>
        </h1>
        <p className="text-[11px] text-base-content/40 font-medium -mt-0.5">{portalSubtitle}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-base-content/50 font-medium whitespace-nowrap">{user.name}</span>
        <ThemeToggle isDark={theme === 'vencos-dark'} onToggle={toggleTheme} />
        <NotificationBell />
        {isAdminRole && (
          <select className="select select-xs bg-base-200/80 border-base-300 text-xs min-w-[100px]" value={portalMode} onChange={e => setPortalMode(e.target.value as PortalMode)}>
            <option value="admin">管理后台</option>
            <option value="stakeholder">业主入口</option>
            <option value="tenant">租户入口</option>
            <option value="worker">维修人员</option>
          </select>
        )}
        <button className="btn btn-xs btn-ghost text-base-content/30 hover:text-base-content/60" onClick={handleLogout} title="登出">
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );

  // Tenant portal
  if (portalMode === 'tenant') {
    return (
      <div data-theme={theme} className="flex flex-col h-screen bg-base-200">
        {unifiedHeader}
        <div className="flex-1 overflow-y-auto">
          <TenantPortal hideHeader userPhone={user.role === 'tenant' ? user.phone : undefined} />
        </div>
      </div>
    );
  }

  // Worker portal
  if (portalMode === 'worker') {
    return (
      <div data-theme={theme} className="flex flex-col h-screen bg-base-200">
        {unifiedHeader}
        <div className="flex-1 overflow-y-auto">
          <WorkerPortal hideHeader userPhone={user.role === 'worker' ? user.phone : undefined} />
        </div>
      </div>
    );
  }

  // Stakeholder portal
  if (portalMode === 'stakeholder') {
    return (
      <div data-theme={theme} className="flex flex-col h-screen bg-base-200">
        {unifiedHeader}
        <div className="flex-1 overflow-y-auto">
          <StakeholderPortal hideHeader user={user} onLogout={handleLogout} />
        </div>
      </div>
    );
  }

  // Admin portal
  return (
    <div data-theme={theme} className="flex flex-col h-screen bg-base-200">
      {unifiedHeader}

      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-20">
        {currentPage === 'dashboard' && (
          <Dashboard onNavigate={setCurrentPage} onQuickAdd={handleQuickAdd} userId={user.role === 'stakeholder' ? user.id : undefined} userRole={user.role} />
        )}
        {currentPage === 'properties' && (
          <PropertyList
            onAdd={() => setModal({ type: 'property' })}
            onEdit={(p) => setModal({ type: 'property', data: p })}
            refreshKey={refreshKey}
            userId={user.role === 'stakeholder' ? user.id : undefined}
          />
        )}
        {currentPage === 'sales' && (
          <SalesPipeline
            onAdd={() => setModal({ type: 'sale' })}
            onEdit={(d) => setModal({ type: 'sale', data: d })}
            refreshKey={refreshKey}
          />
        )}
        {currentPage === 'rentals' && (
          <RentalPipeline
            onAdd={() => setModal({ type: 'rental' })}
            onEdit={(d) => setModal({ type: 'rental', data: d })}
            refreshKey={refreshKey}
          />
        )}
        {currentPage === 'clients' && (
          <ClientList
            onAdd={() => setModal({ type: 'client' })}
            onEdit={(c) => setModal({ type: 'client', data: c })}
            refreshKey={refreshKey}
          />
        )}
        {currentPage === 'billing' && (
          <BillingPage
            onAdd={() => setModal({ type: 'invoice' })}
            onEdit={(inv) => setModal({ type: 'invoice', data: inv })}
            refreshKey={refreshKey}
            userId={user.role === 'stakeholder' ? user.id : undefined}
          />
        )}
        {currentPage === 'maintenance' && (
          <MaintenanceTickets refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {currentPage === 'settings' && (
          <SettingsPage
            onAddTemplate={() => setModal({ type: 'template' })}
            onEditTemplate={(t) => setModal({ type: 'template', data: t })}
            onAddSchedule={() => setModal({ type: 'schedule' })}
            onEditSchedule={(s) => setModal({ type: 'schedule', data: s })}
            onAddOwner={() => setModal({ type: 'owner' })}
            onEditOwner={(o) => setModal({ type: 'owner', data: o })}
            onManageUserAccess={(u: SystemUser) => setModal({ type: 'access', data: u })}
            refreshKey={refreshKey}
          />
        )}
      </main>

      <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} userRole={user.role} />

      {/* Modals */}
      {modal?.type === 'property' && <PropertyForm property={modal.data as Property | undefined} onClose={handleModalClose} onSaved={handlePropertySaved} />}
      {modal?.type === 'client' && <ClientForm client={modal.data as Client | undefined} onClose={handleModalClose} onSaved={handleModalSaved} />}
      {modal?.type === 'sale' && <DealForm type="sale" deal={modal.data as SaleDeal | undefined} onClose={handleModalClose} onSaved={handleModalSaved} />}
      {modal?.type === 'rental' && <DealForm type="rental" deal={modal.data as RentalDeal | undefined} onClose={handleModalClose} onSaved={handleModalSaved} />}
      {modal?.type === 'invoice' && <InvoiceForm invoice={modal.data as Invoice | undefined} onClose={handleModalClose} onSaved={handleModalSaved} />}
      {modal?.type === 'template' && <TemplateForm template={modal.data as MessageTemplate | undefined} onClose={handleModalClose} onSaved={handleModalSaved} />}
      {modal?.type === 'schedule' && <ScheduleForm schedule={modal.data as BillingSchedule | undefined} onClose={handleModalClose} onSaved={handleModalSaved} />}
      {modal?.type === 'owner' && <OwnerForm owner={modal.data as Owner | undefined} onClose={handleModalClose} onSaved={handleModalSaved} />}
      {modal?.type === 'access' && <AccessManager user={modal.data as SystemUser} onClose={handleModalClose} />}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
