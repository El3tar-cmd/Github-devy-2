import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { TOAST_EVENT, type ToastEvent } from "../lib/toast";

const META = {
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
  error:   { icon: XCircle,      color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/25" },
  warning: { icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/25" },
  info:    { icon: Info,          color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/25" },
};

interface ToastItem extends ToastEvent {
  expiresAt: number;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, type, message, duration = 4000 } = (e as CustomEvent<ToastEvent>).detail;
      const item: ToastItem = { id, type, message, duration, expiresAt: Date.now() + duration };
      setToasts(prev => [item, ...prev].slice(0, 6));
      setTimeout(() => dismiss(id), duration);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, [dismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => {
          const { icon: Icon, color, bg } = META[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md ${bg}`}
              style={{ background: "rgba(12,12,17,0.92)" }}
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
              <p className="text-[12px] text-slate-200 leading-snug flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
