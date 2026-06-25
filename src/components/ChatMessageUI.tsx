import { ChatMessage, ToolInvocation } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDashed,
  Code2,
  Cpu,
  Database,
  FilePenLine,
  FileText,
  FolderTree,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  Search,
  Terminal,
  Wrench,
} from 'lucide-react';
import clsx from 'clsx';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatMessageUI({ msg }: { msg: ChatMessage }) {
  if (msg.hidden) {
    return null;
  }

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
         {msg.costUsd !== undefined && (msg.inputTokens !== undefined || msg.outputTokens !== undefined) && (
            <div className="flex items-center gap-2 mb-2 font-mono text-[10px] text-slate-500 bg-white/[0.02] border border-white/5 w-fit px-2 py-0.5 rounded-full select-none">
              <span>Cost: <span className="text-emerald-400">${msg.costUsd.toFixed(6)}</span></span>
              <span className="text-slate-600">|</span>
              <span>Tokens: {msg.inputTokens || 0} in / {msg.outputTokens || 0} out</span>
            </div>
         )}
         {msg.content && (
            <div className={clsx("break-words overflow-hidden w-full max-w-full", isUser && "whitespace-pre-wrap", !isUser && "prose prose-invert prose-emerald max-w-none prose-pre:bg-[#151519] prose-pre:border prose-pre:border-white/10 prose-headings:text-emerald-50 prose-a:text-emerald-400 prose-p:text-slate-300")}>
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
  const parsedResult = parseMaybeJson(inv.result);
  const toolMeta = getToolMeta(inv.name);
  const ToolIcon = toolMeta.icon;
  const argsText = formatValue(inv.args);
  const resultText = formatValue(parsedResult ?? inv.result ?? 'Waiting for result');
  const chips = getToolChips(inv.name, inv.args, parsedResult);

  const statusClass = clsx(
    'border font-mono text-[10px] uppercase tracking-wide',
    inv.status === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    inv.status === 'error' && 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    inv.status === 'running' && 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  );

  const renderStatusIcon = () => {
    if (inv.status === 'running') return <CircleDashed className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    if (inv.status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
  };

  const renderPrimaryOutput = () => {
    if (inv.name === 'browser_screenshot' && parsedResult && typeof parsedResult === 'object') {
      const screenshot = (parsedResult as any).screenshot;
      if (typeof screenshot === 'string' && screenshot.startsWith('data:image/png;base64,')) {
        return (
          <div className="space-y-2">
            <div className="p-2 bg-[#101014] rounded-lg border border-white/10 max-w-full overflow-hidden">
              <img
                src={screenshot}
                alt="Browser Sandbox Screenshot"
                className="rounded-md max-w-full h-auto border border-white/10 object-contain mx-auto"
                style={{ maxHeight: '450px' }}
              />
            </div>
            {(parsedResult as any).message && (
              <pre className="text-[11px] font-mono text-slate-400 m-0 leading-relaxed whitespace-pre-wrap break-words">
                {(parsedResult as any).message}
              </pre>
            )}
          </div>
        );
      }
    }

    return (
      <pre className="text-[11px] md:text-xs font-mono text-slate-300 m-0 leading-relaxed whitespace-pre-wrap break-words max-h-[360px] overflow-auto pr-1">
        {resultText}
      </pre>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-white/10 bg-[#141419] overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.18)]"
    >
      <div className="px-3 md:px-4 py-3 bg-[#181820] border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={clsx('w-8 h-8 rounded-md flex items-center justify-center border shrink-0', toolMeta.iconClass)}>
              <ToolIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs md:text-sm font-semibold text-slate-100">{toolMeta.label}</span>
                <span className="font-mono text-[10px] text-slate-500">{inv.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {chips.map((chip, idx) => (
                  <span
                    key={`${chip}-${idx}`}
                    className="max-w-full rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slate-400 break-all"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {renderStatusIcon()}
            <span className={clsx('rounded-full px-2 py-0.5', statusClass)}>{inv.status}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="border-b md:border-b-0 md:border-r border-white/10 bg-[#101014] p-3 md:p-4 min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Cpu className="w-3.5 h-3.5" />
            <span>Input</span>
          </div>
          <pre className="text-[11px] md:text-xs font-mono text-slate-300 m-0 leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-auto pr-1">
            {argsText || '{}'}
          </pre>
        </div>

        <div className="bg-[#0e0e12] p-3 md:p-4 min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Wrench className="w-3.5 h-3.5" />
            <span>{inv.status === 'running' ? 'Live Output' : 'Output'}</span>
          </div>
          {renderPrimaryOutput()}
        </div>
      </div>
    </motion.div>
  );
}

function parseMaybeJson(value?: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function getToolMeta(name: string) {
  if (name.includes('command') || name.startsWith('debug_') || name === 'run_command') {
    return { label: 'Terminal Action', icon: Terminal, iconClass: 'bg-blue-500/10 border-blue-500/25 text-blue-300' };
  }
  if (name.includes('write') || name.includes('replace') || name.includes('rename') || name.includes('delete')) {
    return { label: 'File Edit', icon: FilePenLine, iconClass: 'bg-amber-500/10 border-amber-500/25 text-amber-300' };
  }
  if (name.includes('read_file') || name.includes('file')) {
    return { label: 'File Read', icon: FileText, iconClass: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-300' };
  }
  if (name.includes('list_directory')) {
    return { label: 'Workspace Scan', icon: FolderTree, iconClass: 'bg-slate-500/10 border-slate-500/25 text-slate-300' };
  }
  if (name.includes('search') || name.includes('rag')) {
    return { label: 'Search', icon: Search, iconClass: 'bg-violet-500/10 border-violet-500/25 text-violet-300' };
  }
  if (name.includes('browser') || name.includes('web')) {
    return { label: name.includes('screenshot') ? 'Visual Capture' : 'Web Action', icon: name.includes('screenshot') ? ImageIcon : Globe, iconClass: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' };
  }
  if (name.includes('database')) {
    return { label: 'Database Action', icon: Database, iconClass: 'bg-fuchsia-500/10 border-fuchsia-500/25 text-fuchsia-300' };
  }
  if (name.includes('subagent') || name.includes('agent_task')) {
    return { label: 'Sub-Agent Action', icon: Bot, iconClass: 'bg-orange-500/10 border-orange-500/25 text-orange-300' };
  }
  if (name === 'ask_human') {
    return { label: 'Human Input', icon: MessageSquare, iconClass: 'bg-rose-500/10 border-rose-500/25 text-rose-300' };
  }
  return { label: 'Tool Action', icon: Code2, iconClass: 'bg-slate-500/10 border-slate-500/25 text-slate-300' };
}

function getToolChips(name: string, args: any, result: unknown): string[] {
  const chips: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    const text = String(value);
    chips.push(`${label}: ${text.length > 96 ? `${text.slice(0, 96)}...` : text}`);
  };

  add('path', args?.path || args?.filePath || args?.targetPath);
  add('command', args?.command);
  add('query', args?.query || args?.pattern);
  add('url', args?.url);
  add('agent', args?.agentName || args?.agentId || args?.agentType);
  add('task', args?.taskId || args?.task);
  add('session', args?.sessionId);

  if (result && typeof result === 'object') {
    const obj = result as any;
    add('status', obj.status);
    add('taskId', obj.taskId);
    add('agent', obj.agentName || obj.agentId);
    add('bytes', obj.bytesWritten);
    if (Array.isArray(obj.agents)) add('agents', obj.agents.length);
    if (Array.isArray(obj.tasks)) add('tasks', obj.tasks.length);
    if (obj.path && !chips.some((chip) => chip.startsWith('path:'))) add('path', obj.path);
  }

  if (chips.length === 0) {
    add('tool', name);
  }

  return chips.slice(0, 6);
}
