import { useState, useEffect } from "react";
import { useEventBus } from "../useEventBus";
import { Package, Search, Plus, Trash2, Loader2, ArrowUpRight, Check, ShieldAlert } from "lucide-react";

interface PackageManagerProps {
  workspaceId: string;
}

interface PackageJsonInfo {
  hasPackageJson: boolean;
  name?: string;
  version?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface RegistryPackage {
  name: string;
  version: string;
  description: string;
  links: {
    npm: string;
  };
}

export function PackageManager({ workspaceId }: PackageManagerProps) {
  const [pkgInfo, setPkgInfo] = useState<PackageJsonInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<RegistryPackage[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"installed" | "search">("installed");

  // Installation Modal / Console state
  const [installing, setInstalling] = useState<boolean>(false);
  const [installerSessionId, setInstallerSessionId] = useState<string>("");
  const [installerLogs, setInstallerLogs] = useState<string>("");

  const loadPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/package/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPkgInfo(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [workspaceId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
          searchQuery
        )}&size=12`
      );
      if (res.ok) {
        const data = await res.json();
        const results = data.objects.map((o: any) => ({
          name: o.package.name,
          version: o.package.version,
          description: o.package.description,
          links: o.package.links,
        }));
        setSearchResults(results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const startNpmCommand = async (cmd: string) => {
    setInstalling(true);
    setInstallerLogs("Starting installation process...\n");
    try {
      const startRes = await fetch("/api/debug/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, command: cmd }),
      });
      if (startRes.ok) {
        const data = await startRes.json();
        if (data.success) {
          setInstallerSessionId(data.sessionId);
          pollInstallerLogs(data.sessionId);
        }
      }
    } catch (e: any) {
      setInstallerLogs((l) => l + `Error: ${e.message}\n`);
      setInstalling(false);
    }
  };

  const { subscribe } = useEventBus(workspaceId);

  useEffect(() => {
    if (!installerSessionId) return;

    const unsubscribe = subscribe("debug:log", (data) => {
      if (data && data.sessionId === installerSessionId) {
        setInstallerLogs(data.logs || "");
        if (data.status && data.status !== "running") {
          setInstalling(false);
          loadPackages(); // Refresh package list
        }
      }
    });

    return unsubscribe;
  }, [installerSessionId, subscribe, loadPackages]);

  const pollInstallerLogs = (id: string) => {
    // Handled in useEffect via WebSocket event subscription
  };

  const handleInit = () => {
    startNpmCommand("npm init -y");
  };

  const handleInstall = (pkgName: string, isDev = false) => {
    const cmd = `npm install ${pkgName}${isDev ? " --save-dev" : ""}`;
    startNpmCommand(cmd);
  };

  const handleUninstall = (pkgName: string) => {
    if (confirm(`Are you sure you want to uninstall ${pkgName}?`)) {
      startNpmCommand(`npm uninstall ${pkgName}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e11] text-slate-300 relative">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-[#141419] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            NPM Package Manager
          </span>
        </div>
        <div className="flex bg-[#1e1e24] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("installed")}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              activeTab === "installed" ? "bg-[#34343d] text-white" : "text-slate-400"
            }`}
          >
            Installed
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              activeTab === "search" ? "bg-[#34343d] text-white" : "text-slate-400"
            }`}
          >
            Add Package
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 font-mono">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mr-2" />
            Loading project dependencies...
          </div>
        ) : activeTab === "installed" ? (
          <div>
            {!pkgInfo?.hasPackageJson ? (
              <div className="max-w-md mx-auto my-12 p-6 bg-[#18181f] border border-white/5 rounded-2xl text-center space-y-4 shadow-xl">
                <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className="text-sm font-semibold text-white">No package.json Found</h3>
                <p className="text-xs text-slate-400">
                  This workspace is not initialized as an npm project. Would you like to initialize it?
                </p>
                <button
                  onClick={handleInit}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-medium rounded-xl transition-colors"
                >
                  Run npm init -y
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-[#111116] p-3 border border-white/5 rounded-xl text-xs font-mono">
                  <span>Project: <strong className="text-white">{pkgInfo.name}</strong></span>
                  <span>Version: <strong className="text-white">v{pkgInfo.version}</strong></span>
                </div>

                {/* Dependencies */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Dependencies ({Object.keys(pkgInfo.dependencies || {}).length})
                  </h3>
                  {Object.keys(pkgInfo.dependencies || {}).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No production dependencies</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(pkgInfo.dependencies).map(([name, ver]) => (
                        <div
                          key={name}
                          className="p-3 bg-[#111116] border border-white/5 hover:border-white/10 rounded-xl flex justify-between items-center transition-all"
                        >
                          <div className="overflow-hidden mr-2">
                            <h4 className="text-xs font-semibold text-slate-200 truncate">{name}</h4>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{ver}</p>
                          </div>
                          <button
                            onClick={() => handleUninstall(name)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-colors"
                            title="Uninstall package"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dev Dependencies */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Dev Dependencies ({Object.keys(pkgInfo.devDependencies || {}).length})
                  </h3>
                  {Object.keys(pkgInfo.devDependencies || {}).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No development dependencies</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(pkgInfo.devDependencies).map(([name, ver]) => (
                        <div
                          key={name}
                          className="p-3 bg-[#111116] border border-white/5 hover:border-white/10 rounded-xl flex justify-between items-center transition-all"
                        >
                          <div className="overflow-hidden mr-2">
                            <h4 className="text-xs font-semibold text-slate-200 truncate">{name}</h4>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{ver}</p>
                          </div>
                          <button
                            onClick={() => handleUninstall(name)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-colors"
                            title="Uninstall package"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search packages on npm..."
                  className="w-full bg-[#18181f] text-xs text-white border border-white/10 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                {searching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Search
              </button>
            </form>

            {/* Registry Search Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map((pkg) => (
                <div
                  key={pkg.name}
                  className="p-4 bg-[#111116] border border-white/5 hover:border-white/10 rounded-xl flex flex-col justify-between transition-all space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className="text-xs font-semibold text-white truncate max-w-[140px]" title={pkg.name}>
                        {pkg.name}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                        v{pkg.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 leading-normal">
                      {pkg.description}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleInstall(pkg.name)}
                      className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Prod
                    </button>
                    <button
                      onClick={() => handleInstall(pkg.name, true)}
                      className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Dev
                    </button>
                    <a
                      href={pkg.links.npm}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {searchResults.length === 0 && !searching && searchQuery && (
              <p className="text-center py-12 text-slate-500 text-xs">No packages found for "{searchQuery}"</p>
            )}
          </div>
        )}
      </div>

      {/* Installing Terminal Modal Overlayer */}
      {installing && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[70vh] overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-[#141419] flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running npm command...</span>
              </div>
            </div>
            <div className="flex-1 p-4 bg-[#050508] font-mono text-[11px] leading-relaxed overflow-y-auto whitespace-pre-wrap select-text selection:bg-emerald-500/30 text-slate-300">
              {installerLogs}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
