import React from 'react';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<Props> = ({
  open, title = '⚠️ 确认操作', message, confirmLabel = '确认删除', onConfirm, onCancel
}) => {
  if (!open) return null;
  return (
    <div className="modal modal-open" style={{zIndex:9999}}>
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg text-error">{title}</h3>
        <p className="py-4 text-sm">{message}</p>
        <div className="modal-action">
          <button className="btn btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-sm btn-error" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel}></div>
    </div>
  );
};
