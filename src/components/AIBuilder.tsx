import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Code, Play, Save, Loader2, FileCode, Check, RefreshCw, Download,
  Plus, Trash2, Edit3, Monitor, Tablet, Smartphone, Copy, CheckCircle, Send,
  ArrowRight, HelpCircle, Layers, Settings, FileText, ChevronRight, MessageSquare, Laptop
} from "lucide-react";

interface Page {
  name: string;
  path: string;
  promptHistory: string[];
  html: string;
}

interface AIBuilderProps {
  workspaceId: string;
  onRefreshWorkspace?: () => void;
}

const PRESETS = [
  { name: "Glass Login", prompt: "A gorgeous dark-mode glassmorphic login page with glowing borders, clean input fields, a forgot password link, social login buttons, and subtle hover animations." },
  { name: "SaaS Pricing", prompt: "A sleek pricing plan page with three tiers (Basic, Pro, Enterprise). Highlight the Pro tier with a premium purple gradient, checkmark icons for features, and smooth scale-up animations on hover." },
  { name: "Portfolio", prompt: "A modern developer portfolio hero section. Include a glowing circular profile placeholder, rich typography showing a title like 'Senior Fullstack Developer', clean tech stack badges (React, Node, Tailwind), and call-to-action buttons." },
  { name: "Dashboard", prompt: "A professional statistics dashboard panel. Include side navigation, a main header showing user profile, a grid of 4 stat cards with trend indicators (+12%, -3%), and a modern transaction table." },
];

const QUICK_ACTIONS = [
  { name: "✨ Dark Theme", prompt: "Convert this page into a sleek dark theme with deep violet/navy accents, glass card panels, and glowing text effects." },
  { name: "⚡ Glassmorphism", prompt: "Add glassmorphism cards with backdrop blur, semi-transparent backgrounds, delicate white borders, and soft shadows." },
  { name: "📱 Responsive Nav", prompt: "Add a modern responsive navigation bar at the top with a brand logo, list items, a contact CTA, and a mobile hamburger toggle." },
  { name: "📧 Contact Form", prompt: "Add a modern validation-ready contact form card with input fields for name, email, query type, and a sleek submit button with animations." },
  { name: "💬 Review Grid", prompt: "Add a grid of 3 testimonial cards featuring avatar mockups, gold ratings, description quotes, and interactive scale effects." },
  { name: "📂 Accordion FAQ", prompt: "Add a clean, styled FAQ accordion with smooth open-close styling and toggle icons." }
];

