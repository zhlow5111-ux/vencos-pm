import React, { useEffect, useState } from 'react';
import { Wrench, Plus, ChevronDown, ChevronUp, UserCog, Camera, AlertTriangle } from 'lucide-react';
import { MaintenanceTicket, Worker, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, WORKER_SPECIALTIES } from '../types';
import { getTickets, getWorkers, saveWorker, deleteWorker, updateTicketStatus, assignWorkerToTicket, updateTicketNotes, deleteTicket } from '../utils/db';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  refreshKey: number;
  onRefresh: () => void;
}

export const MaintenanceTickets: React.FC<Props> = ({ refreshKey, onRefresh }) => {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'tickets' | 'workers'>('tickets');
  const [wf, setWf] = useState<Partial<Worker> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  useEffect(() => { load(); }, [refreshKey]);

  async function load() {
    setLoading(true);
    try {
      const [t, w] = await Promise.all([getTickets(), getWorkers()]);
      setTickets(t);
      setWorkers(w);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
  const counts: Record<string, number> = { all: tickets.length };
  ['submitted', 'acknowledged', 'in_progress', 'completed'].forEach(s => {
    counts[s] = tickets.filter(t => t.status === s).length;
  });

  async function onStatus(id: number, status: string) {
    await updateTicketStatus(id, status);
    load(); onRefresh();
  }

  async function onAssign(tid: number, wid: number) {
    await assignWorkerToTicket(tid, wid);
    load();
  }

  async function onSaveNotes(id: number) {
    if (notesDraft[id] !== undefined) {
      await updateTicketNotes(id, notesDraft[id]);
      load();
    }
  }

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'ticket' | 'worker'; id: number } | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    setDeleteConfirm(null);
    if (type === 'ticket') {
      await deleteTicket(id);
      setExpandedId(null);
      onRefresh();
    } else {
      await deleteWorker(id);
    }
    load();
  }

  async function onSaveWorker() {
    if (!wf?.name) return;
    await saveWorker(wf as Worker & { name: string });
    setWf(null); load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><span className="loading loading-spinner loading-lg text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className={`btn btn-sm flex-1 ${tab === 'tickets' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('tickets')}>
          <Wrench size={16} /> 工单 ({tickets.length})
        </button>
        <button className={`btn btn-sm flex-1 ${tab === 'workers' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('workers')}>
          <UserCog size={16} /> 维修人员 ({workers.length})
        </button>
      </div>

      {tab === 'tickets' && (
        <>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {[{ k: 'all', l: '全部' }, { k: 'submitted', l: '已提交' }, { k: 'acknowledged', l: '已确认' }, { k: 'in_progress', l: '维修中' }, { k: 'completed', l: '已完成' }].map(f => (
              <button key={f.k} className={`btn btn-xs whitespace-nowrap ${filter === f.k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f.k)}>
                {f.l} ({counts[f.k] || 0})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-base-content">
              <Wrench size={40} className="mx-auto mb-2 opacity-30" />
              <p>暂无工单</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(ticket => {
                const cat = TICKET_CATEGORIES.find(c => c.value === ticket.category);
                const pri = TICKET_PRIORITIES.find(p => p.value === ticket.priority);
                const sta = TICKET_STATUSES.find(s => s.value === ticket.status);
                const expanded = expandedId === ticket.id;
                const photos: string[] = (() => { try { return JSON.parse(ticket.photos || '[]'); } catch { return []; } })();

                return (
                  <div key={ticket.id} className="card bg-base-200">
                    <div className="card-body p-3">
                      <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(expanded ? null : ticket.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`badge badge-xs ${sta?.color || ''}`}>{sta?.label}</span>
                            <span className={`badge badge-xs ${pri?.color || ''}`}>{pri?.label}</span>
                            {ticket.priority === 'urgent' && <AlertTriangle size={12} className="text-error" />}
                            {photos.length > 0 && <span className="badge badge-xs badge-ghost"><Camera size={10} /> {photos.length}</span>}
                          </div>
                          <h3 className="font-bold text-sm mt-1 truncate">{ticket.title}</h3>
                          <p className="text-xs text-base-content">
                            🏢 {ticket.property_name || '未知'} • 👤 {ticket.tenant_name || ticket.tenant_phone || '未知'} • {cat?.label || ticket.category}
                          </p>
                          {ticket.worker_name && <p className="text-xs text-primary mt-0.5">🔧 {ticket.worker_name}</p>}
                        </div>
                        {expanded ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
                      </div>

                      {expanded && (
                        <div className="mt-3 space-y-3 border-t border-base-300 pt-3">
                          <div>
                            <p className="text-xs font-semibold text-base-content mb-1">问题描述</p>
                            <p className="text-sm whitespace-pre-wrap">{ticket.description || '无描述'}</p>
                          </div>

                          {photos.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-base-content mb-1">📷 照片 ({photos.length})</p>
                              <div className="flex gap-2 overflow-x-auto">
                                {photos.map((p, i) => (
                                  <img key={i} src={p} alt={`Photo ${i + 1}`} className="w-24 h-24 object-cover rounded-lg shrink-0" />
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-base-content space-y-0.5">
                            <p>📤 提交: {ticket.submitted_at || ticket.created_at}</p>
                            {ticket.acknowledged_at && <p>✅ 确认: {ticket.acknowledged_at}</p>}
                            {ticket.started_at && <p>🔧 开始: {ticket.started_at}</p>}
                            {ticket.completed_at && <p>✔️ 完成: {ticket.completed_at}</p>}
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-base-content mb-1">指派维修人员</p>
                            <select className="select select-bordered select-sm w-full" value={ticket.assigned_worker_id || 0} onChange={e => onAssign(ticket.id, Number(e.target.value))}>
                              <option value={0}>-- 未指派 --</option>
                              {workers.filter(w => w.status === 'active').map(w => (
                                <option key={w.id} value={w.id}>{w.name} ({WORKER_SPECIALTIES.find(s => s.value === w.specialty)?.label || w.specialty})</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-base-content mb-1">管理备注</p>
                            <textarea
                              className="textarea textarea-bordered textarea-sm w-full"
                              rows={2}
                              value={notesDraft[ticket.id] ?? ticket.admin_notes}
                              onChange={e => setNotesDraft({ ...notesDraft, [ticket.id]: e.target.value })}
                              placeholder="添加备注..."
                            />
                            {notesDraft[ticket.id] !== undefined && notesDraft[ticket.id] !== ticket.admin_notes && (
                              <button className="btn btn-xs btn-primary mt-1" onClick={() => onSaveNotes(ticket.id)}>保存备注</button>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {ticket.status === 'submitted' && (
                              <button className="btn btn-warning btn-sm flex-1" onClick={() => onStatus(ticket.id, 'acknowledged')}>确认工单</button>
                            )}
                            {ticket.status === 'acknowledged' && (
                              <button className="btn btn-primary btn-sm flex-1" onClick={() => onStatus(ticket.id, 'in_progress')}>开始维修</button>
                            )}
                            {ticket.status === 'in_progress' && (
                              <button className="btn btn-success btn-sm flex-1" onClick={() => onStatus(ticket.id, 'completed')}>标记完成</button>
                            )}
                            {!['completed', 'cancelled'].includes(ticket.status) && (
                              <button className="btn btn-ghost btn-sm" onClick={() => onStatus(ticket.id, 'cancelled')}>取消</button>
                            )}
                            <button className="btn btn-error btn-sm btn-outline" onClick={() => setDeleteConfirm({ type: 'ticket', id: ticket.id })}>删除</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'workers' && (
        <div className="space-y-2">
          <button className="btn btn-primary btn-sm w-full" onClick={() => setWf({})}>
            <Plus size={16} /> 添加维修人员
          </button>

          {wf !== null && (
            <div className="card bg-base-300">
              <div className="card-body p-3 space-y-2">
                <input className="input input-bordered input-sm w-full" placeholder="姓名 *" value={wf.name || ''} onChange={e => setWf({ ...wf, name: e.target.value })} />
                <input className="input input-bordered input-sm w-full" placeholder="电话" value={wf.phone || ''} onChange={e => setWf({ ...wf, phone: e.target.value })} />
                <input className="input input-bordered input-sm w-full" placeholder="邮箱" value={wf.email || ''} onChange={e => setWf({ ...wf, email: e.target.value })} />
                <select className="select select-bordered select-sm w-full" value={wf.specialty || 'general'} onChange={e => setWf({ ...wf, specialty: e.target.value })}>
                  {WORKER_SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <textarea className="textarea textarea-bordered textarea-sm w-full" placeholder="备注" rows={2} value={wf.notes || ''} onChange={e => setWf({ ...wf, notes: e.target.value })} />
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm flex-1" onClick={onSaveWorker}>保存</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWf(null)}>取消</button>
                </div>
              </div>
            </div>
          )}

          {workers.length === 0 && wf === null ? (
            <div className="text-center py-12 text-base-content">
              <UserCog size={40} className="mx-auto mb-2 opacity-30" />
              <p>暂无维修人员</p>
            </div>
          ) : (
            workers.map(w => (
              <div key={w.id} className="card bg-base-200">
                <div className="card-body p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">{w.name}</h3>
                      <p className="text-xs text-base-content">
                        {WORKER_SPECIALTIES.find(s => s.value === w.specialty)?.label || w.specialty}
                        {w.phone && ` • 📱 ${w.phone}`}
                      </p>
                      <p className="text-xs text-primary">活跃工单: {w.active_tickets || 0}</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs" onClick={() => setWf(w)}>编辑</button>
                      <button className="btn btn-error btn-xs btn-outline" onClick={() => setDeleteConfirm({ type: 'worker', id: w.id })}>删除</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <ConfirmModal
        open={deleteConfirm !== null}
        message={deleteConfirm?.type === 'worker' ? '确定删除此维修工人？' : '确定删除此维修工单？此操作不可撤销。'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};
