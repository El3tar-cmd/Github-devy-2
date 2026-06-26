import { useState, useEffect } from 'react';
import { 
  Folder,
  Terminal, 
  X, 
  RefreshCw 
} from 'lucide-react';

export interface TermuxBrowserProps {
  workspaceId: string;
  isImporting: boolean;
  errorMsg: string;
  onClose: () => void;
  onImportComplete: (folderName: string) => void;
  onRefresh: () => void;
  setErrorMsg: (msg: string) => void;
  setIsImporting: (val: boolean) => void;
}

export function TermuxBrowser({
  workspaceId,
  isImporting,
  errorMsg,
  onClose,
  onImportComplete,
  onRefresh,
  setErrorMsg,
  setIsImporting,
}: TermuxBrowserProps) {
  const [termuxPath, setTermuxPath] = useState('');
  const [termuxDirs, setTermuxDirs] = useState<string[]>([]);
  const [isBrowsingLoading, setIsBrowsingLoading] = useState(false);
  const [termuxError, setTermuxError] = useState('');

  const fetchTermuxDirs = async (path: string) => {
    setIsBrowsingLoading(true);
    setTermuxError('');
    try {
      const response = await fetch('/api/workspace/list-local-dirs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localPath: path }),
      });
      const data = await response.json();
      if (response.ok) {
        setTermuxPath(data.currentPath);
        setTermuxDirs(data.dirs);
      } else {
        setTermuxError(data.error || 'فشل تحميل المجلدات');
      }
    } catch (err: any) {
      console.error('Failed to fetch Termux directories:', err);
      setTermuxError(`فشل الاتصال بالسيرفر: ${err.message}`);
    } finally {
      setIsBrowsingLoading(false);
    }
  };

  const handleImportSelectedTermuxFolder = async (path: string) => {
    setIsImporting(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/workspace/import-local-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          localPath: path,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onImportComplete(data.folderName);
        onClose();
        alert(`تم استيراد المجلد "${data.folderName}" بنجاح وتعيينه كمساحة العمل النشطة!`);
      } else {
        setErrorMsg(data.error || 'فشل استيراد المجلد');
      }
    } catch (err: any) {
      console.error('Local folder import failed:', err);
      setErrorMsg(`خطأ أثناء الاستيراد: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Trigger initial directory fetch on mount
  useEffect(() => {
    fetchTermuxDirs('');
  }, []);

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-50 flex flex-col justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-xl max-w-full w-full h-[85%] flex flex-col p-4 shadow-2xl animate-in zoom-in-95 duration-155">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <span className="font-sans font-bold text-slate-200 flex items-center gap-1.5 text-sm">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>تصفح مجلدات Termux المحلية</span>
          </span>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Path display */}
        <div className="my-2 p-2 bg-[#18181c] rounded border border-white/5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400 select-all font-mono break-all text-left flex-1">
            {termuxPath}
          </span>
          <button
            onClick={() => {
              const parent = termuxPath.substring(0, termuxPath.lastIndexOf('/'));
              fetchTermuxDirs(parent || '/');
            }}
            disabled={termuxPath === '/' || isBrowsingLoading}
            className="px-2 py-0.5 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded text-slate-300 disabled:opacity-50 shrink-0 font-sans"
          >
            المجلد الأعلى ↑
          </button>
        </div>

        {/* Dir List Container */}
        <div className="flex-1 overflow-y-auto border border-white/5 rounded-lg bg-[#0e0e11] p-1.5 min-h-0">
          {isBrowsingLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-xs text-slate-500 font-sans">جاري تحميل المجلدات...</span>
            </div>
          ) : termuxError ? (
            <div className="p-4 text-center text-xs text-rose-400 font-sans">
              {termuxError}
            </div>
          ) : termuxDirs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-sans">
              لا توجد مجلدات فرعية هنا
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {termuxDirs.map(dirName => (
                <button
                  key={dirName}
                  type="button"
                  onClick={() => fetchTermuxDirs(termuxPath === '/' ? `/${dirName}` : `${termuxPath}/${dirName}`)}
                  className="flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 rounded text-slate-300 hover:text-white text-xs text-right font-sans transition-colors w-full"
                >
                  <Folder className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="truncate">{dirName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Message if importing fails */}
        {errorMsg && (
          <p className="mt-2 text-xs text-rose-400 font-sans bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg text-right">
            {errorMsg}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3 pt-2 border-t border-white/5 font-sans shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs transition-colors flex-1 text-center"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => handleImportSelectedTermuxFolder(termuxPath)}
            disabled={isImporting || isBrowsingLoading}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-black rounded-lg text-xs font-semibold transition-colors flex-1 text-center"
          >
            {isImporting ? 'جاري الاستيراد...' : 'استيراد هذا المجلد هنا'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to manage the Termux browser open/close state and provide the open handler
export function useTermuxBrowser() {
  const [showTermuxBrowser, setShowTermuxBrowser] = useState(false);

  const handleOpenTermuxBrowser = () => {
    setShowTermuxBrowser(true);
  };

  return {
    showTermuxBrowser,
    setShowTermuxBrowser,
    handleOpenTermuxBrowser,
  };
}
