import { useEffect, useState } from 'react';

export function useTerminalTabs(workspaceId: string) {
  const [tabs, setTabs] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`terminal_tabs_${workspaceId}`);
      return saved ? JSON.parse(saved) : ['1'];
    }
    return ['1'];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`terminal_active_tab_${workspaceId}`);
      return saved || '1';
    }
    return '1';
  });

  useEffect(() => {
    localStorage.setItem(`terminal_tabs_${workspaceId}`, JSON.stringify(tabs));
  }, [tabs, workspaceId]);

  useEffect(() => {
    localStorage.setItem(`terminal_active_tab_${workspaceId}`, activeTabId);
  }, [activeTabId, workspaceId]);

  const addTab = () => {
    const nextId = String(Math.max(...tabs.map(t => parseInt(t, 10) || 1), 0) + 1);
    setTabs(prev => [...prev, nextId]);
    setActiveTabId(nextId);
  };

  const removeTab = (tabIdToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    if (activeTabId === tabIdToRemove) {
      const nextActive = tabs.find(t => t !== tabIdToRemove) || '1';
      setActiveTabId(nextActive);
    }
    setTabs(prev => prev.filter(t => t !== tabIdToRemove));
  };

  return { tabs, activeTabId, setActiveTabId, addTab, removeTab };
}
