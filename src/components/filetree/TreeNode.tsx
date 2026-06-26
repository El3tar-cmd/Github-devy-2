import { useState } from 'react';
import { FileNode } from '../../types';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen, 
  Trash2, 
  Edit2 
} from 'lucide-react';
import clsx from 'clsx';

export interface TreeNodeProps {
  node: FileNode;
  onSelect: (path: string) => void;
  selectedPath: string | null;
  depth: number;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

export function TreeNode({ 
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
