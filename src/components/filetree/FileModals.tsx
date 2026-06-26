import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

export type ModalAction = 'newFile' | 'newDir' | 'rename' | 'delete' | 'deleteProject';

export interface FileModalsProps {
  activeModal: ModalAction | null;
  modalTarget: string;
  inputVal: string;
  isSubmitting: boolean;
  errorMsg: string;
  onInputChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  getModalTitle: () => string;
}

export function FileModals({
  activeModal,
  modalTarget,
  inputVal,
  isSubmitting,
  errorMsg,
  onInputChange,
  onClose,
  onSubmit,
  getModalTitle,
}: FileModalsProps) {
  if (!activeModal) return null;

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-xl max-w-full w-full p-4 shadow-2xl animate-in zoom-in-95 duration-155">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
          <span className="font-sans font-bold text-slate-200 flex items-center gap-1.5">
            {activeModal === 'delete' || activeModal === 'deleteProject' ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : null}
            {getModalTitle()}
          </span>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Message for deletes */}
          {activeModal === 'delete' && (
            <p className="text-xs text-slate-300 font-sans leading-relaxed text-right">
              هل أنت متأكد من حذف <code className="text-rose-400 break-all">{modalTarget}</code>؟ هذا الإجراء لا يمكن التراجع عنه.
            </p>
          )}

          {activeModal === 'deleteProject' && (
            <p className="text-xs text-slate-300 font-sans leading-relaxed text-right">
              هل أنت متأكد من حذف جميع ملفات هذا المشروع بالكامل؟ سيتم تفريغ المجلد النشط وإعادته مجلداً نظيفاً. هذه الخطوة irreversible.
            </p>
          )}

          {/* Text Fields for Addition/Rename */}
          {['newFile', 'newDir', 'rename'].includes(activeModal) && (
            <div className="space-y-1.5">
              <label className="text-right block text-[11px] font-sans text-slate-400">
                {activeModal === 'newFile' && 'اسم الملف الجديد مع الامتداد (مثال: index.html):'}
                {activeModal === 'newDir' && 'اسم المجلد الجديد (مثال: src أو components):'}
                {activeModal === 'rename' && 'الاسم الجديد بالكامل:'}
              </label>
              <input
                autoFocus
                type="text"
                className="w-full bg-[#18181c] text-white rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-emerald-500 font-mono text-sm shadow-inner text-left"
                value={inputVal}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={activeModal === 'newFile' ? 'index.html' : activeModal === 'newDir' ? 'src' : ''}
                disabled={isSubmitting}
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-400 font-sans bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg text-right">
              {errorMsg}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end font-sans">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs transition-colors flex-1 text-center"
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className={clsx(
                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-1 text-center",
                (activeModal === 'delete' || activeModal === 'deleteProject')
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-emerald-500 hover:bg-emerald-400 text-black"
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'جاري التنفيذ...' : (
                (activeModal === 'delete' || activeModal === 'deleteProject') ? 'تأكيد الحذف' : 'حفظ'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
