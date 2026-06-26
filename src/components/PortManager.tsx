import { useEffect, useState } from 'react';
import { Radio, RefreshCw, ExternalLink } from 'lucide-react';
import { useEventBus } from '../useEventBus';

interface Props {
  workspaceId: string;
  onOpenPreview: (port: number) => void;
}

export function PortManager({ workspaceId, onOpenPreview }: Props) {
  const [ports, setPorts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivePorts = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/workspace/active-ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out port 9876 since it is the IDE itself
        const filtered = (data.ports || []).filter((p: number) => p !== 9876);
        setPorts(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch active ports:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const { subscribe } = useEventBus(workspaceId);

  useEffect(() => {
    fetchActivePorts(true);
    return subscribe('ports:updated', (data) => {
      if (data && Array.isArray(data.ports)) {
        const filtered = data.ports.filter((p: number) => p !== 9876);
        setPorts(filtered);
      } else {
        fetchActivePorts(false);
      }
    });
  }, [workspaceId, subscribe]);

  return (
    <div className="mt-8 bg-[#101014]/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-3 font-sans">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">خوادم التطوير (Active Ports)</span>
        </div>
        <button
          onClick={() => fetchActivePorts(true)}
          disabled={loading}
          className="text-slate-500 hover:text-slate-300"
          title="تحديث المنافذ"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {ports.length === 0 ? (
        <div className="text-[10px] text-slate-500 text-center py-2">
          لا توجد خوادم نشطة حالياً.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ports.map((port) => (
            <div
              key={port}
              className="flex items-center justify-between gap-2 bg-[#171720]/80 border border-white/5 px-2.5 py-1.5 rounded-lg text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-mono text-slate-300">Port {port}</span>
              </div>
              <button
                onClick={() => onOpenPreview(port)}
                className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded text-[10px] font-medium transition-all flex items-center gap-1 shrink-0"
              >
                <span>معاينة</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
