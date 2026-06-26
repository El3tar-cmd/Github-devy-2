import { useEffect, useState } from 'react';
import { GitBranch, RefreshCw, GitCommit, ArrowUp, ArrowDown, FileText, Loader2, GitFork, AlertTriangle } from 'lucide-react';

interface Props {
  workspaceId: string;
  onOpenFile: (path: string) => void;
  onRefreshWorkspace: () => void;
}

interface GitFile {
  path: string;
  state: 'modified' | 'untracked' | 'added' | 'deleted';
}

export function GitUI({ workspaceId, onOpenFile, onRefreshWorkspace }: Props) {
  const [isRepository, setIsRepository] = useState<boolean | null>(null);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchGitStatus = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/git/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      const data = await res.json();
      if (res.ok) {
        setIsRepository(data.isRepository);
        setCurrentBranch(data.currentBranch);
        setFiles(data.files || []);
      } else {
        setError(data.error || 'فشل تحميل حالة Git');
      }
    } catch (err: any) {
      setError(`خطأ في الاتصال: ${err.message}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchGitStatus();
  }, [workspaceId]);

  const handleInitRepo = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/git/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      if (res.ok) {
        setSuccessMsg('تم تهيئة مستودع Git بنجاح!');
        fetchGitStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'فشل تهيئة المستودع');
      }
    } catch (err: any) {
      setError(`خطأ: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, message: commitMessage.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setCommitMessage('');
        setSuccessMsg('تم حفظ التغييرات وعمل Commit بنجاح!');
        fetchGitStatus();
        onRefreshWorkspace();
      } else {
        setError(data.error || 'فشل تنفيذ Commit');
      }
    } catch (err: any) {
      setError(`خطأ: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePush = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      if (res.ok) {
        setSuccessMsg('تم رفع التغييرات (Push) إلى GitHub بنجاح!');
        fetchGitStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'فشل رفع التغييرات. تأكد من إعداد الـ Origin والتوكن.');
      }
    } catch (err: any) {
      setError(`خطأ: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePull = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('تم سحب التحديثات (Pull) من GitHub بنجاح!');
        fetchGitStatus();
        onRefreshWorkspace();
      } else {
        setError(data.error || 'فشل سحب التحديثات.');
      }
    } catch (err: any) {
      setError(`خطأ: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'untracked':
        return <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/10 font-bold shrink-0">U (جديد)</span>;
      case 'added':
        return <span className="text-[9px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/10 font-bold shrink-0">A (مضاف)</span>;
      case 'deleted':
        return <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/10 font-bold shrink-0">D (محذوف)</span>;
      default:
        return <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/10 font-bold shrink-0">M (معدل)</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0c0c0e] text-slate-300 h-full overflow-hidden select-none">
      {/* Git Header */}
      <div className="p-3 border-b border-white/5 bg-[#0e0e11] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">التحكم في الإصدار (Git UI)</span>
        </div>
        <button
          onClick={() => fetchGitStatus(true)}
          disabled={loading || actionLoading}
          className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white disabled:opacity-50"
          title="تحديث حالة المستودع"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0 flex flex-col">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-lg text-xs leading-relaxed font-sans shrink-0 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-lg text-xs leading-relaxed font-sans shrink-0">
            {successMsg}
          </div>
        )}

        {isRepository === null && loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="text-xs text-slate-500 font-sans">جاري تحميل حالة المستودع...</span>
          </div>
        ) : isRepository === false ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center gap-4">
            <div className="p-4 rounded-full bg-slate-500/5 border border-white/5 text-slate-500">
              <GitFork className="w-10 h-10" />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h4 className="text-sm font-semibold text-slate-300 font-sans">لا يوجد مستودع Git نشط</h4>
              <p className="text-xs text-slate-500 font-sans leading-relaxed">
                مساحة العمل الحالية ليست مستودع Git بعد. يمكنك تهيئة مستودع جديد للبدء في تتبع ملفاتك.
              </p>
            </div>
            <button
              onClick={handleInitRepo}
              disabled={actionLoading}
              className="mt-2 w-full max-w-xs px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-500/5"
            >
              {actionLoading ? 'جاري التهيئة...' : 'تهيئة مستودع Git جديد'}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Repo Info Header */}
            <div className="p-3 bg-[#101014]/60 border border-white/5 rounded-xl flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-semibold font-mono text-sky-400">{currentBranch}</span>
              </div>
              
              {/* Sync Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePull}
                  disabled={actionLoading}
                  className="px-2.5 py-1 bg-[#171720] hover:bg-[#20202b] text-slate-300 text-[10px] font-sans rounded-lg transition-colors border border-white/5 flex items-center gap-1"
                  title="سحب التحديثات من GitHub"
                >
                  <ArrowDown className="w-3 h-3 text-emerald-400" />
                  <span>Pull</span>
                </button>
                <button
                  onClick={handlePush}
                  disabled={actionLoading}
                  className="px-2.5 py-1 bg-[#171720] hover:bg-[#20202b] text-slate-300 text-[10px] font-sans rounded-lg transition-colors border border-white/5 flex items-center gap-1"
                  title="رفع التحديثات إلى GitHub"
                >
                  <ArrowUp className="w-3 h-3 text-sky-400" />
                  <span>Push</span>
                </button>
              </div>
            </div>

            {/* Changed Files List */}
            <div className="flex-1 overflow-y-auto border border-white/5 rounded-xl bg-[#08080b]/40 p-1.5 min-h-[150px] space-y-1.5">
              <div className="text-[10px] text-slate-500 font-semibold px-2 py-1 uppercase tracking-wider">
                التغييرات قيد التتبع ({files.length})
              </div>
              {files.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-sans leading-relaxed">
                  لا توجد تغييرات غير محفوظة في هذا المشروع. كل شيء نظيف!
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {files.map(file => (
                    <div
                      key={file.path}
                      onClick={() => {
                        if (file.state !== 'deleted') {
                          onOpenFile(file.path);
                        }
                      }}
                      className="flex items-center justify-between gap-3 px-2.5 py-2 hover:bg-white/5 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer select-text text-left"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate" dir="ltr">{file.path}</span>
                      </div>
                      {getStateBadge(file.state)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commit Form (Sticky at bottom) */}
            {files.length > 0 && (
              <form onSubmit={handleCommit} className="space-y-2 pt-2 border-t border-white/5 shrink-0">
                <input
                  type="text"
                  value={commitMessage}
                  onChange={e => setCommitMessage(e.target.value)}
                  placeholder="رسالة الـ Commit (مثال: تحديث محتويات الملف...)"
                  className="w-full bg-[#09090c] text-white rounded-xl px-3 py-2 outline-none border border-white/5 focus:ring-1 focus:ring-emerald-500/50 text-xs font-sans placeholder:text-slate-500"
                  disabled={actionLoading}
                  required
                />
                <button
                  type="submit"
                  disabled={actionLoading || !commitMessage.trim()}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <GitCommit className="w-4 h-4" />
                  <span>حفظ التغييرات وعمل Commit</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
