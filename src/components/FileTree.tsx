import { useState } from 'react';
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
  X
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
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 shrink-0 bg-[#0e0e11]">
        <button 
          onClick={() => openModal('newFile')} 
          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded transition-all flex items-center justify-center gap-1"
          title="ملف جديد"
        >
          <FilePlus className="w-4 h-4" />
          <span className="text-[10px] sm:hidden font-sans">ملف</span>
        </button>
        <button 
          onClick={() => openModal('newDir')} 
          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded transition-all flex items-center justify-center gap-1"
          title="مجلد جديد"
        >
          <FolderPlus className="w-4 h-4" />
          <span className="text-[10px] sm:hidden font-sans">مجلد</span>
        </button>

        <span className="h-4 w-[1px] bg-white/10 mx-1" />

        <button 
          onClick={() => openModal('deleteProject')} 
          className="p-1.5 text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all ml-auto flex items-center justify-center gap-1"
          title="حذف المشروع وإعادة التهيئة"
        >
          <FolderMinus className="w-4 h-4" />
          <span className="text-[10px] font-sans font-medium text-rose-400/90">حذف المشروع</span>
        </button>
      </div>

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
