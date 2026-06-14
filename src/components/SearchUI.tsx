import { useState } from 'react';
import { Search, Loader2, FileText, ChevronRight } from 'lucide-react';

interface Props {
  workspaceId: string;
  onOpen: (path: string) => void;
}

export function SearchUI({ workspaceId, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    setResults('');
    try {
      const res = await fetch('/api/fs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: query, workspaceId })
      });
      const data = await res.json();
      setResults(data.matches || 'No matches found.');
    } catch (e) {
      setResults('Error searching.');
    } finally {
      setLoading(false);
    }
  };

  const parsedResults = results ? results.split('\n').filter(Boolean) : [];

  return (
    <div className="flex-1 flex flex-col bg-[#0b0b0e] text-slate-300">
       <div className="p-4 border-b border-white/5 shrink-0">
          <form onSubmit={handleSearch} className="flex items-center gap-2 bg-[#1e1e24] px-3 py-2 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/50">
             <Search className="w-4 h-4 text-slate-500 shrink-0" />
             <input 
               autoFocus
               className="flex-1 bg-transparent border-none outline-none text-sm text-white"
               placeholder="Search files (e.g., functionName)"
               value={query}
               onChange={e => setQuery(e.target.value)}
             />
             {loading && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
          </form>
       </div>
       <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {parsedResults.map((line, i) => {
             const match = line.match(/^([^:]+):(\d+):(.*)$/);
             if (!match) return <div key={i} className="text-xs font-mono text-slate-500 p-2">{line}</div>;
             const [_, file, num, content] = match;
             return (
               <div 
                 key={i} 
                 onClick={() => onOpen(file.replace(/^\.\//, ''))}
                 className="flex flex-col p-2 hover:bg-white/5 rounded-lg cursor-pointer group"
               >
                 <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                   <FileText className="w-3.5 h-3.5" /> 
                   {file} <span className="text-slate-500 font-mono">:{num}</span>
                 </div>
                 <div className="text-[11px] font-mono text-slate-400 mt-1 pl-5 truncate group-hover:text-slate-300">
                   {content.trim()}
                 </div>
               </div>
             )
          })}
          {parsedResults.length === 0 && !loading && <div className="text-slate-500 text-sm text-center mt-10">No results found or search not started.</div>}
       </div>
    </div>
  );
}