export function AIBuilder({ workspaceId, onRefreshWorkspace }: AIBuilderProps) {
  // General State
  const [prompt, setPrompt] = useState<string>(PRESETS[0].prompt);
  const [generating, setGenerating] = useState<boolean>(false);
  const [htmlCode, setHtmlCode] = useState<string>("");
  const [viewMode, setViewMode] = useState<"preview" | "code" | "split">("preview");
  const [savePath, setSavePath] = useState<string>("index.html");
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [projectLoading, setProjectLoading] = useState<boolean>(false);
  const [builderSidebarOpen, setBuilderSidebarOpen] = useState<boolean>(false);

  // Multi-page State
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // Responsive / Preview State
  const [viewportWidth, setViewportWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [generationMode, setGenerationMode] = useState<"modify" | "scratch">("modify");

  // Agent Handoff State
  const [agentInstructions, setAgentInstructions] = useState<string>("");
  const [showAgentPanel, setShowAgentPanel] = useState<boolean>(false);
  const [agentSaving, setAgentSaving] = useState<boolean>(false);
  const [agentSaveSuccess, setAgentSaveSuccess] = useState<boolean>(false);
  const [copiedHandoffText, setCopiedHandoffText] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load project manifest on mount/workspace change
  useEffect(() => {
    loadProject();
  }, [workspaceId]);

  // Synchronize htmlCode state back to the current page in local pages list
  useEffect(() => {
    if (pages.length > 0 && pages[currentPageIndex]) {
      const updated = [...pages];
      if (updated[currentPageIndex].html !== htmlCode) {
        updated[currentPageIndex].html = htmlCode;
        setPages(updated);
      }
    }
  }, [htmlCode]);

  // Synchronize savePath back to the current page in local pages list
  useEffect(() => {
    if (pages.length > 0 && pages[currentPageIndex]) {
      const updated = [...pages];
      if (updated[currentPageIndex].path !== savePath) {
        updated[currentPageIndex].path = savePath;
        setPages(updated);
      }
    }
  }, [savePath]);

  // Load project from ui-project.json or fallback
  const loadProject = async () => {
    setProjectLoading(true);
    try {
      const res = await fetch("/api/fs/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, path: "ui-project.json" }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const manifest = JSON.parse(data.content);
        if (manifest.pages && manifest.pages.length > 0) {
          const loadedPages = await Promise.all(
            manifest.pages.map(async (page: any) => {
              try {
                const pageRes = await fetch("/api/fs/read", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ workspaceId, path: page.path }),
                });
                if (pageRes.ok) {
                  const pageData = await pageRes.json();
                  return { ...page, html: pageData.content };
                }
              } catch (e) {
                console.warn(`Could not load page file: ${page.path}`, e);
              }
              return { ...page, html: page.html || "" };
            })
          );
          setPages(loadedPages);
          const activeIndex = manifest.currentPageIndex < loadedPages.length ? manifest.currentPageIndex : 0;
          setCurrentPageIndex(activeIndex);
          setHtmlCode(loadedPages[activeIndex].html || "");
          setSavePath(loadedPages[activeIndex].path || "index.html");
          if (manifest.agentNotes) {
            setAgentInstructions(manifest.agentNotes);
          }
          return;
        }
      }
      
      // Fallback: Check if workspace has an index.html we can import
      const indexRes = await fetch("/api/fs/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, path: "index.html" }),
      });
      
      if (indexRes.ok) {
        const indexData = await indexRes.json();
        const defaultPages = [
          {
            name: "Home Page",
            path: "index.html",
            promptHistory: ["Imported from pre-existing index.html"],
            html: indexData.content,
          },
        ];
        setPages(defaultPages);
        setCurrentPageIndex(0);
        setHtmlCode(indexData.content);
        setSavePath("index.html");
        saveProjectManifest(defaultPages, 0);
      } else {
        initEmptyProject();
      }
    } catch (e) {
      console.error("Error loading project:", e);
      initEmptyProject();
    } finally {
      setProjectLoading(false);
    }
  };

  const initEmptyProject = () => {
    const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Web Project</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-[#0b0b0f] text-slate-100 min-h-screen flex items-center justify-center font-sans selection:bg-emerald-500 selection:text-black">
    <div class="max-w-xl p-8 bg-[#13131a] border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden group">
        <!-- Background glows -->
        <div class="absolute -top-20 -left-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500"></div>
        <div class="absolute -bottom-20 -right-20 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-500/20 transition-all duration-500"></div>
        
        <div class="relative z-10 text-center">
            <div class="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl mb-6 shadow-inner">
                <i class="fas fa-sparkles text-2xl animate-pulse"></i>
            </div>
            
            <h1 class="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-4">
                Interactive UI Canvas
            </h1>
            
            <p class="text-sm text-slate-400 leading-relaxed mb-8">
                Welcome to your interactive web building canvas. Enter a prompt above or select a preset to generate standard-compliant, styled components and multi-page layouts using Tailwind CSS.
            </p>
            
            <div class="flex justify-center gap-4">
                <button onclick="alert('Start building!')" class="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black text-xs font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
                    Start Customizing
                </button>
            </div>
        </div>
    </div>
</body>
</html>`;

    const defaultPages = [
      {
        name: "Home Page",
        path: "index.html",
        promptHistory: [],
        html: defaultHtml,
      },
    ];
    setPages(defaultPages);
    setCurrentPageIndex(0);
    setHtmlCode(defaultHtml);
    setSavePath("index.html");
  };

  const saveProjectManifest = async (updatedPages: Page[], index: number, extraNotes?: string) => {
    try {
      const manifest = {
        pages: updatedPages.map(p => ({
          name: p.name,
          path: p.path,
          promptHistory: p.promptHistory
        })),
        currentPageIndex: index,
        agentNotes: extraNotes !== undefined ? extraNotes : agentInstructions,
        lastUpdated: new Date().toISOString()
      };
      
      await fetch("/api/fs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          path: "ui-project.json",
          content: JSON.stringify(manifest, null, 2),
        }),
      });
    } catch (e) {
      console.error("Failed to save project manifest", e);
    }
  };

  const handleSwitchPage = (index: number) => {
    if (index < 0 || index >= pages.length) return;
    
    // Save current changes locally to state
    const updated = [...pages];
    updated[currentPageIndex].html = htmlCode;
    updated[currentPageIndex].path = savePath;
    setPages(updated);
    
    // Switch state
    setCurrentPageIndex(index);
    setHtmlCode(updated[index].html || "");
    setSavePath(updated[index].path || "index.html");
    
    // Save manifest
    saveProjectManifest(updated, index);
  };

  const handleAddPage = () => {
    const name = window.prompt("Enter page name (e.g. Products / About Us):");
    if (!name) return;
    const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".html";
    
    const newPage: Page = {
      name,
      path: filename,
      promptHistory: [],
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-[#0b0b0f] text-slate-100 min-h-screen flex items-center justify-center font-sans">
    <div class="text-center p-6 bg-[#13131a] rounded-2xl border border-white/5 max-w-md">
        <h1 class="text-3xl font-bold mb-4">${name}</h1>
        <p class="text-slate-400 text-sm mb-6">This page has been added to the project. Type an AI prompt to build its interface.</p>
        <a href="index.html" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg text-xs font-bold transition-all">Go back Home</a>
    </div>
</body>
</html>`
    };
    
    const updated = [...pages, newPage];
    setPages(updated);
    const newIndex = updated.length - 1;
    setCurrentPageIndex(newIndex);
    setHtmlCode(newPage.html);
    setSavePath(newPage.path);
    saveProjectManifest(updated, newIndex);
  };

  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) {
      import("../lib/toast").then(({ toast }) => toast.warning("Cannot delete the last page in the project."));
      return;
    }
    if (!window.confirm(`Are you sure you want to delete page "${pages[index].name}"?`)) return;
    
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);
    
    const newIndex = currentPageIndex >= updated.length ? updated.length - 1 : currentPageIndex;
    setCurrentPageIndex(newIndex);
    setHtmlCode(updated[newIndex].html || "");
    setSavePath(updated[newIndex].path || "index.html");
    saveProjectManifest(updated, newIndex);
  };

  const generateUI = async (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim()) return;

    setGenerating(true);
    setSaveSuccess(false);
    
    let systemPrompt = "";
    if (generationMode === "scratch" || !htmlCode) {
      systemPrompt = `You are a world-class UI designer and frontend developer.
Generate a single, complete, beautiful HTML page based on the user's description.
Requirements:
1. Include Tailwind CSS CDN via: <script src="https://cdn.tailwindcss.com"></script>
2. Include FontAwesome or Lucide Icons via script or link if needed.
3. Apply rich modern styles: dark mode vibes, glassmorphism, glowing gradients, rich rounded cards, and smooth hover animations.
4. Output ONLY the raw HTML code. Do NOT wrap the output in markdown code blocks (\`\`\`html or \`\`\`). Do NOT include any intro or outro text. Just start with <!DOCTYPE html> and end with </html>.`;
    } else {
      systemPrompt = `You are a world-class UI designer and frontend developer.
You will modify an existing HTML page based on the user's description of changes.
Here is the existing HTML code:
=========================================
${htmlCode}
=========================================

Instructions:
1. Implement the requested modifications precisely (e.g. adding panels/sections, changing colors, upgrading components, adding interactivity).
2. Maintain the existing styling (Tailwind CSS, custom themes), page structure, and content except where changes are requested.
3. Keep the code clean, fully functional, and modern.
4. Ensure Tailwind CSS script (<script src="https://cdn.tailwindcss.com"></script>) and any font-awesome libraries are preserved.
5. Output ONLY the complete updated raw HTML code. Do NOT wrap the output in markdown code blocks (\`\`\`html or \`\`\`). Do NOT include any intro or outro text. Just start with <!DOCTYPE html> and end with </html>.`;
    }

    try {
      const settingsString = localStorage.getItem("agent_settings");
      const settings = settingsString ? JSON.parse(settingsString) : {};
      
      let text = "";
      if (settings.apiProvider === "ollama") {
        if (!settings.ollamaUrl) {
          throw new Error("Ollama URL is not configured. Go to settings and set it.");
        }
        if (!settings.ollamaModel) {
          throw new Error("Ollama Model is not selected. Go to settings and select one.");
        }
        const baseUrl = settings.ollamaUrl.replace(/\/+$/, "");
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: settings.ollamaModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: activePrompt }
            ],
            stream: false,
          }),
        });

        if (!res.ok) {
          throw new Error(`Ollama Error: ${(await res.text()).substring(0, 500)}`);
        }

        const data = await res.json();
        text = data.message?.content || "";
      } else {
        const geminiModel = settings.geminiModel || "gemini-2.5-flash";
        const clientApiKey = settings.geminiApiKey || "";

        const payload = {
          systemInstruction: {
            role: "user",
            parts: [{ text: systemPrompt }]
          },
          contents: [{
            role: "user",
            parts: [{ text: activePrompt }]
          }]
        };

        const res = await fetch("/api/gemini/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: geminiModel,
            payload,
            clientApiKey
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to generate UI code");
        }

        const data = await res.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
      
      // Clean up markdown wrapper in case model ignored instruction
      text = text.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();
      
      setHtmlCode(text);
      
      // Update local page structure
      const updated = [...pages];
      if (updated[currentPageIndex]) {
        if (!updated[currentPageIndex].promptHistory) {
          updated[currentPageIndex].promptHistory = [];
        }
        updated[currentPageIndex].promptHistory.push(activePrompt);
        updated[currentPageIndex].html = text;
        setPages(updated);
        saveProjectManifest(updated, currentPageIndex);
      }

      if (viewMode === "code") {
        setViewMode("split");
      }
    } catch (e: any) {
      import("../lib/toast").then(({ toast }) => toast.error("Error generating UI: " + e.message + ". Check your provider settings."));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!htmlCode || !savePath.trim()) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/fs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          path: savePath,
          content: htmlCode,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        const updated = [...pages];
        updated[currentPageIndex].html = htmlCode;
        updated[currentPageIndex].path = savePath;
        setPages(updated);
        await saveProjectManifest(updated, currentPageIndex);
        
        if (onRefreshWorkspace) onRefreshWorkspace();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const data = await res.json();
        import("../lib/toast").then(({ toast }) => toast.error("Failed to save: " + data.error));
      }
    } catch (e: any) {
      import("../lib/toast").then(({ toast }) => toast.error("Error saving: " + e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!htmlCode) return;
    const blob = new Blob([htmlCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = savePath || "generated-ui.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveAgentHandoff = async () => {
    if (!agentInstructions.trim()) return;
    setAgentSaving(true);
    setAgentSaveSuccess(false);
    try {
      // 1. Update project manifest
      const updated = [...pages];
      await saveProjectManifest(updated, currentPageIndex, agentInstructions);

      // 2. Generate AGENT_INSTRUCTIONS.md
      const mdContent = `# 🚀 UI Development Task Handoff

This document was generated by the AI UI Builder to guide the development agent in completing this project.

## 📋 Project Status & Files
Here is the structure of the UI builder project:
${pages.map(p => `- **${p.name}** (\`${p.path}\`)`).join("\n")}

## 🎯 Target Goal & Feature Requests
The user wants you to implement the following features and backend integration:

\`\`\`
${agentInstructions}
\`\`\`

## 🛠️ Instructions for the Agent
1. Read the page files listed above.
2. Implement backend APIs, database hookups, form handlers, or interactive javascript logic as requested.
3. Validate pages for layout issues or console errors.
4. Ensure code modifications preserve the existing beautiful CSS styles and Tailwind configurations.
5. Update the project files and confirm they run. You can use the \`/goal\` command to run background checks and tests.
`;

      const res = await fetch("/api/fs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          path: "AGENT_INSTRUCTIONS.md",
          content: mdContent,
        }),
      });

      if (res.ok) {
        setAgentSaveSuccess(true);
        if (onRefreshWorkspace) onRefreshWorkspace();
        setTimeout(() => setAgentSaveSuccess(false), 3000);
      } else {
        const data = await res.json();
        import("../lib/toast").then(({ toast }) => toast.error("Failed to save instructions: " + data.error));
      }
    } catch (e: any) {
      import("../lib/toast").then(({ toast }) => toast.error("Error saving: " + e.message));
    } finally {
      setAgentSaving(false);
    }
  };

  const copyAgentHandoffPrompt = () => {
    const handoffText = `Hey! I've set up a UI layout. Please read the project status in [ui-project.json](file:///ui-project.json) and follow the instructions in [AGENT_INSTRUCTIONS.md](file:///AGENT_INSTRUCTIONS.md) to add backend logic / functions. Let me know when you've finished.`;
    navigator.clipboard.writeText(handoffText);
    setCopiedHandoffText(true);
    setTimeout(() => setCopiedHandoffText(false), 3000);
  };

  const injectQuickAction = (qActionPrompt: string) => {
    if (generationMode === "scratch") {
      setPrompt(qActionPrompt);
    } else {
      setPrompt(prev => {
        const separator = prev.trim() ? "\n\n" : "";
        return `${prev}${separator}${qActionPrompt}`;
      });
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0a0a0d] text-slate-300 font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR: Pages, Generation Controls, Quick Insertion */}
      {/* Mobile Backdrop */}
      {builderSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setBuilderSidebarOpen(false)}
        />
      )}

      <div className={`fixed md:relative top-0 left-0 bottom-0 z-50 md:z-auto w-72 bg-[#0e0e12] border-r border-white/5 flex flex-col shrink-0 h-full transition-transform duration-300 ${
        builderSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        
        {/* Project Header */}
        <div className="p-4 border-b border-white/5 bg-[#121217] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">UI Canvas Builder</span>
          </div>
          <button 
            onClick={loadProject}
            disabled={projectLoading}
            className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-slate-200"
            title="Reload Project Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${projectLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Section 1: Pages List */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pages ({pages.length})</span>
            <button 
              onClick={handleAddPage}
              className="p-1 hover:bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center gap-1 text-[10px] font-semibold transition-all border border-emerald-500/10"
              title="Add new HTML page"
            >
              <Plus className="w-3 h-3" /> Add Page
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {pages.map((p, i) => (
              <div 
                key={i}
                onClick={() => handleSwitchPage(i)}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                  i === currentPageIndex 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm"
                    : "bg-[#141419] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-[#1a1a22]"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold truncate leading-none mb-0.5">{p.name}</span>
                    <span className="text-[9px] font-mono text-slate-500 truncate leading-none">{p.path}</span>
                  </div>
                </div>
                {pages.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePage(i);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 hover:bg-rose-500/10 rounded transition-all shrink-0"
                    title="Delete page"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Generation Mode */}
        <div className="p-4 border-b border-white/5 bg-[#101015]/40">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Build Mode</span>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#16161c] rounded-xl border border-white/5">
            <button
              onClick={() => setGenerationMode("modify")}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                generationMode === "modify" 
                  ? "bg-emerald-500 text-black shadow-md" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Modify Page
            </button>
            <button
              onClick={() => setGenerationMode("scratch")}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                generationMode === "scratch" 
                  ? "bg-emerald-500 text-black shadow-md" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              From Scratch
            </button>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
            {generationMode === "modify" 
              ? "Modifies the active HTML template incrementally keeping existing structures intact."
              : "Regenerates the complete HTML file from scratch based on the prompt."}
          </p>
        </div>

        {/* Section 3: Quick Insertion Actions */}
        <div className="p-4 border-b border-white/5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2.5">Quick Actions</span>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => injectQuickAction(action.prompt)}
                className="px-2.5 py-2 bg-[#141419] hover:bg-emerald-500/5 border border-white/5 hover:border-emerald-500/20 hover:text-emerald-400 rounded-xl text-left transition-all text-[10px] font-medium"
              >
                {action.name}
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Handoff Button Toggle */}
        <div className="p-4 mt-auto">
          <button
            onClick={() => setShowAgentPanel(!showAgentPanel)}
            className={`w-full py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              showAgentPanel 
                ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-violet-500/20 shadow-md"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {showAgentPanel ? "Close Agent Hub" : "Pass Tasks to Agent"}
          </button>
        </div>

      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        
        {/* TOP PANEL: Page renaming, viewport control, layout toggles */}
        <div className="p-4 border-b border-white/5 bg-[#0e0e12] flex flex-wrap gap-4 items-center justify-between shrink-0">
          
          {/* File Path & Page Rename */}
          <div className="flex items-center gap-2 max-w-sm">
            {/* Mobile Sidebar Toggle */}
            <button
              onClick={() => setBuilderSidebarOpen(true)}
              className="p-1.5 bg-[#14141a] hover:bg-white/5 border border-white/5 rounded-lg md:hidden text-slate-300 mr-1"
              title="Open Builder Menu"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
            </button>

            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 hidden sm:inline">Editing:</span>
            <input 
              type="text"
              value={savePath}
              onChange={(e) => setSavePath(e.target.value)}
              className="bg-[#14141a] text-xs font-mono text-white border border-white/5 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500/50 w-32 sm:w-48"
              placeholder="index.html"
            />
          </div>

          {/* Viewport size toggles (Responsive) */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className="hidden sm:flex items-center gap-1 bg-[#14141a] p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setViewportWidth("desktop")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewportWidth === "desktop" ? "bg-[#27272f] text-emerald-400" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Desktop View (Full Screen)"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewportWidth("tablet")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewportWidth === "tablet" ? "bg-[#27272f] text-emerald-400" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Tablet View (768px Width)"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewportWidth("mobile")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewportWidth === "mobile" ? "bg-[#27272f] text-emerald-400" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Mobile View (375px Width)"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View Mode (Preview/Code/Split) */}
          <div className="flex items-center gap-1.5 bg-[#14141a] p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "preview" ? "bg-[#27272f] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "code" ? "bg-[#27272f] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all hidden md:block ${
                viewMode === "split" ? "bg-[#27272f] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Split View
            </button>
          </div>
        </div>

        {/* INPUT PROMPT PANEL */}
        <div className="p-4 bg-[#0c0c10] border-b border-white/5 flex flex-col gap-3 shrink-0">
          <div className="flex gap-2 items-center overflow-x-auto pb-1 shrink-0">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest shrink-0 mr-1.5">Presets:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  setPrompt(preset.prompt);
                  generateUI(preset.prompt);
                }}
                className="text-[9px] bg-[#14141a] hover:bg-emerald-500/10 hover:text-emerald-400 border border-white/5 rounded-lg px-2.5 py-1.5 transition-all shrink-0 text-slate-400 font-semibold"
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                generationMode === "modify" 
                  ? "Describe modifications to the current page (e.g. 'add a responsive navbar' or 'change colors to violet')"
                  : "Describe the new UI you want to build from scratch..."
              }
              className="flex-1 h-14 bg-[#14141a] border border-white/5 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500/30 resize-none leading-relaxed"
            />
            <button
              onClick={() => generateUI()}
              disabled={generating || !prompt.trim()}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 disabled:text-slate-500 text-black text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 self-stretch sm:self-end h-14 shrink-0"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 fill-current" />
              )}
              {generationMode === "modify" ? "Apply Changes" : "Build HTML"}
            </button>
          </div>
        </div>

        {/* WORKSPACE AREA (SPLIT CODE & PREVIEW) */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Split Left: Code Editor */}
          {(viewMode === "code" || viewMode === "split") && (
            <div className={`flex-1 flex flex-col border-r border-white/5 h-full overflow-hidden ${
              viewMode === "split" ? "hidden md:flex" : ""
            }`}>
              <div className="p-2.5 border-b border-white/5 bg-[#0b0b0e] flex justify-between items-center text-xs shrink-0">
                <span className="text-slate-400 font-mono flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" /> {savePath}
                </span>
                {htmlCode && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(htmlCode);
                      import("../lib/toast").then(({ toast }) => toast.success("Code copied to clipboard!"));
                    }}
                    className="px-2 py-1 bg-[#1e1e24] hover:bg-[#2a2a32] border border-white/10 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                  >
                    Copy HTML Code
                  </button>
                )}
              </div>
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                className="flex-1 bg-[#07070a] text-slate-300 text-xs font-mono p-4 resize-none outline-none leading-relaxed overflow-y-auto w-full border-none select-text"
                placeholder="HTML code will appear here after building..."
              />
            </div>
          )}

          {/* Split Right: Live Device Frame Rendering */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className="flex-1 flex flex-col h-full bg-[#0a0a0f] overflow-hidden">
              
              {/* Preview Bar */}
              <div className="p-2.5 border-b border-white/5 bg-[#0b0b0e] flex justify-between items-center text-xs shrink-0">
                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-emerald-400" /> Real-time Sandbox Preview
                </span>
                {htmlCode && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : saveSuccess ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      {saveSuccess ? "Saved!" : "Save to Disk"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1 bg-[#1e1e24] hover:bg-[#2a2a32] border border-white/10 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                      title="Download file to device"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                )}
              </div>

              {/* Rendering canvas based on Viewport configuration */}
              <div className="flex-1 bg-[#070709] relative overflow-hidden flex items-center justify-center p-6">
                
                {generating && (
                  <div className="absolute inset-0 bg-[#0a0a0e]/95 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono z-20">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-xs font-semibold">Generating HTML layouts & designs...</span>
                  </div>
                )}

                {!htmlCode && !generating && (
                  <div className="absolute inset-0 bg-[#0a0a0d] flex flex-col items-center justify-center text-slate-500 space-y-3 text-center p-6">
                    <Sparkles className="w-12 h-12 text-slate-700/50 animate-pulse" />
                    <p className="text-xs max-w-xs leading-normal">
                      Write an AI prompt or inject elements to initialize this viewport.
                    </p>
                  </div>
                )}

                {htmlCode && (
                  <div className="w-full h-full flex items-center justify-center transition-all duration-300 overflow-auto">
                    {viewportWidth === "mobile" && (
                      <div className="w-[375px] h-[660px] border-[12px] border-[#1e1e24] rounded-[36px] shadow-2xl relative flex flex-col bg-white overflow-hidden shrink-0">
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-[#1e1e24] rounded-b-xl z-20"></div>
                        <iframe
                          ref={iframeRef}
                          srcDoc={htmlCode}
                          title="Mobile Sandbox Preview"
                          sandbox="allow-scripts"
                          className="w-full h-full border-none pt-4 bg-white"
                        />
                      </div>
                    )}

                    {viewportWidth === "tablet" && (
                      <div className="w-[768px] h-[580px] border-[10px] border-[#1e1e24] rounded-[24px] shadow-2xl relative bg-white overflow-hidden shrink-0">
                        <iframe
                          ref={iframeRef}
                          srcDoc={htmlCode}
                          title="Tablet Sandbox Preview"
                          sandbox="allow-scripts"
                          className="w-full h-full border-none bg-white"
                        />
                      </div>
                    )}

                    {viewportWidth === "desktop" && (
                      <div className="w-full h-full bg-white rounded-xl shadow-lg overflow-hidden border border-white/5">
                        <iframe
                          ref={iframeRef}
                          srcDoc={htmlCode}
                          title="Desktop Sandbox Preview"
                          sandbox="allow-scripts"
                          className="w-full h-full border-none bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* AGENT HANDOFF COLLAPSIBLE PANEL OVERLAY */}
          {showAgentPanel && (
            <div className="absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-[#0f0f14] border-l border-white/10 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
              
              {/* Header */}
              <div className="p-4 border-b border-white/5 bg-[#14141a] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Agent Hand-off Hub</span>
                </div>
                <button
                  onClick={() => setShowAgentPanel(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                >
                  Close
                </button>
              </div>

              {/* Scrollable Handoff Settings */}
              <div className="p-4 flex-1 overflow-y-auto space-y-5">
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-xs text-violet-300 leading-relaxed">
                  <p className="font-semibold mb-1">Collaborate with coding agents</p>
                  Export the active layout definitions, prompt history, and target integration parameters. The agent will read this context and start building backend routes, APIs, or databases automatically!
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Goal & Task List for the Agent:
                  </label>
                  <textarea
                    value={agentInstructions}
                    onChange={(e) => setAgentInstructions(e.target.value)}
                    placeholder="Describe what the agent should implement (e.g., 'Connect the register form on register.html to a SQLite database. Set up an Express endpoint for login validation...')"
                    className="w-full h-40 bg-[#16161c] border border-white/5 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50 resize-none leading-relaxed"
                  />
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleSaveAgentHandoff}
                    disabled={agentSaving || !agentInstructions.trim()}
                    className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {agentSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : agentSaveSuccess ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {agentSaveSuccess ? "Saved Handoff File!" : "Write Tasks to Project File"}
                  </button>

                  <div className="border-t border-white/5 pt-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Prompt text to copy to Agent:
                    </span>
                    <div className="bg-[#09090c] border border-white/5 rounded-xl p-3 text-[11px] leading-relaxed relative group">
                      <p className="text-slate-400 pr-8 font-mono select-all">
                        Hey! I've set up a UI layout. Please read the project status in <span className="text-violet-400">ui-project.json</span> and follow the instructions in <span className="text-violet-400">AGENT_INSTRUCTIONS.md</span> to add backend logic / functions. Let me know when you've finished.
                      </p>
                      <button
                        onClick={copyAgentHandoffPrompt}
                        className="absolute top-2 right-2 p-1 bg-white/5 hover:bg-white/10 rounded-md transition-all text-slate-400 hover:text-slate-200"
                        title="Copy to clipboard"
                      >
                        {copiedHandoffText ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#121217] rounded-xl p-3 border border-white/5 space-y-2 text-[11px] leading-relaxed">
                  <span className="font-bold text-white block">Tip for best results:</span>
                  <p className="text-slate-400">
                    Use the <span className="text-emerald-400 font-semibold">/goal</span> slash command in the chat to tell the agent to run testing loops until the code compiles perfectly.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
