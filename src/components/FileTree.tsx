import { useState, useRef } from 'react';
import { FileNode } from '../types';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen, 
  Trash2, 
  Edit2, 
  FilePlus, 
  FolderPlus,
  AlertTriangle,
  FolderMinus,
  X,
  Download,
  RefreshCw,
  Upload,
  FileUp,
  FolderUp
} from 'lucide-react';
import clsx from 'clsx';

interface FileTreeProps {
  tree: FileNode[];
  onSelect: (path: string) => void;
  selectedPath: string | null;
  workspaceId: string;
  onRefresh: () => void;
  onDeleteWorkspace?: () => void;
}

export function FileTree({ 
  tree, 
  onSelect, 
  selectedPath, 
  workspaceId, 
  onRefresh,
  onDeleteWorkspace 
}: FileTreeProps) {
  
  // Custom Modal state
  const [activeModal, setActiveModal] = useState<'newFile' | 'newDir' | 'rename' | 'delete' | 'deleteProject' | null>(null);
  const [modalTarget, setModalTarget] = useState<string>('');
  const [inputVal, setInputVal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);

  const uploadSingleFile = (file: File, targetPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          
          const response = await fetch('/api/fs/write', {
            method: 'POST',
            alignContent: 'application/json',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: targetPath,
              content: base64,
              workspaceId,
              encoding: 'base64'
            }),
          } as any);

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP error ${response.status}`);
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error(`فشل قراءة الملف ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setErrorMsg('');
    try {
      for (const file of Array.from(files)) {
        await uploadSingleFile(file, file.name);
      }
      onRefresh();
    } catch (err: any) {
      console.error('File upload failed:', err);
      setErrorMsg(`فشل رفع الملفات: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setErrorMsg('');
    try {
      for (const file of Array.from(files)) {
        // webkitRelativePath contains the full relative path, e.g. "my-folder/sub/file.txt"
        const filePath = file.webkitRelativePath || file.name;
        await uploadSingleFile(file, filePath);
      }
      onRefresh();
    } catch (err: any) {
      console.error('Folder upload failed:', err);
      setErrorMsg(`فشل رفع المجلد: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const triggerFileUploadInput = () => {
    fileUploadInputRef.current?.click();
  };

  const triggerFolderUploadInput = () => {
    folderUploadInputRef.current?.click();
  };

  const handleDownloadZip = async () => {
    if (isZipping) return;
    setIsZipping(true);
    try {
      const link = document.createElement('a');
      link.href = `/api/workspace/export-zip?workspaceId=${encodeURIComponent(workspaceId)}`;
      link.setAttribute('download', `workspace-${workspaceId}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to export zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setErrorMsg('');

    try {
      const reader = new FileReader();
      
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read the ZIP file.'));
        reader.readAsDataURL(file);
      });

      const zipBase64 = await fileDataPromise;

      const response = await fetch('/api/workspace/import-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, zipBase64 }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      onRefresh();
      if (e.target) {
        e.target.value = '';
      }
    } catch (err: any) {
      console.error('Import ZIP failed:', err);
      setErrorMsg(`فشل استيراد مشروع الـ ZIP: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Init modal helper
  const openModal = (action: 'newFile' | 'newDir' | 'rename' | 'delete' | 'deleteProject', target = '') => {
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
      setErrorMsg('الرجا إدخال اسم صحيح');
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
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 w-full">
          <div className="flex items-center gap-1">
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

      {errorMsg && !activeModal && (
        <div className="mx-3 mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] text-rose-400 font-sans flex items-center justify-between gap-2">
          <span className="truncate">{errorMsg}</span>
          <button 
            type="button"
            onClick={() => setErrorMsg('')} 
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
      {activeModal && (
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
                onClick={() => setActiveModal(null)} 
                className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
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
                    onChange={(e) => setInputVal(e.target.value)}
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
                  onClick={() => setActiveModal(null)}
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
      )}
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  onSelect: (path: string) => void;
  selectedPath: string | null;
  depth: number;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

function TreeNode({ 
  node, 
  onSelect, 
  selectedPath, 
  depth, 
  onRename, 
  onDelete 
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedPath === node.path;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDirectory) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div className="group flex flex-col">
      <div 
        className={clsx(
          "flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-all whitespace-nowrap rounded-md relative",
          isSelected 
            ? "bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500" 
            : "text-slate-300 hover:bg-white/5 hover:text-white",
        )}
        style={{ paddingLeft: `${depth * 10 + 6}px`, paddingRight: '8px' }}
        onClick={handleClick}
      >
        {node.isDirectory ? (
          <>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />}
          </>
        ) : (
          <>
             <div className="w-3.5 shrink-0" />
             <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </>
        )}
        <span className="truncate pr-12 text-xs">{node.name}</span>

        {/* Inline Actions (Hammam / Tablet touch visible always, desktop toggles on hover) */}
        <div className="absolute right-1 flex items-center gap-0.5 opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-[#0c0c0e] via-[#0c0c0e]/95 to-transparent pl-3 pr-1 py-0.5 rounded-r-md">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onRename(node.path); 
            }} 
            className="p-1 text-slate-400 hover:text-emerald-400 rounded-md hover:bg-white/10 transition-colors" 
            title="تعديل الاسم"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onDelete(node.path); 
            }} 
            className="p-1 text-slate-400 hover:text-rose-400 rounded-md hover:bg-white/10 transition-colors" 
            title="حذف"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {node.isDirectory && isOpen && node.children && (
        <div className="flex flex-col">
          {node.children.map(child => (
            <TreeNode 
              key={child.path} 
              node={child} 
              onSelect={onSelect} 
              selectedPath={selectedPath} 
              depth={depth + 1} 
              onRename={onRename} 
              onDelete={onDelete} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
