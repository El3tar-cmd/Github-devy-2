import { useState } from 'react';
import { FileNode } from '../../types';
import { 
  FilePlus, 
  FolderPlus,
  FolderMinus,
  FileUp,
  FolderUp,
  Terminal,
  RefreshCw,
  Upload,
  Download
} from 'lucide-react';
import { TreeNode } from './TreeNode';
import { FileModals, ModalAction } from './FileModals';
import { useImportExport } from './ImportExport';
import { TermuxBrowser } from './TermuxBrowser';

export interface FileTreeProps {
  tree: FileNode[];
  onSelect: (path: string) => void;
  selectedPath: string | null;
  workspaceId: string;
  onRefresh: () => void;
  onDeleteWorkspace?: () => void;
  onWorkspaceIdChange?: (id: string) => void;
}

export function FileTree({ 
  tree, 
  onSelect, 
  selectedPath, 
  workspaceId, 
  onRefresh,
  onDeleteWorkspace,
  onWorkspaceIdChange
}: FileTreeProps) {
  
  // Custom Modal state
  const [activeModal, setActiveModal] = useState<ModalAction | null>(null);
  const [modalTarget, setModalTarget] = useState<string>('');
  const [inputVal, setInputVal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showTermuxBrowser, setShowTermuxBrowser] = useState(false);

  // Hook for imports and exports
  const {
    isZipping,
    isImporting,
    errorMsg: importExportError,
    setErrorMsg: setImportExportError,
    fileInputRef,
    fileUploadInputRef,
    folderUploadInputRef,
    handleFilesUpload,
    handleFolderUpload,
    handleDownloadZip,
    handleImportZip,
    triggerFileInput,
    triggerFileUploadInput,
    triggerFolderUploadInput,
  } = useImportExport(workspaceId, onRefresh, onWorkspaceIdChange);

  // Combined error message display
  const activeErrorMsg = errorMsg || importExportError;
  const clearActiveError = () => {
    setErrorMsg('');
    setImportExportError('');
  };

  // Init modal helper
  const openModal = (action: ModalAction, target = '') => {
    setActiveModal(action);
    setModalTarget(target);
    setErrorMsg('');
    
    if (action === 'rename') {
      setInputVal(target);
    } else {
      setInputVal('');
    }
  };

  const handleModalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!activeModal) return;

    // Validation
    if (['newFile', 'newDir', 'rename'].includes(activeModal) && !inputVal.trim()) {
      setErrorMsg('الرجاء إدخال اسم صحيح');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (activeModal === 'newFile') {
        const res = await fetch('/api/fs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: inputVal.trim(), content: '', workspaceId })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'فشل في إنشاء الملف');
        }
      } else if (activeModal === 'newDir') {
        const res = await fetch('/api/fs/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: inputVal.trim(), workspaceId })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'فشل في إنشاء المجلد');
        }
      } else if (activeModal === 'rename') {
        const res = await fetch('/api/fs/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: modalTarget, newPath: inputVal.trim(), workspaceId })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'فشل في إعادة التسمية');
        }
      } else if (activeModal === 'delete') {
        const res = await fetch('/api/fs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: modalTarget, workspaceId })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'فشل في الحذف');
        }
      } else if (activeModal === 'deleteProject') {
        const res = await fetch('/api/workspace/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'فشل في حذف وتفريغ المشروع');
        }
        if (onDeleteWorkspace) {
          onDeleteWorkspace();
        }
      }

      // Success
      setActiveModal(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ ما');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'newFile': return 'ملف جديد';
      case 'newDir': return 'مجلد جديد';
      case 'rename': return 'إعادة تسمية';
      case 'delete': return 'تأكيد الحذف';
      case 'deleteProject': return 'حذف المشروع بالكامل';
      default: return '';
    }
  };

  const handleImportComplete = (folderName: string) => {
    if (onWorkspaceIdChange) {
      onWorkspaceIdChange(folderName);
    } else {
      onRefresh();
    }
    setShowTermuxBrowser(false);
  };

  return (
    <div className="relative h-full flex flex-col text-sm font-mono select-none min-w-[200px] bg-[#0c0c0e]">
      {/* File Tree Header Actions */}
      <div className="flex flex-col gap-1.5 p-2 bg-[#0e0e11] border-b border-white/5 shrink-0 animate-fade-in">
        {/* Row 1: Interactive creation & workspace resets */}
        <div className="flex items-center justify-between gap-1 w-full">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => openModal('newFile')} 
              className="p-1 px-1.5 text-slate-300 hover:text-emerald-400 hover:bg-white/5 rounded border border-white/5 transition-all flex items-center justify-center gap-1"
              title="ملف فارغ جديد"
            >
              <FilePlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-sans font-medium">ملف جديد</span>
            </button>
            <button 
              onClick={() => openModal('newDir')} 
              className="p-1 px-1.5 text-slate-300 hover:text-emerald-400 hover:bg-white/5 rounded border border-white/5 transition-all flex items-center justify-center gap-1"
              title="مجلد فارغ جديد"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-sans font-medium">مجلد جديد</span>
            </button>
          </div>

          <button 
            type="button"
            onClick={() => openModal('deleteProject')} 
            className="p-1 px-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded border border-rose-500/10 transition-all flex items-center justify-center gap-1 text-[10px] font-sans"
            title="حذف المشروع وإعادة التهيئة"
          >
            <FolderMinus className="w-3.5 h-3.5 shrink-0" />
            <span>حذف</span>
          </button>
        </div>

        {/* Row 2: File/Folder Import & ZIP Sync */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-white/5 w-full">
          <div className="flex flex-wrap items-center gap-1">
            <button 
              type="button"
              onClick={triggerFileUploadInput} 
              disabled={isImporting}
              className="p-1 px-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded border border-white/5 transition-all flex items-center justify-center gap-1 disabled:opacity-50 text-[10px] font-sans"
              title="رفع ملفات مستقلة من جهازك"
            >
              <FileUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>رفع ملفات</span>
            </button>

            <button 
              type="button"
              onClick={triggerFolderUploadInput} 
              disabled={isImporting}
              className="p-1 px-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded border border-white/5 transition-all flex items-center justify-center gap-1 disabled:opacity-50 text-[10px] font-sans"
              title="رفع مجلد كامل بجميع تفرعاته"
            >
              <FolderUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>رفع مجلد</span>
            </button>

            <button 
              type="button"
              onClick={() => setShowTermuxBrowser(true)} 
              disabled={isImporting}
              className="p-1 px-1.5 text-slate-400 hover:text-sky-400 hover:bg-white/5 rounded border border-white/5 transition-all flex items-center justify-center gap-1 disabled:opacity-50 text-[10px] font-sans"
              title="استيراد مجلد من داخل Termux"
            >
              <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>مجلد Termux</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={triggerFileInput} 
              disabled={isImporting}
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded transition-all flex items-center justify-center gap-1 disabled:opacity-50 text-[10px] font-sans"
              title="استيراد مشروع ZIP من جهازك"
            >
              {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Upload className="w-3.5 h-3.5" />}
              <span>استيراد ZIP</span>
            </button>

            <button 
              type="button"
              onClick={handleDownloadZip} 
              disabled={isZipping}
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded transition-all flex items-center justify-center gap-1 disabled:opacity-50 text-[10px] font-sans"
              title="تصدير المشروع كملف مضغوط ZIP"
            >
              {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
              <span>تصدير ZIP</span>
            </button>
          </div>
        </div>

        {/* Hidden native input pickers for absolute local import integrity */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImportZip} 
          accept=".zip" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={fileUploadInputRef} 
          onChange={handleFilesUpload} 
          multiple 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={folderUploadInputRef} 
          onChange={handleFolderUpload} 
          {...{ webkitdirectory: "", directory: "" } as any}
          multiple 
          className="hidden" 
        />
      </div>

      {activeErrorMsg && !activeModal && (
        <div className="mx-3 mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] text-rose-400 font-sans flex items-center justify-between gap-2">
          <span className="truncate">{activeErrorMsg}</span>
          <button 
            type="button"
            onClick={clearActiveError} 
            className="text-rose-400 hover:text-white font-bold px-1 text-sm shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto px-1 py-1.5 min-h-0">
        {!tree || tree.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center font-sans">
            لا توجد ملفات حالية. ابدأ بإضافة ملف جديد أو مجلد.
          </div>
        ) : (
          tree.map(node => (
            <TreeNode 
              key={node.path} 
              node={node} 
              onSelect={onSelect} 
              selectedPath={selectedPath} 
              depth={0} 
              onRename={(path) => openModal('rename', path)}
              onDelete={(path) => openModal('delete', path)}
            />
          ))
        )}
      </div>

      {/* Custom Modal Prompt Overlay */}
      <FileModals
        activeModal={activeModal}
        modalTarget={modalTarget}
        inputVal={inputVal}
        isSubmitting={isSubmitting}
        errorMsg={errorMsg}
        onInputChange={setInputVal}
        onClose={() => setActiveModal(null)}
        onSubmit={handleModalSubmit}
        getModalTitle={getModalTitle}
      />

      {/* Termux Directory Browser Modal */}
      {showTermuxBrowser && (
        <TermuxBrowser
          workspaceId={workspaceId}
          isImporting={isImporting}
          errorMsg={importExportError}
          onClose={() => setShowTermuxBrowser(false)}
          onImportComplete={handleImportComplete}
          onRefresh={onRefresh}
          setErrorMsg={setImportExportError}
          setIsImporting={() => {}}
        />
      )}
    </div>
  );
}
