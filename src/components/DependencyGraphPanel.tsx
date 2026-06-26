import { useState, useEffect, useRef, useMemo } from "react";
import { useWorkspaceContext } from "../contexts/WorkspaceContext";
import { 
  Network, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  FileText, 
  Activity, 
  RefreshCw, 
  Info,
  ExternalLink,
  AlertTriangle
} from "lucide-react";

interface Node {
  id: string;
  label: string;
  type: 'file';
  symbols: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Link {
  source: string;
  target: string;
  symbols: string[];
}

interface DependencyGraphPanelProps {
  workspaceId: string;
  setIdeTab: (tab: "editor" | "browser" | "terminal" | "search" | "git" | "db" | "debugger" | "package" | "builder" | "planner" | "trajectory" | "ast" | "sandbox") => void;
}

export function DependencyGraphPanel({ workspaceId, setIdeTab }: DependencyGraphPanelProps) {
  const { openFile } = useWorkspaceContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Zoom/Pan State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  
  // Physics dragging state
  const draggedNodeId = useRef<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);

  // Fetch graph data
  const fetchGraph = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ast/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) throw new Error("Failed to fetch dependency graph");
      const data = await res.json();
      if (data.success) {
        // Initialize position
        const initializedNodes = (data.nodes || []).map((node: any, i: number) => {
          const angle = (i / data.nodes.length) * 2 * Math.PI;
          const radius = 150 + Math.random() * 50;
          return {
            ...node,
            x: 400 + Math.cos(angle) * radius,
            y: 300 + Math.sin(angle) * radius,
            vx: 0,
            vy: 0
          };
        });
        setNodes(initializedNodes);
        setLinks(data.links || []);
      } else {
        throw new Error(data.error || "Unknown error parsing graph");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load AST graph");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [workspaceId]);

  // Dynamic simulation loop (Force-directed layout)
  useEffect(() => {
    if (nodes.length === 0) return;

    let alpha = 1.0; // Temperature parameter
    const decay = 0.985;
    const center = { x: 400, y: 300 };

    const tick = () => {
      if (alpha < 0.01 && !draggedNodeId.current) {
        animationRef.current = null;
        return; // cooled down
      }

      setNodes(prevNodes => {
        // Create lookup
        const nodeMap = new Map(prevNodes.map(n => [n.id, n]));

        // Calculate forces
        // 1. Repulsion (all nodes push each other away)
        for (let i = 0; i < prevNodes.length; i++) {
          const n1 = prevNodes[i];
          for (let j = i + 1; j < prevNodes.length; j++) {
            const n2 = prevNodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);
            
            // Repulsion strength inversely proportional to distance
            const force = 1800 / distSq; 
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.id !== draggedNodeId.current) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (n2.id !== draggedNodeId.current) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }

        // 2. Link Attraction (connected nodes pull together)
        links.forEach(link => {
          const sourceNode = nodeMap.get(link.source);
          const targetNode = nodeMap.get(link.target);
          if (sourceNode && targetNode) {
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Pull force proportional to distance (spring stiffness 0.04)
            const targetDist = 90; // desired link length
            const force = (dist - targetDist) * 0.04;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (sourceNode.id !== draggedNodeId.current) {
              sourceNode.vx += fx;
              sourceNode.vy += fy;
            }
            if (targetNode.id !== draggedNodeId.current) {
              targetNode.vx -= fx;
              targetNode.vy -= fy;
            }
          }
        });

        // 3. Gravity & Center force
        prevNodes.forEach(node => {
          if (node.id === draggedNodeId.current) return;
          
          const dx = center.x - node.x;
          const dy = center.y - node.y;
          node.vx += dx * 0.008;
          node.vy += dy * 0.008;

          // Apply velocity and drag (friction)
          node.x += node.vx * alpha;
          node.y += node.vy * alpha;
          node.vx *= 0.85;
          node.vy *= 0.85;
        });

        alpha *= decay;
        return [...prevNodes];
      });

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [nodes.length, links]);

  // Restart physics loop on action
  const heatSimulation = () => {
    if (!animationRef.current) {
      // Re-trigger loop
      setNodes(prev => prev.map(n => ({ ...n, vx: n.vx || 0, vy: n.vy || 0 })));
    }
  };

  // Node Drag Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    draggedNodeId.current = nodeId;
    heatSimulation();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId.current) {
      const svg = canvasRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // Translate screen coordinates to SVG viewport space with scale and pan
      const clickX = (e.clientX - rect.left - pan.x) / scale;
      const clickY = (e.clientY - rect.top - pan.y) / scale;

      setNodes(prev => prev.map(n => {
        if (n.id === draggedNodeId.current) {
          return {
            ...n,
            x: clickX,
            y: clickY,
            vx: 0,
            vy: 0
          };
        }
        return n;
      }));
    } else if (isDraggingCanvas.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({
        x: dragStart.current.x + dx - dragStart.current.offsetX,
        y: dragStart.current.y + dy - dragStart.current.offsetY
      });
    }
  };

  const handleMouseUp = () => {
    draggedNodeId.current = null;
    isDraggingCanvas.current = false;
  };

  // Canvas Drag Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    isDraggingCanvas.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - pan.x,
      offsetY: e.clientY - pan.y
    };
  };

  // Zoom Helpers
  const zoomIn = () => setScale(s => Math.min(s * 1.2, 4));
  const zoomOut = () => setScale(s => Math.max(s / 1.2, 0.2));
  const resetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    // Reset positions to circle
    setNodes(prev => prev.map((node, i) => {
      const angle = (i / prev.length) * 2 * Math.PI;
      const radius = 150 + Math.random() * 50;
      return {
        ...node,
        x: 400 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0
      };
    }));
    heatSimulation();
  };

  // Double click handler to open file
  const handleNodeDoubleClick = (filePath: string) => {
    openFile(filePath);
    setIdeTab("editor");
  };

  // Filter and compute matches
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.map(n => ({
      ...n,
      isMatch: n.id.toLowerCase().includes(q) || n.symbols.some(s => s.toLowerCase().includes(q))
    }));
  }, [nodes, searchQuery]);

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const selectedNodeDeps = useMemo(() => {
    if (!selectedNodeId) return { imports: [], dependents: [] };
    const imports = links.filter(l => l.source === selectedNodeId);
    const dependents = links.filter(l => l.target === selectedNodeId);
    return { imports, dependents };
  }, [links, selectedNodeId]);

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#0a0a0d] text-slate-300 overflow-hidden font-sans select-none">
      {/* Sidebar Controls */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-white/5 bg-[#0f0f14] flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Dependency Graph</span>
          </div>
          <button 
            onClick={fetchGraph} 
            disabled={loading}
            className="p-1.5 hover:bg-white/5 rounded-md text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/5 relative">
          <input
            type="text"
            placeholder="Search files or symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161620] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-7 top-1/2 -translate-y-1/2" />
        </div>

        {/* Selected Node Details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedNode ? (
            <div className="space-y-4">
              {/* File Info */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Selected Node</span>
                  <button 
                    onClick={() => handleNodeDoubleClick(selectedNode.id)}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Open <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="p-3 bg-[#161620] rounded-xl border border-white/5 flex items-start gap-3">
                  <FileText className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="overflow-hidden">
                    <span className="text-xs font-bold text-white block truncate">{selectedNode.label}</span>
                    <span className="text-[9px] text-slate-500 font-mono block truncate">{selectedNode.id}</span>
                  </div>
                </div>
              </div>

              {/* Declared Symbols */}
              {selectedNode.symbols.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Declared Symbols ({selectedNode.symbols.length})</span>
                  <div className="p-2 bg-[#0a0a0e] rounded-lg border border-white/5 max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
                    {selectedNode.symbols.map((symbol, idx) => {
                      const [type, name] = symbol.split(":");
                      return (
                        <div key={idx} className="flex items-center justify-between text-[10px] font-mono py-0.5">
                          <span className="text-white truncate pr-2">{name}</span>
                          <span className={`text-[8px] px-1 py-0.2 rounded shrink-0 ${
                            type === 'function' ? 'bg-blue-500/10 text-blue-400' :
                            type === 'class' ? 'bg-purple-500/10 text-purple-400' :
                            type === 'interface' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                          }`}>{type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Import Links */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Imports ({selectedNodeDeps.imports.length})</span>
                  {selectedNodeDeps.imports.length === 0 ? (
                    <span className="text-[10px] text-slate-600 italic block">No local workspace dependencies</span>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedNodeDeps.imports.map((dep, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedNodeId(dep.target)}
                          className="p-2 rounded bg-[#13131c] border border-white/5 text-[10px] hover:border-emerald-500/20 cursor-pointer"
                        >
                          <span className="text-white font-mono block truncate">{dep.target}</span>
                          {dep.symbols.length > 0 && dep.symbols[0] !== '*' && (
                            <span className="text-slate-500 text-[9px] block truncate font-mono">
                              Symbols: {dep.symbols.join(", ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Imported By ({selectedNodeDeps.dependents.length})</span>
                  {selectedNodeDeps.dependents.length === 0 ? (
                    <span className="text-[10px] text-slate-600 italic block">No local dependents</span>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedNodeDeps.dependents.map((dep, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedNodeId(dep.source)}
                          className="p-2 rounded bg-[#13131c] border border-white/5 text-[10px] hover:border-emerald-500/20 cursor-pointer"
                        >
                          <span className="text-white font-mono block truncate">{dep.source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-600 text-[11px] text-center gap-1.5">
              <Info className="w-5 h-5 text-slate-700" />
              <span>Select a file node in the graph to view imports and declared code symbols.</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Dependency Graph Canvas */}
      <div 
        className="flex-1 relative bg-[#07070a] overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
      >
        {loading && (
          <div className="absolute inset-0 bg-[#07070a]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Analyzing codebase AST relations...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-[#07070a] z-10 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <span className="text-xs text-rose-400 font-mono font-bold">Failed to load graph</span>
            <span className="text-xs text-slate-500 max-w-sm leading-relaxed">{error}</span>
            <button 
              onClick={fetchGraph}
              className="mt-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        )}

        {/* Control floating buttons */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 bg-[#0f0f14]/80 backdrop-blur border border-white/5 p-2 rounded-xl">
          <button onClick={zoomIn} className="p-2 hover:bg-white/5 text-slate-300 rounded-lg transition-colors" title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={zoomOut} className="p-2 hover:bg-white/5 text-slate-300 rounded-lg transition-colors" title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetZoom} className="p-2 hover:bg-white/5 text-slate-300 rounded-lg transition-colors" title="Reset View">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* SVG Render */}
        <svg
          ref={canvasRef}
          className="w-full h-full"
          style={{ transform: `scale(1)` }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Draw Links */}
            {links.map((link, idx) => {
              const sourceNode = nodes.find(n => n.id === link.source);
              const targetNode = nodes.find(n => n.id === link.target);
              if (!sourceNode || !targetNode) return null;
              
              const isSelected = selectedNodeId === link.source || selectedNodeId === link.target;
              
              return (
                <g key={idx}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isSelected ? "#10b981" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isSelected ? 1.5 : 1}
                    markerEnd="url(#arrow)"
                    className="transition-all duration-300"
                  />
                </g>
              );
            })}

            {/* Draw Nodes */}
            {filteredNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isMatch = (node as any).isMatch !== false;
              
              return (
                <g 
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  onDoubleClick={() => handleNodeDoubleClick(node.id)}
                >
                  {/* Glowing aura for selected/matching */}
                  {isSelected && (
                    <circle r={14} fill="rgba(16, 185, 129, 0.2)" className="animate-ping" />
                  )}
                  
                  <circle
                    r={isSelected ? 8 : 6}
                    fill={isSelected ? "#10b981" : "#1f2937"}
                    stroke={
                      isSelected ? "#34d399" : 
                      !isMatch ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.2)"
                    }
                    strokeWidth={1.5}
                    className="transition-all duration-300"
                  />

                  {/* Node Text Label */}
                  <text
                    y={-12}
                    textAnchor="middle"
                    fill={isSelected ? "#10b981" : !isMatch ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                    fontSize={10}
                    fontFamily="monospace"
                    className="pointer-events-none select-none font-bold filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* SVG Arrowhead Marker definition */}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX={18}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.15)" />
            </marker>
          </defs>
        </svg>
      </div>
    </div>
  );
}
