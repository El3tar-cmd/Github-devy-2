import { useState, useEffect, useRef } from 'react';
import { RefreshCw, ExternalLink, Play, MousePointer, Keyboard, Terminal, History, Sparkles, Globe } from 'lucide-react';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { useEventBus } from '../useEventBus';

// Helper to map proxied URLs back to clean human-readable localhost URLs
const deparseUrl = (proxyUrl: string): string => {
  if (!proxyUrl) return '';
  const match = proxyUrl.match(/\/proxy\/(\d+)(.*)/);
  if (match) {
    const port = match[1];
    const path = match[2] || '/';
    return `http://localhost:${port}${path}`;
  }
  return proxyUrl;
};

export function BrowserPreview() {
  const { workspaceId } = useWorkspaceContext();
  const { subscribe } = useEventBus(workspaceId);
  const [url, setUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('browser_preview_url');
      return saved || '/proxy/5173/';
    }
    return '/proxy/5173/';
  });

  const [inputUrl, setInputUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('browser_preview_input_url');
      return saved || 'http://localhost:5173';
    }
    return 'http://localhost:5173';
  });

  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    localStorage.setItem('browser_preview_url', url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem('browser_preview_input_url', inputUrl);
  }, [inputUrl]);

  const [key, setKey] = useState(0);
  
  // DOM Diagnostics panel states
  const [manualSelector, setManualSelector] = useState('');
  const [manualText, setManualText] = useState('');
  const [uiLogs, setUiLogs] = useState<{ id: string; msg: string; time: string; type: 'info' | 'success' | 'err' }[]>([
    { id: '1', msg: 'خادم تصفح المنصة جاهز للاتصال.', time: new Date().toLocaleTimeString(), type: 'info' }
  ]);
  const [activeTab, setActiveTab] = useState<'view' | 'diagnose' | 'logs'>('view');
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Helper to parse typed target into our reverse proxy path
  const parseUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '/proxy/5173/';

    // 1. If it's a pure number like "5173" or "8000"
    if (/^\d+$/.test(trimmed)) {
      return `/proxy/${trimmed}/`;
    }

    // 2. If it contains localhost/127.0.0.1 and a port
    const portMatch = trimmed.match(/(?:localhost|127\.0\.0\.1|127\.0\.0\.1\s*):(\d+)(.*)/i);
    if (portMatch) {
      const port = portMatch[1];
      const subpath = portMatch[2] || '/';
      return `/proxy/${port}${subpath}`;
    }

    // 3. If it starts with http:// or https://
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          return `/proxy/${parsed.port || '80'}${parsed.pathname}${parsed.search}`;
        }
      } catch (e) {}
      return trimmed;
    }

    // 4. Robust Port Extraction Fallback: If there is any colon followed by a port number anywhere, extract it!
    const anyPortMatch = trimmed.match(/:(\d+)/);
    if (anyPortMatch) {
      const port = anyPortMatch[1];
      const afterPortMatch = trimmed.match(new RegExp(`:${port}(.*)`));
      const subpath = (afterPortMatch && afterPortMatch[1]) || '/';
      return `/proxy/${port}${subpath}`;
    }

    return trimmed;
  };

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = parseUrl(inputUrl);
    setUrl(resolved);
    addLog(`تم التوجيه يدويًا إلى: ${resolved}`, 'info');
  };

  const addLog = (msg: string, type: 'info' | 'success' | 'err' = 'info') => {
    setUiLogs(prev => [
      { id: Math.random().toString(), msg, time: new Date().toLocaleTimeString(), type },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  // DOM Automation handler
  const executeBrowserAction = (action: any) => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return { success: false, error: 'لم يتم العثور على عنصر الـ Iframe.' };
    }

    try {
      const iframeWindow = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument || iframeWindow?.document;

      if (!iframeDoc) {
        return { success: false, error: 'غير قادر على الوصول إلى محتوى الـ Iframe. تأكد من أن الخادم يعمل بنفس أصل الصفحة.' };
      }

      switch (action.type) {
        case 'click': {
          const el = iframeDoc.querySelector(action.selector);
          if (!el) {
            return { success: false, error: `لم يتم العثور على أي عنصر بال_selector المحدد: ${action.selector}` };
          }
          (el as HTMLElement).click();
          el.dispatchEvent(new Event('click', { bubbles: true }));
          addLog(`🤖 نقر آلي على عنصر: "${action.selector}"`, 'success');
          return { success: true, url: iframeWindow?.location.href || '', html: iframeDoc.documentElement.outerHTML };
        }
        case 'type': {
          const el = iframeDoc.querySelector(action.selector) as HTMLInputElement | HTMLTextAreaElement;
          if (!el) {
            return { success: false, error: `لم يتم العثور على حقل الإدخال بال_selector: ${action.selector}` };
          }
          el.value = action.text || '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          // Simulate some keyboard triggers
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
          
          addLog(`🤖 كتابة نص آلي: "${action.text}" في: "${action.selector}"`, 'success');
          return { success: true, url: iframeWindow?.location.href || '', html: iframeDoc.documentElement.outerHTML };
        }
        case 'navigate': {
          const resolved = parseUrl(action.url);
          setUrl(resolved);
          setInputUrl(action.url);
          addLog(`🤖 توجيه آلي عبر وكيل الأتمتة إلى: ${resolved}`, 'info');
          return { success: true, url: resolved, html: 'جاري التوجيه...' };
        }
        case 'refresh': {
          setKey(k => k + 1);
          addLog(`🤖 تحديث الصفحة آليًا`, 'info');
          return { success: true, url: iframeWindow?.location.href || '', html: 'جاري تحديث الصفحة...' };
        }
        case 'get-html': {
          addLog(`🤖 جلب نسخة من كود الـ HTML لاستكشاف الأخطاء`, 'success');
          return { success: true, url: iframeWindow?.location.href || '', html: iframeDoc.documentElement.outerHTML };
        }
        default:
          return { success: false, error: `نوع الأكشن غير مدعوم: ${action.type}` };
      }
    } catch (err: any) {
      return { success: false, error: `خطأ أثناء التنفيذ: ${err.message}` };
    }
  };

  // 1. WebSocket event subscription for enqueued browser automation actions
  useEffect(() => {
    return subscribe('browser:pending', async (data) => {
      if (data && data.action) {
        const action = data.action;
        const result = executeBrowserAction(action);
        
        try {
          // Send result back to agent waiting thread
          await fetch('/api/browser/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actionId: action.id,
              success: result.success,
              url: result.url || url,
              html: result.html || '',
              error: result.error
            })
          });
        } catch (err) {
          console.error('Failed to post browser action result:', err);
        }

        if (!result.success) {
          addLog(`❌ فشل الأكشن الآلي: ${result.error}`, 'err');
        }
      }
    });
  }, [subscribe, url]);

  // 2. Keep backend constantly updated of browser's current HTML and title to let agent inspect
  useEffect(() => {
    const timer = setInterval(() => {
      const iframe = iframeRef.current;
      if (iframe) {
        try {
          const iframeWindow = iframe.contentWindow;
          const iframeDoc = iframe.contentDocument || iframeWindow?.document;
          if (iframeDoc) {
            const currentIframeUrl = iframeWindow?.location.href || '';
            fetch('/api/browser/state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: currentIframeUrl || url,
                html: iframeDoc.documentElement.outerHTML,
                active: true
              })
            }).catch(() => {});
          }
        } catch (_) {}
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [url, key]);

  // 3. Listen for PREVIEW_URL_CHANGED events from the iframe proxy-client-helper
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PREVIEW_URL_CHANGED') {
        const mapped = deparseUrl(event.data.url);
        // Only update if the user is not actively typing/focusing the input
        if (!isInputFocused) {
          setInputUrl(mapped);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isInputFocused]);

  // 4. Listen for open-browser-preview events from the PortManager (sidebar)
  useEffect(() => {
    const handleOpenPreview = (e: Event) => {
      const customEvent = e as CustomEvent<{ port: number }>;
      if (customEvent.detail && customEvent.detail.port) {
        const port = customEvent.detail.port;
        setUrl(`/proxy/${port}/`);
        setInputUrl(`http://localhost:${port}`);
      }
    };
    window.addEventListener('open-browser-preview', handleOpenPreview);
    return () => window.removeEventListener('open-browser-preview', handleOpenPreview);
  }, []);

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      try {
        const iframeWindow = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument || iframeWindow?.document;
        if (iframeWindow && iframeDoc) {
          const currentIframeUrl = iframeWindow.location.href;
          if (currentIframeUrl && !isInputFocused) {
            const mapped = deparseUrl(currentIframeUrl);
            setInputUrl(mapped);
          }
        }
      } catch (e) {
        // Cross-origin fallback
      }
    }
  };

  // Handle manual clicks in the diagnostic toolbox
  const handleManualClick = () => {
    if (!manualSelector.trim()) return;
    const res = executeBrowserAction({ type: 'click', selector: manualSelector.trim() });
    if (!res.success) {
      addLog(`❌ فشل النقر اليدوي: ${res.error}`, 'err');
    }
  };

  // Handle manual inputs in the diagnostic toolbox
  const handleManualType = () => {
    if (!manualSelector.trim()) return;
    const res = executeBrowserAction({ type: 'type', selector: manualSelector.trim(), text: manualText });
    if (!res.success) {
      addLog(`❌ فشل نوع الكتابة اليدوية: ${res.error}`, 'err');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0b0e] h-full overflow-hidden select-none">
       {/* High-tech Address Bar Deck */}
       <div className="h-14 bg-[#121217] border-b border-white/5 flex items-center px-4 gap-3 shrink-0 font-sans">
          <div className="flex items-center gap-1.5 shrink-0 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
            <Globe className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold font-mono text-emerald-400 tracking-wider">DEV SITE PROXY</span>
          </div>

          <form onSubmit={handleGo} className="flex-1 flex items-center bg-[#1d1d26] rounded-xl overflow-hidden px-3.5 py-1.5 border border-white/5 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all">
            <span className="text-slate-500 text-xs font-mono select-none mr-2">Address:</span>
            <input 
              className="flex-1 bg-transparent text-sm text-slate-100 outline-none font-mono placeholder:text-slate-600"
              placeholder="e.g. localhost:5173 or just 8080"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />
            <button type="submit" className="text-[11px] text-emerald-400 font-mono font-bold hover:text-emerald-300">GO →</button>
          </form>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setKey(k => k + 1)} 
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-[#1d1d26] hover:bg-[#252530] border border-white/5 transition-all" 
              title="تحديث الصفحة (Refresh)"
            >
               <RefreshCw className="w-4 h-4" />
            </button>
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-[#1d1d26] hover:bg-[#252530] border border-white/5 transition-all" 
              title="فتح في نافذة مستقلة"
            >
               <ExternalLink className="w-4 h-4" />
            </a>
          </div>
       </div>

       {/* Browser View Tabs Controller */}
       <div className="h-10 bg-[#0e0e12] border-b border-white/5 flex items-center justify-between px-4 shrink-0 font-sans">
         <div className="flex gap-1.5 h-full items-center">
            <button 
              onClick={() => setActiveTab('view')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'view' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Globe className="w-3.5 h-3.5" />
              العرض المباشر (Viewport)
            </button>
            <button 
              onClick={() => setActiveTab('diagnose')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'diagnose' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              أدوات التشخيص اليدوية
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'logs' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <History className="w-3.5 h-3.5" />
              سجل التفاعل ({uiLogs.length})
            </button>
         </div>

         <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-slate-500 font-mono">Agent Automation Bridge Listening</span>
         </div>
       </div>

       {/* Viewboard Content Deck */}
       <div className="flex-1 w-full bg-[#070709] relative flex flex-col overflow-hidden font-sans">
          {/* Main Content Area */}
          <div className={`flex-1 w-full h-full relative ${activeTab === 'view' ? 'block' : 'hidden'}`}>
            {url ? (
              <iframe 
                ref={iframeRef}
                key={key}
                id="preview-iframe"
                src={url}
                onLoad={handleIframeLoad}
                className="w-full h-full border-none bg-white font-sans text-slate-900"
                title="Sandbox Browser Preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#07070a]">
                <Globe className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
                <p className="text-slate-400 max-w-sm text-sm">أدخل منفذ الخادم في شريط العناوين بالأعلى لفتح واجهة التطبيق المطور في بيئة معزولة بالكامل.</p>
              </div>
            )}
          </div>

          {/* Diagnostic UI Deck */}
          <div className={`flex-1 w-full h-full overflow-y-auto p-6 bg-[#0c0c10] text-slate-300 ${activeTab === 'diagnose' ? 'block' : 'hidden'}`}>
             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-4 font-sans">
               <Sparkles className="w-3.5 h-3.5" />
               لوحة التحكم وتجريب أكواد الـ DOM يدويًا
             </span>
             <h3 className="text-lg font-bold text-white mb-2 font-sans">استخدم أدوات الأتمتة التفاعلية لاختبار خادمك</h3>
             <p className="text-xs text-slate-400 mb-6 leading-relaxed font-sans">
               تتيح لك هذه اللوحة محاكاة نقرات الماوس ومدخلات الكيبورد مباشرة على الـ DOM داخل الـ IFrame بطريقة فورية لحل الأخطاء أو فحص سلوك التفاعل:
             </p>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                <div className="bg-[#15151b] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                   <div>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">عنصر الـ DOM / Selector</span>
                     <input 
                       type="text"
                       placeholder="e.g. button, #submit-btn, input[type=email]"
                       value={manualSelector}
                       onChange={e => setManualSelector(e.target.value)}
                       className="w-full bg-[#1e1e26] text-white text-sm rounded-xl px-4 py-3 outline-none border border-white/5 focus:border-amber-500/50 transition-colors font-mono"
                     />
                   </div>

                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={handleManualClick}
                       className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                     >
                       <MousePointer className="w-4 h-4" />
                       محاكاة نقرة ماوس (Click)
                     </button>
                   </div>
                </div>

                <div className="bg-[#15151b] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                   <div>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">قيمة النص للإدخال / Text Value</span>
                     <input 
                       type="text"
                       placeholder="Text to write in input above..."
                       value={manualText}
                       onChange={e => setManualText(e.target.value)}
                       className="w-full bg-[#1e1e26] text-white text-sm rounded-xl px-4 py-3 outline-none border border-white/5 focus:border-amber-500/50 transition-colors"
                     />
                   </div>

                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={handleManualType}
                       className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                     >
                       <Keyboard className="w-4 h-4" />
                       محاكاة إدخال نص كيبورد (Type)
                     </button>
                   </div>
                </div>
             </div>

             <div className="mt-8 bg-[#15151b] border border-white/5 rounded-2xl p-5 font-sans">
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2 font-sans">
                  <Play className="w-4 h-4 text-emerald-400" />
                  أكواد التشخيص من بيئة التطوير (Terminal Usage)
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  يمكن للأوتوميشن روبوت (أو المطور من خلال الترمينال) إطلاق أوامر أوتوماتيكية مباشرة من سطر الأوامر باستخدام أداة الأتمتة المدمجة:
                </p>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 font-mono text-xs text-slate-200 space-y-2 select-text leading-relaxed">
                  <p className="text-slate-500 select-none">// 1. محاكاة كتابة بريد إلكتروني داخل حقل الإدخال:</p>
                  <p><span className="text-amber-500">node</span> tools/browser_test.js type <span className="text-emerald-400">"input[type=email]"</span> <span className="text-purple-400">"user@dev.local"</span></p>
                  <p className="text-slate-500 select-none mt-2">// 2. محاكاة النقر على زر المتابعة:</p>
                  <p><span className="text-amber-500">node</span> tools/browser_test.js click <span className="text-emerald-400">"button[type=submit]"</span></p>
                  <p className="text-slate-500 select-none mt-2">// 3. جلب نسخة الكود المستردة حاليًا وفحصها:</p>
                  <p><span className="text-amber-500">node</span> tools/browser_test.js get-html</p>
                </div>
             </div>
          </div>

          {/* Automation Activities Logging Deck */}
          <div className={`flex-1 w-full h-full overflow-y-auto p-6 bg-[#0c0c10] text-slate-300 ${activeTab === 'logs' ? 'block' : 'hidden'}`}>
             <div className="flex items-center justify-between mb-4 font-sans">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <History className="w-3.5 h-3.5" />
                  سجل الأحداث والاتصالات الفورية
                </span>
                <button 
                  onClick={() => setUiLogs([])} 
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >
                  [مسح السجل]
                </button>
             </div>

             <div className="space-y-2">
                {uiLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono text-center py-12">السجل فارغ تماما.</p>
                ) : (
                  uiLogs.map(log => (
                    <div key={log.id} className="bg-[#121217] border border-white/5 rounded-xl p-3 flex flex-col sm:flex sm:flex-row sm:items-center sm:justify-between gap-4 font-mono text-xs">
                       <div className="flex items-start gap-2">
                          <span className={`${
                            log.type === 'success' ? 'text-emerald-400' :
                            log.type === 'err' ? 'text-rose-400' : 'text-amber-400'
                          } font-bold mr-1 shrink-0`}>
                            {log.type === 'success' ? '● SUCCESS' :
                             log.type === 'err' ? '● ERROR' : '● INFO'}
                          </span>
                          <span className="text-slate-300">{log.msg}</span>
                       </div>
                       <span className="text-[10px] text-slate-500 shrink-0 mt-1 sm:mt-0">{log.time}</span>
                    </div>
                  ))
                )}
             </div>
          </div>
       </div>
    </div>
  );
}
