import { useState, useEffect } from "react";
import { Loader2, Database, Play, RefreshCw, Table, AlertCircle, FileSpreadsheet } from "lucide-react";

interface DatabaseManagerProps {
  workspaceId: string;
}

export function DatabaseManager({ workspaceId }: DatabaseManagerProps) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [tables, setTables] = useState<string[]>([]);
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<{
    type: "select" | "write";
    columns?: string[];
    rows?: Record<string, any>[];
    affectedRows?: number;
    lastInsertRowid?: number;
  } | null>(null);

  const fetchDatabases = async () => {
    try {
      setError(null);
      const res = await fetch("/api/db/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDatabases(data.databases || []);
        if (data.databases?.length > 0 && !selectedDb) {
          setSelectedDb(data.databases[0]);
        }
      }
    } catch (err: any) {
      setError("Failed to fetch databases: " + err.message);
    }
  };

  const fetchTables = async (db: string) => {
    if (!db) return;
    try {
      setError(null);
      const res = await fetch("/api/db/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, dbPath: db }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTables(data.tables || []);
        } else {
          setError(data.error);
        }
      }
    } catch (err: any) {
      setError("Failed to fetch tables: " + err.message);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, [workspaceId]);

  useEffect(() => {
    if (selectedDb) {
      fetchTables(selectedDb);
      setQueryResult(null);
      setQuery("");
    } else {
      setTables([]);
    }
  }, [selectedDb]);

  const handleExecute = async (sqlToRun?: string) => {
    const activeQuery = sqlToRun || query;
    if (!selectedDb || !activeQuery.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          dbPath: selectedDb,
          query: activeQuery,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueryResult(data);
      } else {
        setError(data.error || "Query failed to execute");
      }
    } catch (err: any) {
      setError("Execution error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (tableName: string) => {
    const defaultQuery = `SELECT * FROM ${tableName} LIMIT 50;`;
    setQuery(defaultQuery);
    handleExecute(defaultQuery);
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e11] text-slate-300">
      {/* Top control bar */}
      <div className="p-4 border-b border-white/5 bg-[#141419] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            Database Manager
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
            className="bg-[#1e1e24] text-xs text-white border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[200px]"
          >
            {databases.length === 0 ? (
              <option value="">No SQLite DBs found</option>
            ) : (
              databases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))
            )}
          </select>
          <button
            onClick={fetchDatabases}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Refresh database list"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Tables List */}
        <div className="w-48 border-r border-white/5 bg-[#0b0b0e] flex flex-col shrink-0">
          <div className="p-3 border-b border-white/5 text-[10px] uppercase font-bold text-slate-500 tracking-wider flex justify-between items-center">
            <span>Tables</span>
            <span className="bg-white/5 text-slate-400 px-1.5 py-0.5 rounded text-[9px]">
              {tables.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {tables.length === 0 ? (
              <div className="text-center py-6 text-slate-600 text-xs font-mono">
                No tables
              </div>
            ) : (
              tables.map((table) => (
                <button
                  key={table}
                  onClick={() => handleTableClick(table)}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2 hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Table className="w-3.5 h-3.5 text-emerald-500/70" />
                  <span className="truncate">{table}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Query Area and Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Query editor */}
          <div className="p-3 bg-[#111116] border-b border-white/5 flex flex-col gap-2 shrink-0">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM users WHERE active = 1; (Ctrl+Enter to Run)"
              className="w-full h-24 bg-[#18181f] text-slate-200 text-xs font-mono p-3 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
            />
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-mono">
                Supports sqlite3 syntax. Transactions committed automatically.
              </span>
              <button
                onClick={() => handleExecute()}
                disabled={loading || !selectedDb || !query.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                Execute
              </button>
            </div>
          </div>

          {/* Results section */}
          <div className="flex-1 overflow-auto bg-[#09090b]">
            {error && (
              <div className="m-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-2.5 text-rose-400 text-xs font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {!error && !queryResult && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-700/50" />
                <p className="text-xs">No query executed yet. Run a query or click a table to inspect.</p>
              </div>
            )}

            {!error && queryResult && (
              <div className="p-4">
                {queryResult.type === "write" ? (
                  <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-4 text-xs font-mono space-y-1">
                    <p className="text-emerald-400 font-semibold">✔ Query Executed Successfully</p>
                    <p className="text-slate-400">Affected Rows: {queryResult.affectedRows}</p>
                    {queryResult.lastInsertRowid !== undefined && (
                      <p className="text-slate-400">Last Insert Row ID: {queryResult.lastInsertRowid}</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-white/5 rounded-xl bg-[#0e0e11]">
                    <table className="w-full text-left border-collapse font-mono text-[11px]">
                      <thead>
                        <tr className="bg-[#1a1a20] border-b border-white/10 text-slate-400">
                          {queryResult.columns?.map((col) => (
                            <th key={col} className="p-2.5 font-semibold select-all border-r border-white/5">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows?.length === 0 ? (
                          <tr>
                            <td
                              colSpan={queryResult.columns?.length || 1}
                              className="p-6 text-center text-slate-500"
                            >
                              No rows returned
                            </td>
                          </tr>
                        ) : (
                          queryResult.rows?.map((row, index) => (
                            <tr
                              key={index}
                              className="border-b border-white/5 hover:bg-white/[0.02] text-slate-300"
                            >
                              {queryResult.columns?.map((col) => {
                                const val = row[col];
                                return (
                                  <td
                                    key={col}
                                    className="p-2 border-r border-white/5 truncate max-w-[200px]"
                                    title={val !== null ? String(val) : "NULL"}
                                  >
                                    {val === null ? (
                                      <span className="text-slate-600 italic">NULL</span>
                                    ) : typeof val === "boolean" ? (
                                      val ? (
                                        "true"
                                      ) : (
                                        "false"
                                      )
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
