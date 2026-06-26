import { Settings, defaultSystemPrompt } from '../types';
import { Settings as SettingsIcon, Github, Box, RefreshCw, Key, RotateCcw } from 'lucide-react';

interface Props {
  settings: Settings;
  setSettings: (s: Settings) => void;
  models: string[];
  modelsError: string | null;
  loadModels: () => void;
  initializeWorkspace: () => void;
  workspaceId: string;
  onWorkspaceIdChange: (id: string) => void;
  availableWorkspaces: string[];
  onRefreshWorkspaces: () => void;
}

export function SettingsPanel({
  settings,
  setSettings,
  models,
  modelsError,
  loadModels,
  initializeWorkspace,
  workspaceId,
  onWorkspaceIdChange,
  availableWorkspaces,
  onRefreshWorkspaces,
}: Props) {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-[#1e1e24] shadow-2xl p-6 border border-white/5 mx-auto">
      <div className="flex items-center space-x-3 mb-6 border-b border-white/10 pb-4">
        <SettingsIcon className="w-6 h-6 text-emerald-400" />
        <h2 className="text-xl font-semibold text-white">Workstation Setup</h2>
      </div>

      <div className="space-y-6">
        {/* API Provider Toggle */}
        <div className="bg-[#15151a] p-1 rounded-xl flex items-center gap-1 border border-white/5">
          <button
            onClick={() => setSettings({ ...settings, apiProvider: 'ollama' })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              settings.apiProvider === 'ollama' ? 'bg-[#34343d] text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Ollama
          </button>
          <button
            onClick={() => setSettings({ ...settings, apiProvider: 'gemini' })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              settings.apiProvider === 'gemini' ? 'bg-[#34343d] text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Gemini
          </button>
          <button
            onClick={() => setSettings({ ...settings, apiProvider: 'lmstudio' })}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              settings.apiProvider === 'lmstudio' ? 'bg-[#34343d] text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            LM Studio
          </button>
        </div>

        {settings.apiProvider === 'ollama' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Ollama URL</label>
              <div className="flex gap-2">
                 <input
                   className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-transparent shadow-inner font-mono text-sm leading-tight"
                   value={settings.ollamaUrl}
                   onChange={e => setSettings({ ...settings, ollamaUrl: e.target.value })}
                 />
                 <button
                   onClick={loadModels}
                   className="p-3 bg-[#2a2a32] hover:bg-[#34343d] rounded-xl text-emerald-400 transition-colors shrink-0 flex items-center justify-center border border-transparent"
                   title="Refresh Models"
                 >
                   <RefreshCw className="w-5 h-5" />
                 </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                 <Box className="w-4 h-4" /> Setup Model
              </label>
              <select
                className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
                value={settings.ollamaModel}
                onChange={e => setSettings({ ...settings, ollamaModel: e.target.value })}
              >
                <option value="">Select a model...</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {modelsError && <p className="text-rose-400 text-xs mt-1">{modelsError}</p>}
            </div>
          </div>
        )}

        {settings.apiProvider === 'lmstudio' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">LM Studio Server URL</label>
              <div className="flex gap-2">
                 <input
                   className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-transparent shadow-inner font-mono text-sm leading-tight"
                   value={settings.lmStudioUrl}
                   onChange={e => setSettings({ ...settings, lmStudioUrl: e.target.value })}
                   placeholder="http://localhost:1234"
                 />
                 <button
                   onClick={loadModels}
                   className="p-3 bg-[#2a2a32] hover:bg-[#34343d] rounded-xl text-emerald-400 transition-colors shrink-0 flex items-center justify-center border border-transparent"
                   title="Refresh Models"
                 >
                   <RefreshCw className="w-5 h-5" />
                 </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                 <Box className="w-4 h-4" /> Local Model
              </label>
              <select
                className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
                value={settings.lmStudioModel}
                onChange={e => setSettings({ ...settings, lmStudioModel: e.target.value })}
              >
                <option value="">Select a model...</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {modelsError && <p className="text-rose-400 text-xs mt-1">{modelsError}</p>}
            </div>
          </div>
        )}

        {settings.apiProvider === 'gemini' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                 <Key className="w-4 h-4" /> API Key
              </label>
              <input
                type="password"
                placeholder="AIza..."
                className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-transparent shadow-inner font-mono text-sm leading-tight"
                value={settings.geminiApiKey}
                onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                   <Box className="w-4 h-4" /> Select Model
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer appearance-none"
                    value={
                      ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-pro-exp-02-05', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'].includes(settings.geminiModel)
                        ? settings.geminiModel
                        : 'custom'
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setSettings({ ...settings, geminiModel: 'gemini-2.0-flash-thinking-exp' });
                      } else {
                        setSettings({ ...settings, geminiModel: val });
                      }
                    }}
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro Exp</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="custom">Custom Model (type manually)...</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {(!['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-pro-exp-02-05', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'].includes(settings.geminiModel)) && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <label className="text-xs font-medium text-slate-500">Custom Model Identifier</label>
                  <input
                    className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner font-mono text-sm leading-tight"
                    value={settings.geminiModel}
                    onChange={e => setSettings({ ...settings, geminiModel: e.target.value })}
                    placeholder="e.g. gemini-2.0-flash-thinking-exp"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {/* AI Autocomplete Toggle */}
        <div className="flex items-center justify-between bg-[#15151a] p-4 rounded-xl border border-white/5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-white">AI Autocomplete</span>
            <span className="text-[10px] text-slate-500">Ghost text inline completions</span>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enableAutocomplete: !settings.enableAutocomplete })}
            className={`w-11 h-6 rounded-full transition-all relative ${settings.enableAutocomplete ? "bg-emerald-500" : "bg-[#2a2a32]"}`}
          >
            <div className={`w-4 h-4 bg-[#09090b] rounded-full absolute top-1 transition-all ${settings.enableAutocomplete ? "left-6" : "left-1"}`} />
          </button>
        </div>

        {/* Max Agent Steps (Iterations) */}
        <div className="bg-[#15151a] p-4 rounded-xl border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white">Max Agent Steps</span>
              <span className="text-[10px] text-slate-500">Max ReAct iterations per query</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-[#22222d] border border-white/10 px-2 py-0.5 rounded">
              {settings.maxIterations || 30}
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={settings.maxIterations || 30}
            onChange={e => setSettings({ ...settings, maxIterations: Number(e.target.value) })}
            className="w-full h-1 bg-[#2a2a32] rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        <hr className="border-white/10" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
               System Prompt
            </label>
            <button
              onClick={() => setSettings({ ...settings, systemPrompt: defaultSystemPrompt })}
              className="text-xs text-slate-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              title="Reset to default prompt"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
          <textarea
            className="w-full h-80 bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-transparent shadow-inner font-mono text-xs leading-relaxed resize-y"
            value={settings.systemPrompt}
            onChange={e => setSettings({ ...settings, systemPrompt: e.target.value })}
            placeholder="You are an AI coding agent..."
          />
        </div>

        <hr className="border-white/10" />

        {/* Workspace Manager */}
        <div className="space-y-4 bg-[#15151a] p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              📁 Workspace Folder
            </label>
            <button
              onClick={onRefreshWorkspaces}
              className="text-xs text-slate-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              title="Scan existing workspaces"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 block leading-relaxed">
              Active Workspace Folder name (e.g. <code>mq75d8</code>):
            </span>
            <input
              className="w-full bg-[#2a2a32] text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-transparent shadow-inner font-mono text-xs leading-tight"
              value={workspaceId}
              onChange={e => onWorkspaceIdChange(e.target.value.trim())}
              placeholder="e.g. mq75d8"
            />
          </div>

          {availableWorkspaces.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] text-slate-500 block">
                Found existing folders in <code>.agent_workspace/</code>:
              </span>
              <select
                className="w-full bg-[#2a2a32] text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-xs cursor-pointer"
                value={availableWorkspaces.includes(workspaceId) ? workspaceId : ''}
                onChange={e => {
                  if (e.target.value) {
                     onWorkspaceIdChange(e.target.value);
                  }
                }}
              >
                <option value="">-- Choose existing --</option>
                {availableWorkspaces.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          )}
          
          <p className="text-[10px] text-slate-500 leading-normal">
            * To read a cloned project, make sure the working folder above matches its folder name inside <code>.agent_workspace</code>.
          </p>
        </div>

        <hr className="border-white/10" />

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
             <Github className="w-4 h-4" /> GitHub Repository
          </label>
          <input
            placeholder="https://github.com/user/repo"
            className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-mono leading-tight"
            value={settings.repoUrl}
            onChange={e => setSettings({ ...settings, repoUrl: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">GitHub Access Token (Optional)</label>
          <input
            type="password"
            placeholder="ghp_..."
            className="w-full bg-[#2a2a32] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono text-sm leading-tight"
            value={settings.githubToken}
            onChange={e => setSettings({ ...settings, githubToken: e.target.value })}
          />
        </div>
      </div>
      
      <button 
         onClick={initializeWorkspace}
         disabled={!settings.repoUrl}
         className="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 text-[#09090b] font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.3)] shadow-emerald-500/20"
      >
        Clone & Setup Workspace
      </button>

    </div>
  );
}
