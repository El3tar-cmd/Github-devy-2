import { ChatMessage, ToolInvocation } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronDown, ChevronRight, CheckCircle2, CircleDashed, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatMessageUI({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === 'assistant';
  const isUser = msg.role === 'user';
  const isTool = msg.role === 'tool';
  const isSystem = msg.role === 'system';

  if (isTool) {
    return null; // Tools don't render standalone visually
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex gap-3 md:gap-4 p-4 md:p-5 rounded-2xl mb-4 text-sm leading-relaxed overflow-hidden max-w-full', 
         isUser ? 'bg-[#2a2a32] text-slate-100 ml-auto w-fit max-w-[85%] border border-[#34343d] items-center': 
         isSystem ? 'bg-rose-900/30 text-rose-300 border border-rose-500/30 font-mono w-full':
         'bg-transparent text-slate-300 w-full')}
    >
      {!isUser && !isSystem && (
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
          <Bot className="w-5 h-5 text-emerald-400" />
        </div>
      )}

      <div className="flex-1 overflow-x-hidden min-w-0 w-full max-w-full">
         {msg.content && (
            <div className={clsx("break-words overflow-hidden w-full max-w-full", !isUser && "prose prose-invert prose-emerald max-w-none prose-pre:bg-[#151519] prose-pre:border prose-pre:border-white/10 prose-headings:text-emerald-50 prose-a:text-emerald-400 prose-p:text-slate-300")}>
               {isUser ? msg.content : (
                  <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
               )}
            </div>
         )}
         
         {msg.toolInvocations && msg.toolInvocations.length > 0 && (
            <div className="mt-4 space-y-3">
               <AnimatePresence>
                  {msg.toolInvocations.map((inv, idx) => (
                     <ToolInvocationCard key={idx} inv={inv} />
                  ))}
               </AnimatePresence>
            </div>
         )}
      </div>
    </motion.div>
  );
}

function ToolInvocationCard({ inv }: { inv: ToolInvocation }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-white/5 bg-[#1e1e24] overflow-hidden"
    >
       <div 
         onClick={() => setExpanded(!expanded)}
         className="px-3 md:px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors gap-3"
       >
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 overflow-hidden">
             {inv.status === 'running' && <CircleDashed className="w-4 h-4 text-blue-400 animate-spin shrink-0" />}
             {inv.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
             {inv.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
             
             <span className="font-mono text-[11px] md:text-xs text-slate-300 font-semibold shadow-sm shrink-0">
                {inv.name}
             </span>
             <span className="font-mono text-[11px] md:text-xs text-slate-500 truncate min-w-0 flex-1 ml-1 md:ml-2">
                {JSON.stringify(inv.args)}
             </span>
          </div>
          <button className="text-slate-500 shrink-0 ml-1">
             {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
       </div>
       
       <AnimatePresence>
          {expanded && (
             <motion.div 
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: 'auto', opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
               className="border-t border-white/5 bg-[#151519] overflow-hidden text-xs"
             >
                <div className="p-4 space-y-4">
                   <div>
                      <div className="text-slate-500 font-mono mb-1 text-[10px] uppercase tracking-wider">Arguments</div>
                      <pre className="text-[11px] font-mono text-emerald-400/80 m-0 leading-relaxed whitespace-pre-wrap break-words bg-[#1a1a21] p-3 rounded-lg border border-white/5">
                        {JSON.stringify(inv.args, null, 2)}
                      </pre>
                   </div>
                   
                   {inv.result ? (
                     <div>
                        <div className="text-slate-500 font-mono mb-1 text-[10px] uppercase tracking-wider">Result</div>
                        <pre className="text-[11px] font-mono text-slate-300 m-0 leading-relaxed whitespace-pre-wrap break-words bg-[#1a1a21] p-3 rounded-lg border border-white/5">
                          {inv.result.length > 5000 ? '...[truncated]\n' + inv.result.substring(inv.result.length - 5000) : inv.result}
                        </pre>
                     </div>
                   ) : (
                     <div className="text-slate-500 text-[11px] italic">Waiting for result...</div>
                   )}
                </div>
             </motion.div>
          )}
       </AnimatePresence>
    </motion.div>
  );
}
