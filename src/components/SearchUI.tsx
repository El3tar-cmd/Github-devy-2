import { useState } from 'react';
import { Search, Loader2, FileText, ChevronRight, ChevronDown, CaseSensitive } from 'lucide-react';

interface Props {
  workspaceId: string;
  onOpen: (path: string, line?: number) => void;
}

interface SearchMatch {
  lineNum: number;
  content: string;
}

interface GroupedResults {
  [filePath: string]: SearchMatch[];
}

export function SearchUI({ workspaceId, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<{[key: string]: boolean}>({});

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults('');
    setCollapsedFiles({});

    try {
      const res = await fetch('/api/fs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pattern: query.trim(), 
          workspaceId,
          caseSensitive
        })
      });
      const data = await res.json();
      setResults(data.matches || 'No matches found.');
    } catch (e) {
      setResults('Error searching.');
    } finally {
      setLoading(false);
    }
  };

  // Parse grep output into grouped format
  const groupedResults: GroupedResults = {};
  let totalMatches = 0;

  if (results && results !== 'No matches found.' && results !== 'Error searching.') {
    results.split('\n').filter(Boolean).forEach(line => {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        const [_, file, num, content] = match;
        const cleanFile = file.replace(/^\.\//, '');
        if (!groupedResults[cleanFile]) {
          groupedResults[cleanFile] = [];
        }
        groupedResults[cleanFile].push({ 
          lineNum: parseInt(num, 10), 
          content 
        });
        totalMatches++;
      }
    });
  }

  const toggleFileCollapse = (file: string) => {
    setCollapsedFiles(prev => ({ ...prev, [file]: !prev[file] }));
  };

  const highlightMatch = (text: string, search: string, caseSensitive: boolean) => {
    if (!search) return <span>{text}</span>;
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedSearch})`, flags);
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) => 
            regex.test(part) ? (
              <mark key={i} className="bg-emerald-500/35 text-emerald-300 font-semibold rounded px-0.5 border-b border-emerald-500/50">
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </>
      );
    } catch {
      return <span>{text}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0c0c0e] text-slate-300 h-full overflow-hidden select-none">
       {/* Search Box Header */}
       <div className="p-3 border-b border-white/5 bg-[#0e0e11] shrink-0">
          <form onSubmit={handleSearch} className="flex items-center gap-2 bg-[#171720] px-3 py-2 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/30 border border-white/5 transition-all">
             <Search className="w-4 h-4 text-slate-500 shrink-0" />
             <input 
               autoFocus
               className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-500 font-sans"
               placeholder="البحث في كامل ملفات المشروع..."
               value={query}
               onChange={e => setQuery(e.target.value)}
             />
             
             {/* Case Sensitivity Toggle Button */}
             <button
               type="button"
               onClick={() => {
                 setCaseSensitive(!caseSensitive);
                 // Trigger search again if query is active
                 if (query.trim()) {
                   setTimeout(() => handleSearch(), 50);
                 }
               }}
               className={`p-1 rounded transition-colors ${
                 caseSensitive 
                   ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                   : 'text-slate-500 hover:text-slate-300 border border-transparent'
               }`}
               title="حساسية حالة الأحرف (Case Sensitive)"
             >
               <CaseSensitive className="w-3.5 h-3.5" />
             </button>

             {loading && <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
          </form>

          {/* Stats Bar */}
          {totalMatches > 0 && (
            <div className="mt-2 text-[10px] text-slate-400 font-sans flex items-center justify-between">
              <span>تم العثور على {totalMatches} تطابق في {Object.keys(groupedResults).length} ملف</span>
            </div>
          )}
       </div>

       {/* Results List Area */}
       <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 bg-[#08080b]/50 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="text-xs text-slate-500 font-sans">جاري البحث في الملفات...</span>
            </div>
          ) : results === 'No matches found.' || totalMatches === 0 ? (
            query.trim() ? (
              <div className="text-slate-500 text-xs text-center mt-10 font-sans">
                لا توجد نتائج مطابقة لبحثك.
              </div>
            ) : (
              <div className="text-slate-500 text-xs text-center mt-10 font-sans leading-relaxed">
                اكتب كلمة للبحث عنها في محتويات ملفات المشروع.
              </div>
            )
          ) : results === 'Error searching.' ? (
            <div className="text-rose-400 text-xs text-center mt-10 font-sans">
              حدث خطأ أثناء إجراء البحث. تأكد من تشغيل السيرفر.
            </div>
          ) : (
            Object.entries(groupedResults).map(([filePath, matches]) => {
              const isCollapsed = !!collapsedFiles[filePath];
              return (
                <div key={filePath} className="border border-white/5 rounded-xl bg-[#101014]/40 overflow-hidden transition-all">
                  {/* File Header */}
                  <div 
                    onClick={() => toggleFileCollapse(filePath)}
                    className="flex items-center justify-between p-2.5 hover:bg-white/5 cursor-pointer select-none transition-colors border-b border-white/5 bg-[#121217]/50"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 truncate">
                      <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate text-left" dir="ltr">{filePath}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                        {matches.length}
                      </span>
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Matches Lines (visible if not collapsed) */}
                  {!isCollapsed && (
                    <div className="divide-y divide-white/5 bg-[#09090c]/70 font-mono text-[11px]">
                      {matches.map((m, idx) => (
                        <div 
                          key={idx}
                          onClick={() => onOpen(filePath, m.lineNum)}
                          className="flex items-start gap-3 p-2.5 hover:bg-emerald-500/5 cursor-pointer text-slate-300 hover:text-white transition-colors group select-text text-left"
                        >
                          <span className="text-slate-500 font-mono select-none text-[10px] pt-0.5 w-6 text-right shrink-0">
                            {m.lineNum}
                          </span>
                          <span className="break-all whitespace-pre-wrap flex-1 leading-relaxed">
                            {highlightMatch(m.content, query, caseSensitive)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
       </div>
    </div>
  );
}
