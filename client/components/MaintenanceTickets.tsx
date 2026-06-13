import React, { useEffect, useState } from 'react';
import { Wrench, Plus, ChevronDown, ChevronUp, Camera, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { MaintenanceTicket, Worker, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, WORKER_SPECIALTIES } from '../types';
import { getTickets, getWorkers, updateTicketStatus, assignWorkerToTicket, updateTicketNotes, deleteTicket } from '../utils/db';
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
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [photoViewer, setPhotoViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);

  useEffect(() => { load(); }, [refreshKey]);

  async function load() {
    setLoading(true);
    try { const t = await getTickets(); setTickets(t); } catch (e) { console.error('getTickets error:', e); }
    try { const w = await getWorkers(); setWorkers(w); } catch (e) { console.error('getWorkers error:', e); }
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

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'ticket'; id: number } | null>(null);

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    await deleteTicket(id);
    setExpandedId(null);
    onRefresh();
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><span className="loading loading-spinner loading-lg text-primary" /></div>;

  return (
    <div className="space-y-3">
      {(true) && (
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
                                  <img key={i} src={p} alt={`Photo ${i + 1}`} className="w-24 h-24 object-cover rounded-lg shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={(e) => { e.stopPropagation(); setPhotoZoom(1); setPhotoViewer({ photos, index: i }); }} />
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

      <ConfirmModal
        open={deleteConfirm !== null}
        message={'确定删除此维修工单？此操作不可撤销。'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Photo Viewer Modal */}
      {photoViewer && (
        <div className="modal modal-open" style={{ zIndex: 9999 }} onClick={() => setPhotoViewer(null)}>
          <div className="modal-box max-w-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">📷 照片 ({photoViewer.index + 1}/{photoViewer.photos.length})</h3>
              <a href={photoViewer.photos[photoViewer.index]} download={`photo_${photoViewer.index + 1}.jpg`} className="btn btn-sm btn-circle btn-ghost" title="下载图片"><Download size={18} /></a>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setPhotoViewer(null)}><X size={18} /></button>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              {photoViewer.photos.length > 1 && (
                <button className="btn btn-sm btn-ghost" onClick={() => setPhotoViewer(v => v ? { ...v, index: (v.index - 1 + v.photos.length) % v.photos.length } : null)}><ChevronLeft size={18} /></button>
              )}
              <button className="btn btn-xs btn-ghost gap-1" onClick={() => setPhotoZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut size={14} /></button>
              <span className="text-xs font-mono min-w-[40px] text-center">{Math.round(photoZoom * 100)}%</span>
              <button className="btn btn-xs btn-ghost gap-1" onClick={() => setPhotoZoom(z => Math.min(3, z + 0.25))}><ZoomIn size={14} /></button>
              {photoZoom !== 1 && <button className="btn btn-xs btn-ghost gap-1" onClick={() => setPhotoZoom(1)}><RotateCcw size={14} /></button>}
              {photoViewer.photos.length > 1 && (
                <button className="btn btn-sm btn-ghost" onClick={() => setPhotoViewer(v => v ? { ...v, index: (v.index + 1) % v.photos.length } : null)}><ChevronRight size={18} /></button>
              )}
            </div>
            <div className="flex justify-center overflow-auto max-h-[70vh] bg-base-200 rounded-lg">
              <img src={photoViewer.photos[photoViewer.index]} alt="照片" className="rounded-lg transition-transform" style={{ transform: `scale(${photoZoom})`, transformOrigin: 'top center' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
