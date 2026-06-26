import { useState } from 'react';
import { ChatMessage, ToolInvocation } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
  if (msg.hidden) return null;

  const isUser = msg.role === 'user';
  const isTool = msg.role === 'tool';
  const isSystem = msg.role === 'system';

  if (isTool) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'flex gap-3 md:gap-4 p-4 md:p-5 rounded-2xl mb-4 text-sm leading-relaxed overflow-hidden max-w-full',
        isUser
          ? 'bg-[#2a2a32] text-slate-100 ml-auto w-fit max-w-[85%] border border-[#34343d] items-center'
          : isSystem
          ? 'bg-rose-900/30 text-rose-300 border border-rose-500/30 font-mono w-full'
          : 'bg-transparent text-slate-300 w-full'
      )}
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
          <div className={clsx(
            'break-words overflow-hidden w-full max-w-full',
            isUser && 'whitespace-pre-wrap',
            !isUser && 'prose prose-invert prose-emerald max-w-none prose-pre:bg-[#151519] prose-pre:border prose-pre:border-white/10 prose-headings:text-emerald-50 prose-a:text-emerald-400 prose-p:text-slate-300'
          )}>
            {isUser ? msg.content : <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>}
          </div>
        )}

        {msg.toolInvocations && msg.toolInvocations.length > 0 && (
          <div className="mt-3 space-y-2">
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
  const isRunning = inv.status === 'running';
  const [isExpanded, setIsExpanded] = useState(isRunning);

  const parsedResult = parseMaybeJson(inv.result);
  const toolMeta = getToolMeta(inv.name);
  const ToolIcon = toolMeta.icon;
  const argsText = formatValue(inv.args);
  const resultText = formatValue(parsedResult ?? inv.result ?? 'Waiting for result…');
  const chips = getToolChips(inv.name, inv.args, parsedResult);

  const statusClass = clsx(
    'border font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full',
    inv.status === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    inv.status === 'error'   && 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    inv.status === 'running' && 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  );

  const renderStatusIcon = () => {
    if (isRunning)               return <CircleDashed className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />;
    if (inv.status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    return <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
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
                style={{ maxHeight: '420px' }}
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
      <pre className="text-[11px] font-mono text-slate-300 m-0 leading-relaxed whitespace-pre-wrap break-words max-h-[320px] overflow-auto pr-1">
        {resultText}
      </pre>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-white/[0.07] bg-[#111116] overflow-hidden shadow-md"
    >
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        className="w-full px-3 py-2.5 bg-[#16161e] border-b border-white/[0.07] flex items-center justify-between gap-3 hover:bg-[#1a1a24] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Icon */}
          <div className={clsx('w-6 h-6 rounded flex items-center justify-center border shrink-0', toolMeta.iconClass)}>
            <ToolIcon className="w-3.5 h-3.5" />
          </div>

          {/* Name + chips */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-100">{toolMeta.label}</span>
              <span className="font-mono text-[10px] text-slate-600">{inv.name}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {chips.map((chip, idx) => (
                <span
                  key={`${chip}-${idx}`}
                  className="max-w-[220px] truncate rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-px font-mono text-[10px] text-slate-400"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Status + chevron */}
        <div className="flex items-center gap-1.5 shrink-0">
          {renderStatusIcon()}
          <span className={statusClass}>{inv.status}</span>
          {isExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          }
        </div>
      </button>

      {/* ── Expandable body ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid gap-0 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              {/* Input */}
              <div className="border-b md:border-b-0 md:border-r border-white/[0.07] bg-[#0d0d11] p-3 min-w-0">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <Cpu className="w-3 h-3" />
                  <span>Input</span>
                </div>
                <pre className="text-[11px] font-mono text-slate-300 m-0 leading-relaxed whitespace-pre-wrap break-words max-h-[240px] overflow-auto pr-1">
                  {argsText || '{}'}
                </pre>
              </div>

              {/* Output */}
              <div className="bg-[#0b0b0f] p-3 min-w-0">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <Wrench className="w-3 h-3" />
                  <span>{isRunning ? 'Live Output' : 'Output'}</span>
                </div>
                {renderPrimaryOutput()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function parseMaybeJson(value?: string): unknown {
  if (!value) return undefined;
  try { return JSON.parse(value); } catch { return value; }
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function getToolMeta(name: string) {
  if (name === 'run_command' || name.startsWith('debug_') || name === 'start_background_command') {
    return { label: 'Terminal', icon: Terminal, iconClass: 'bg-blue-500/10 border-blue-500/20 text-blue-300' };
  }
  if (name === 'multi_file_edit' || name === 'write_file' || name === 'replace_in_file' || name === 'rename_path' || name === 'delete_path') {
    return { label: 'File Edit', icon: FilePenLine, iconClass: 'bg-amber-500/10 border-amber-500/20 text-amber-300' };
  }
  if (name === 'read_file' || name === 'read_file_lines') {
    return { label: 'File Read', icon: FileText, iconClass: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' };
  }
  if (name === 'list_directory_files' || name === 'create_directory') {
    return { label: 'Directory', icon: FolderTree, iconClass: 'bg-slate-500/10 border-slate-500/20 text-slate-300' };
  }
  if (name === 'search_content' || name === 'rag_query') {
    return { label: 'Search', icon: Search, iconClass: 'bg-violet-500/10 border-violet-500/20 text-violet-300' };
  }
  if (name === 'browser_screenshot') {
    return { label: 'Screenshot', icon: ImageIcon, iconClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' };
  }
  if (name.startsWith('browser_') || name.startsWith('web_')) {
    return { label: 'Browser', icon: Globe, iconClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' };
  }
  if (name.startsWith('database_')) {
    return { label: 'Database', icon: Database, iconClass: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300' };
  }
  if (name.includes('subagent') || name.includes('agent_task') || name === 'invoke_subagent') {
    return { label: 'Sub-Agent', icon: Bot, iconClass: 'bg-orange-500/10 border-orange-500/20 text-orange-300' };
  }
  if (name === 'ask_human') {
    return { label: 'Human Input', icon: MessageSquare, iconClass: 'bg-rose-500/10 border-rose-500/20 text-rose-300' };
  }
  if (name === 'sequential_thinking') {
    return { label: 'Thinking', icon: Code2, iconClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' };
  }
  return { label: 'Tool', icon: Code2, iconClass: 'bg-slate-500/10 border-slate-500/20 text-slate-300' };
}

function getToolChips(name: string, args: any, result: unknown): string[] {
  const chips: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    const text = String(value);
    chips.push(`${label}: ${text.length > 80 ? `${text.slice(0, 80)}…` : text}`);
  };

  add('path', args?.path || args?.filePath || args?.targetPath);
  add('command', args?.command);
  add('query', args?.query || args?.pattern);
  add('url', args?.url);
  add('agent', args?.agentName || args?.agentType);
  add('task', args?.task);

  if (name === 'multi_file_edit' && Array.isArray(args?.edits)) {
    chips.push(`files: ${args.edits.length}`);
    args.edits.slice(0, 3).forEach((e: any) => {
      if (e?.path) chips.push(e.path);
    });
  }

  if (result && typeof result === 'object') {
    const obj = result as any;
    add('status', obj.status);
    add('agent', obj.agentName || obj.displayName);
    add('bytes', obj.bytesWritten);
    if (Array.isArray(obj.results)) add('edits', `${obj.results.length} files`);
    if (obj.path && !chips.some(c => c.startsWith('path:'))) add('path', obj.path);
  }

  if (chips.length === 0) add('tool', name);
  return chips.slice(0, 5);
}
