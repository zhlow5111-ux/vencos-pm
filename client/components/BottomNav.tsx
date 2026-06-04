import React, { useState } from 'react';
import { LayoutDashboard, Building2, Receipt, Wrench, MoreHorizontal, TrendingUp, Key, Users, Settings, X, Briefcase } from 'lucide-react';
import { Page } from '../types';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  userRole?: string;
}

const MAIN_NAV: { page: Page; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { page: 'dashboard', label: '总览', Icon: LayoutDashboard },
  { page: 'properties', label: '物业', Icon: Building2 },
  { page: 'billing', label: '账单', Icon: Receipt },
  { page: 'clients', label: '客户', Icon: Users },
];

const MORE_NAV: { page: Page; label: string; desc: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { page: 'sales', label: '买卖管道', desc: '物业买卖流程追踪', Icon: TrendingUp },
  { page: 'rentals', label: '租赁管道', desc: '租赁流程追踪', Icon: Key },
  { page: 'maintenance', label: '维修工单', desc: '租户维修请求管理', Icon: Wrench },
  { page: 'agents', label: '中介管理', desc: '中介列表 / 空置物业匹配 / 群发通知', Icon: Briefcase },
  { page: 'settings', label: '系统设置', desc: '模板 / 排程 / 集成 / 用户', Icon: Settings },
];

const MORE_PAGES = new Set<Page>(['sales', 'rentals', 'maintenance', 'settings', 'agents']);

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate, userRole }) => {
  const [showMore, setShowMore] = useState(false);
  const isMoreActive = MORE_PAGES.has(currentPage);
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';
  const filteredMoreNav = isAdmin ? MORE_NAV : MORE_NAV.filter(n => n.page !== 'settings');

  function handleMoreNavigate(page: Page) {
    setShowMore(false);
    onNavigate(page);
  }

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="absolute bottom-16 left-0 right-0 mx-auto max-w-lg p-3 animate-[slideUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-base-100 rounded-2xl shadow-2xl overflow-hidden border border-base-300/40">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <h3 className="text-sm font-semibold text-base-content/70">更多功能</h3>
                <button className="btn btn-ghost btn-xs btn-circle text-base-content/40" onClick={() => setShowMore(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                {filteredMoreNav.map(({ page, label, desc, Icon }) => {
                  const isActive = currentPage === page;
                  return (
                    <button
                      key={page}
                      onClick={() => handleMoreNavigate(page)}
                      className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-base-200 border border-base-300'
                          : 'hover:bg-base-200/60 border border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-base-content/8 text-base-content' : 'bg-base-200 text-base-content/50'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${isActive ? 'text-base-content' : 'text-base-content/70'}`}>{label}</p>
                        <p className="text-[10px] text-base-content/40 mt-0.5 leading-tight">{desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar — clean white */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300/50">
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
          {MAIN_NAV.map(({ page, label, Icon }) => {
            const isActive = currentPage === page;
            return (
              <button
                key={page}
                onClick={() => { onNavigate(page); setShowMore(false); }}
                className={`
                  relative flex flex-col items-center justify-center gap-0.5
                  flex-1 h-12 rounded-xl transition-all duration-200 mx-0.5
                  ${isActive
                    ? 'text-primary'
                    : 'text-base-content/35 hover:text-base-content/60'
                  }
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
                <span className={`text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 w-5 h-0.5 rounded-full" style={{ backgroundColor: '#BE5F28' }} />
                )}
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`
              relative flex flex-col items-center justify-center gap-0.5
              flex-1 h-12 rounded-xl transition-all duration-200 mx-0.5
              ${isMoreActive || showMore
                ? 'text-primary'
                : 'text-base-content/35 hover:text-base-content/60'
              }
            `}
          >
            <MoreHorizontal size={20} strokeWidth={isMoreActive || showMore ? 2.2 : 1.5} />
            <span className={`text-[10px] leading-none ${isMoreActive || showMore ? 'font-semibold' : 'font-medium'}`}>
              更多
            </span>
            {isMoreActive && (
              <span className="absolute -bottom-1 w-5 h-0.5 rounded-full" style={{ backgroundColor: '#BE5F28' }} />
            )}
          </button>
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </nav>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};
