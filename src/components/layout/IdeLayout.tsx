import React, { useRef, useEffect } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { useWorkspaceContext } from "../../contexts/WorkspaceContext";
import { useAgentContext } from "../../contexts/AgentContext";

// Import subcomponents
import { FileTree } from "../FileTree";
import { BrowserPreview } from "../BrowserPreview";
import { TerminalUI } from "../TerminalUI";
import { GitUI } from "../GitUI";
import { SearchUI } from "../SearchUI";
import { DatabaseManager } from "../DatabaseManager";
import { DebuggerPanel } from "../DebuggerPanel";
import { PackageManager } from "../PackageManager";
import { AIBuilder } from "../AIBuilder";

interface IdeLayoutProps {
  ideTab: "editor" | "browser" | "terminal" | "search" | "git" | "db" | "debugger" | "package" | "builder";
  setIdeTab: (tab: "editor" | "browser" | "terminal" | "search" | "git" | "db" | "debugger" | "package" | "builder") => void;
  activeTab: "chat" | "ide";
}

export const IdeLayout: React.FC<IdeLayoutProps> = ({
  ideTab,
  setIdeTab,
  activeTab,
}) => {
  const {
    workspaceId,
    setWorkspaceId,
    tree,
    fetchTree,
    selectedFile,
    setSelectedFile,
    fileContent,
    setFileContent,
    originalContent,
    openFile,
    saveFile,
    saveStatus,
    isDiffMode,
    setIsDiffMode,
    targetLine,
    setTargetLine,
  } = useWorkspaceContext();

  const { settings } = useAgentContext();

  const editorRef = useRef<any>(null);
  const completionProviderRef = useRef<any[] | null>(null);

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    if (monaco && !completionProviderRef.current) {
      const langs = ["javascript", "typescript", "html", "css", "python", "json", "markdown"];
      const providers: any[] = [];

      langs.forEach((lang) => {
        const provider = monaco.languages.registerInlineCompletionsProvider(lang, {
          provideInlineCompletions: async (model: any, position: any, context: any, token: any) => {
            if (!settings.enableAutocomplete) {
              return { items: [] };
            }

            const textBefore = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - 30),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });

            const textAfter = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 30),
              endColumn: 1,
            });

            await new Promise((resolve) => setTimeout(resolve, 800));
            if (token.isCancellationRequested) {
              return { items: [] };
            }

            try {
              const systemPrompt =
                "You are a code autocompletion assistant. Complete the code at the cursor. Return ONLY the code completion to be inserted at the cursor position. Do not wrap the output in markdown code blocks. Keep it concise, fitting the exact indent and context. Do not write explanation.";
              const prompt = `Code Before Cursor:\n${textBefore}\nCode After Cursor:\n${textAfter}\n\nComplete the next characters/lines starting exactly from the cursor:`;

              const geminiModel = settings.geminiModel || "gemini-2.5-flash";
              const clientApiKey = settings.geminiApiKey || "";

              const payload = {
                systemInstruction: {
                  role: "user",
                  parts: [{ text: systemPrompt }],
                },
                contents: [
                  {
                    role: "user",
                    parts: [{ text: prompt }],
                  },
                ],
              };

              const res = await fetch("/api/gemini/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: geminiModel,
                  payload,
                  clientApiKey,
                }),
              });

              if (!res.ok) return { items: [] };
              const data = await res.json();
              let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

              text = text.replace(/^```[a-z]*\n/i, "").replace(/```$/, "");

              if (!text) return { items: [] };

              return {
                items: [
                  {
                    insertText: text,
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    ),
                  },
                ],
              };
            } catch (e) {
              console.error("Autocomplete failed:", e);
              return { items: [] };
            }
          },
          freeInlineCompletions: () => {},
        });
        providers.push(provider);
      });
      completionProviderRef.current = providers;
    }
  };

  // Scroll to target line when selected file changes
  useEffect(() => {
    if (targetLine && editorRef.current && selectedFile) {
      const editor = editorRef.current;
      setTimeout(() => {
        try {
          editor.revealLineInCenter(targetLine);
          editor.setPosition({ lineNumber: targetLine, column: 1 });
          editor.focus();
        } catch (e) {
          console.error("Monaco scroll failed:", e);
        }
        setTargetLine(null);
      }, 150);
    }
  }, [targetLine, selectedFile, setTargetLine]);

  return (
    <div
      className={`flex-[1.5] flex flex-col min-w-0 ${
        activeTab === "ide" ? "flex" : "hidden lg:flex"
      }`}
    >
      <div className="h-10 border-b border-white/5 bg-[#151519] flex items-center justify-between px-4 shrink-0 overflow-x-auto gap-4">
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setIdeTab("editor")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "editor"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setIdeTab("browser")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "browser"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setIdeTab("terminal")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "terminal"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setIdeTab("search")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "search"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setIdeTab("git")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "git"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Git
          </button>
          <button
            onClick={() => setIdeTab("db")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "db"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Database
          </button>
          <button
            onClick={() => setIdeTab("debugger")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "debugger"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Debugger
          </button>
          <button
            onClick={() => setIdeTab("package")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "package"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            Packages
          </button>
          <button
            onClick={() => setIdeTab("builder")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              ideTab === "builder"
                ? "bg-[#2a2a32] text-emerald-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            UI Builder
          </button>
        </div>
        {ideTab === "editor" && selectedFile && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-slate-500 truncate max-w-[150px] md:max-w-xs block">
              {selectedFile}
            </span>

            <span
              className={`text-[10px] px-2 py-0.5 rounded transition-all font-sans font-medium flex items-center gap-1 ${
                saveStatus === "saving"
                  ? "text-amber-400 bg-amber-400/10 animate-pulse"
                  : saveStatus === "unsaved"
                  ? "text-blue-400 bg-blue-500/10"
                  : "text-emerald-400 bg-emerald-500/10"
              }`}
            >
              {saveStatus === "saving" && "جاري الحفظ تلقائياً..."}
              {saveStatus === "unsaved" && "تغييرات غير محفوظة"}
              {saveStatus === "saved" && "تم الحفظ تلقائياً"}
            </span>

            <button
              onClick={() => setIsDiffMode(!isDiffMode)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isDiffMode ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              Diff Mode
            </button>
            <button
              onClick={() => {
                saveFile(selectedFile, fileContent);
              }}
              className="text-xs px-2 py-1 bg-emerald-500 text-black rounded font-medium hover:bg-emerald-400 transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "editor" ? "" : "hidden"}`}>
          <div className="w-56 overflow-y-auto border-r border-white/5 bg-[#0e0e11] shrink-0">
            <FileTree
              tree={tree}
              selectedPath={selectedFile}
              onSelect={(p) => {
                openFile(p);
              }}
              workspaceId={workspaceId}
              onRefresh={fetchTree}
              onDeleteWorkspace={() => {
                setSelectedFile(null);
                setFileContent("");
              }}
              onWorkspaceIdChange={setWorkspaceId}
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0 bg-[#0e0e11]">
            {selectedFile ? (
              isDiffMode ? (
                <DiffEditor
                  height="100%"
                  theme="vs-dark"
                  original={originalContent}
                  modified={fileContent}
                  language={selectedFile.split(".").pop() || "plaintext"}
                  options={{
                    minimap: { enabled: false },
                    readOnly: false,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  onMount={(editor) => {
                    editor.getModifiedEditor().onDidChangeModelContent(() => {
                      setFileContent(editor.getModifiedEditor().getValue());
                    });
                  }}
                />
              ) : (
                <Editor
                  height="100%"
                  theme="vs-dark"
                  value={fileContent}
                  language={selectedFile.split(".").pop() || "plaintext"}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    wordWrap: "on",
                  }}
                  onChange={(v) => setFileContent(v || "")}
                  onMount={(editor, monaco) => {
                    handleEditorMount(editor, monaco);
                  }}
                />
              )
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Select a file to view
              </div>
            )}
          </div>
        </div>

        {/* Browser Preview Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "browser" ? "" : "hidden"}`}>
          <BrowserPreview />
        </div>

        {/* Terminal Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "terminal" ? "" : "hidden"}`}>
          <TerminalUI workspaceId={workspaceId} />
        </div>

        {/* Git Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "git" ? "" : "hidden"}`}>
          <GitUI
            workspaceId={workspaceId}
            onOpenFile={(p) => {
              openFile(p);
              setIdeTab("editor");
            }}
            onRefreshWorkspace={fetchTree}
          />
        </div>

        {/* Search Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "search" ? "" : "hidden"}`}>
          {ideTab === "search" && (
            <SearchUI
              workspaceId={workspaceId}
              onOpen={(p, line) => {
                openFile(p);
                setIdeTab("editor");
                if (line) {
                  setTargetLine(line);
                }
              }}
            />
          )}
        </div>

        {/* Database Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "db" ? "" : "hidden"}`}>
          {ideTab === "db" && <DatabaseManager workspaceId={workspaceId} />}
        </div>

        {/* Debugger Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "debugger" ? "" : "hidden"}`}>
          {ideTab === "debugger" && <DebuggerPanel workspaceId={workspaceId} />}
        </div>

        {/* Package Manager Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "package" ? "" : "hidden"}`}>
          {ideTab === "package" && <PackageManager workspaceId={workspaceId} />}
        </div>

        {/* AI UI Builder Tab */}
        <div className={`flex-1 flex overflow-hidden ${ideTab === "builder" ? "" : "hidden"}`}>
          {ideTab === "builder" && (
            <AIBuilder workspaceId={workspaceId} onRefreshWorkspace={fetchTree} />
          )}
        </div>
      </div>
    </div>
  );
};
