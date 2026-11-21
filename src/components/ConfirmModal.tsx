import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';

interface ConfirmModalProps {
  core: ImageEditorCore;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ core }) => {
  const { showConfirmModal, setShowConfirmModal, executeEdit } = core;

  if (!showConfirmModal) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white shadow-xl max-w-xs w-full p-5 border border-slate-100 rounded-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-start mb-3 text-slate-900">
          <div className="w-10 h-10 bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner rounded-xl">
            <AlertTriangle size={20} />
          </div>
          <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <h3 className="text-xs font-black mb-1 text-slate-900 text-center">开启新分支？</h3>
        <p className="text-slate-500 text-[9px] mb-4 text-center px-2">此节点后的历史记录将被覆盖。</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowConfirmModal(false)} className="py-2.5 bg-slate-100 text-slate-500 font-black text-[10px] hover:bg-slate-200 rounded-xl transition-colors">
            取消
          </button>
          <button onClick={executeEdit} className="py-2.5 bg-slate-900 text-white font-black text-[10px] hover:bg-slate-800 shadow-lg rounded-xl transition-colors">
            确认
          </button>
        </div>
      </div>
    </div>
  );
};
