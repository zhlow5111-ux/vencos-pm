import React, { useState, useEffect } from 'react';
import { Wrench, LogOut, Camera, Clock, CheckCircle, Play, Phone } from 'lucide-react';
import { Worker, MaintenanceTicket, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../types';
import { getWorkerByPhone, getTickets, updateTicketStatus } from '../utils/db';

interface WorkerPortalProps {
  userPhone?: string; // auto-login when user is a worker
  hideHeader?: boolean;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({ userPhone, hideHeader }) => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [phone, setPhone] = useState(userPhone || '');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState('active');

  // Auto-login if userPhone is provided
  useEffect(() => {
    if (userPhone && !worker) {
      handleLoginWithPhone(userPhone);
    }
  }, [userPhone]);

  async function handleLoginWithPhone(ph: string) {
    setLoading(true); setLoginError('');
    try {
      const w = await getWorkerByPhone(ph);
      if (!w) { setLoginError('未找到此电话号码的维修人员账号'); setLoading(false); return; }
      setWorker(w);
      const t = await getTickets(undefined, w.id);
      setTickets(t);
    } catch (e) { console.error(e); setLoginError('登录失败'); }
    setLoading(false);
  }

  async function handleLogin() {
    if (!phone.trim()) { setLoginError('请输入电话号码'); return; }
    await handleLoginWithPhone(phone.trim());
  }

  async function loadTickets() {
    if (!worker) return;
    try {
      const t = await getTickets(undefined, worker.id);
      setTickets(t);
    } catch (e) { console.error(e); }
  }

  async function handleStatusChange(id: number, status: string) {
    await updateTicketStatus(id, status);
    loadTickets();
  }

  const filtered = filter === 'active'
    ? tickets.filter(t => !['completed', 'cancelled'].includes(t.status))
    : tickets.filter(t => t.status === 'completed');

  // Login
  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="bg-warning/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Wrench size={32} className="text-warning" />
            </div>
            <h1 className="text-xl font-bold">维修人员入口</h1>
            <p className="text-sm text-base-content">Worker Portal</p>
          </div>
          <div className="space-y-3">
            <input className="input input-bordered w-full" placeholder="输入电话号码登录" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            {loginError && <p className="text-error text-sm">{loginError}</p>}
            <button className="btn btn-warning w-full" onClick={handleLogin} disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : '登录'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header — hidden when embedded in admin unified header */}
      {!hideHeader && (
        <header className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0 border-b border-base-300">
          <div>
            <h1 className="text-lg font-bold text-warning">🔧 维修任务</h1>
            <p className="text-xs text-base-content">{worker.name}</p>
          </div>
          {!userPhone && (
            <button className="btn btn-ghost btn-sm" onClick={() => setWorker(null)}>
              <LogOut size={16} /> 退出
            </button>
          )}
        </header>
      )}

      <main className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        <div className="flex gap-2 mb-3">
          <button className={`btn btn-sm flex-1 ${filter === 'active' ? 'btn-warning' : 'btn-ghost'}`} onClick={() => setFilter('active')}>
            进行中 ({tickets.filter(t => !['completed', 'cancelled'].includes(t.status)).length})
          </button>
          <button className={`btn btn-sm flex-1 ${filter === 'done' ? 'btn-success' : 'btn-ghost'}`} onClick={() => setFilter('done')}>
            已完成 ({tickets.filter(t => t.status === 'completed').length})
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-base-content">
            <Wrench size={48} className="mx-auto mb-3 opacity-30" />
            <p>{filter === 'active' ? '暂无待处理任务' : '暂无已完成任务'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => {
              const sta = TICKET_STATUSES.find(s => s.value === t.status);
              const cat = TICKET_CATEGORIES.find(c => c.value === t.category);
              const pri = TICKET_PRIORITIES.find(p => p.value === t.priority);
              const expanded = expandedId === t.id;
              const tPhotos: string[] = (() => { try { return JSON.parse(t.photos || '[]'); } catch { return []; } })();

              return (
                <div key={t.id} className="card bg-base-200">
                  <div className="card-body p-3">
                    <div className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : t.id)}>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`badge badge-sm ${sta?.color || ''}`}>{sta?.label}</span>
                        <span className={`badge badge-sm ${pri?.color || ''}`}>{pri?.label}</span>
                      </div>
                      <h3 className="font-bold text-sm mt-1">{t.title}</h3>
                      <p className="text-xs text-base-content">🏢 {t.property_name} • {cat?.label}</p>
                    </div>

                    {expanded && (
                      <div className="mt-3 space-y-3 border-t border-base-300 pt-3">
                        <div>
                          <p className="text-xs font-semibold text-base-content">问题描述</p>
                          <p className="text-sm whitespace-pre-wrap mt-1">{t.description || '无描述'}</p>
                        </div>

                        {tPhotos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-base-content mb-1"><Camera size={12} className="inline" /> 照片</p>
                            <div className="flex gap-2 overflow-x-auto">
                              {tPhotos.map((p, i) => <img key={i} src={p} className="w-24 h-24 rounded-lg object-cover shrink-0" />)}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-base-content">
                          <p>👤 租户: {t.tenant_name} {t.tenant_phone && <a className="text-primary" href={`tel:${t.tenant_phone}`}><Phone size={10} className="inline" /> {t.tenant_phone}</a>}</p>
                          <p><Clock size={10} className="inline" /> 提交: {t.submitted_at || t.created_at}</p>
                          {t.admin_notes && <p className="mt-1">📝 管理备注: {t.admin_notes}</p>}
                        </div>

                        {t.status !== 'completed' && t.status !== 'cancelled' && (
                          <div className="flex gap-2">
                            {/* BUG-34 fix: allow submitted/acknowledged → in_progress */}
                            {['submitted', 'acknowledged'].includes(t.status) && (
                              <button className="btn btn-primary btn-sm flex-1" onClick={() => handleStatusChange(t.id, 'in_progress')}>
                                <Play size={14} /> 开始维修
                              </button>
                            )}
                            {t.status === 'in_progress' && (
                              <button className="btn btn-success btn-sm flex-1" onClick={() => handleStatusChange(t.id, 'completed')}>
                                <CheckCircle size={14} /> 完成维修
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
