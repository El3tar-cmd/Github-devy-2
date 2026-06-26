import { useState, useCallback, useEffect } from 'react';
import { FileNode } from './types';
import { useEventBus } from './useEventBus';

export function useWorkspace(workspaceId: string) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  const fetchTree = useCallback(async () => {
    try {
      if (!workspaceId) return;
      const res = await fetch('/api/fs/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '.', workspaceId })
      });
      if (res.ok) {
        const data = await res.json();
        setTree(data.files || []);
        setIsWorkspaceReady(true);
      }
    } catch (err) {
      console.error('Failed to fetch tree:', err);
    }
  }, [workspaceId]);

  const [originalContent, setOriginalContent] = useState('');

  const openFile = useCallback(async (path: string) => {
    try {
      if (!workspaceId) return;
      const res = await fetch('/api/fs/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, workspaceId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.content);
        setOriginalContent(data.content);
        setSelectedFile(path);
      }
    } catch (err) {
      console.error('Failed to read file', err);
    }
  }, [workspaceId]);

  const saveFile = useCallback(async (path: string, content: string) => {
    try {
      if (!workspaceId) return;
      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content, workspaceId })
      });
      setFileContent(content);
      setOriginalContent(content); // Update base for diff
    } catch (err) {
      console.error('Failed to save file');
    }
  }, [workspaceId]);

  // Reset selected file and fetch tree when workspaceId changes
  useEffect(() => {
    setSelectedFile(null);
    setFileContent('');
    setOriginalContent('');
    setIsWorkspaceReady(false);
    fetchTree();
  }, [workspaceId, fetchTree]);

  const { subscribe } = useEventBus(workspaceId);

  // Subscribe to file system changes via EventBus
  useEffect(() => {
    if (!workspaceId) return;
    return subscribe('fs:changed', () => {
      fetchTree();
    });
  }, [workspaceId, subscribe, fetchTree]);

  return {
    tree,
    fetchTree,
    selectedFile,
    setSelectedFile,
    fileContent,
    originalContent,
    openFile,
    saveFile,
    setFileContent,
    isWorkspaceReady
  };
}
