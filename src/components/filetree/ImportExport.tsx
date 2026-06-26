import { useState, useRef } from 'react';

export function useImportExport(
  workspaceId: string,
  onRefresh: () => void,
  onWorkspaceIdChange?: (id: string) => void
) {
  const [isZipping, setIsZipping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);

  const readFileAsBase64 = async (file: File): Promise<string> => {
    // Skip empty files
    if (file.size === 0) return '';

    // Method 1: Use modern arrayBuffer API (most reliable on Termux/Android)
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const chunks: string[] = [];
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
      }
      return btoa(chunks.join(''));
    } catch (err) {
      console.warn(`arrayBuffer failed for ${file.name}, trying FileReader fallback...`, err);
    }

    // Method 2: FileReader fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result;
          if (result instanceof ArrayBuffer) {
            const bytes = new Uint8Array(result);
            const chunks: string[] = [];
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
              chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
            }
            resolve(btoa(chunks.join('')));
          } else if (typeof result === 'string') {
            resolve(result.split(',')[1] || '');
          } else {
            reject(new Error(`نوع نتيجة غير متوقع للملف: ${file.name}`));
          }
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error(`فشل قراءة الملف: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let targetWorkspaceId = workspaceId;
    if (!targetWorkspaceId) {
      const name = prompt("من فضلك أدخل اسماً للمشروع الجديد لرفع الملفات إليه:", "my-project");
      if (!name || !name.trim()) {
        if (e.target) e.target.value = '';
        return;
      }
      targetWorkspaceId = name.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
      if (onWorkspaceIdChange) {
        onWorkspaceIdChange(targetWorkspaceId);
      }
    }

    setIsImporting(true);
    setErrorMsg('');
    let successCount = 0;
    let failCount = 0;

    try {
      for (const file of Array.from(files)) {
        try {
          const base64 = await readFileAsBase64(file);
          const response = await fetch('/api/workspace/import-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId: targetWorkspaceId,
              files: [{ relativePath: file.name, base64 }],
              clearFirst: false,
              stripPrefix: false,
            }),
          });
          if (response.ok) {
            successCount++;
          } else {
            console.error(`Upload failed for file ${file.name}: status ${response.status}`);
            failCount++;
          }
        } catch (err) {
          console.error(`Error processing file ${file.name}:`, err);
          failCount++;
        }
      }

      onRefresh();
      if (failCount > 0) {
        setErrorMsg(`تم رفع ${successCount} ملف بنجاح، فشل ${failCount} ملف`);
      }
    } catch (err: any) {
      console.error('File upload failed:', err);
      setErrorMsg(`فشل رفع الملفات: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let targetWorkspaceId = workspaceId;
    if (!targetWorkspaceId) {
      const name = prompt("من فضلك أدخل اسماً للمشروع الجديد لرفع المجلد إليه:", "my-project");
      if (!name || !name.trim()) {
        if (e.target) e.target.value = '';
        return;
      }
      targetWorkspaceId = name.trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
      if (onWorkspaceIdChange) {
        onWorkspaceIdChange(targetWorkspaceId);
      }
    }

    setIsImporting(true);
    setErrorMsg('');
    let successCount = 0;
    let failCount = 0;
    const BATCH_SIZE = 10;

    try {
      const fileList = Array.from(files);
      
      // Upload in small batches to avoid memory issues on Termux
      for (let i = 0; i < fileList.length; i += BATCH_SIZE) {
        const batch = fileList.slice(i, i + BATCH_SIZE);
        const batchFiles: { relativePath: string; base64: string }[] = [];

        for (const file of batch) {
          try {
            const base64 = await readFileAsBase64(file);
            batchFiles.push({
              relativePath: file.webkitRelativePath || file.name,
              base64,
            });
          } catch (err) {
            console.error(`Error reading folder file ${file.name}:`, err);
            failCount++;
          }
        }

        if (batchFiles.length > 0) {
          try {
            const response = await fetch('/api/workspace/import-folder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workspaceId: targetWorkspaceId,
                files: batchFiles,
                clearFirst: false,
                stripPrefix: false,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              successCount += data.written || batchFiles.length;
            } else {
              console.error(`Upload batch failed: status ${response.status}`);
              failCount += batchFiles.length;
            }
          } catch (err) {
            console.error('Upload batch network error:', err);
            failCount += batchFiles.length;
          }
        }
      }

      onRefresh();
      if (failCount > 0 && successCount > 0) {
        setErrorMsg(`تم رفع ${successCount} ملف بنجاح، تم تخطي ${failCount} ملف غير قابل للقراءة`);
      } else if (failCount > 0 && successCount === 0) {
        setErrorMsg(`فشل رفع جميع الملفات (${failCount} ملف). تأكد من صلاحيات الوصول للملفات.`);
      }
    } catch (err: any) {
      console.error('Folder upload failed:', err);
      setErrorMsg(`فشل رفع المجلد: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDownloadZip = async () => {
    if (isZipping) return;
    setIsZipping(true);
    try {
      const link = document.createElement('a');
      link.href = `/api/workspace/export-zip?workspaceId=${encodeURIComponent(workspaceId)}`;
      link.setAttribute('download', `workspace-${workspaceId}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to export zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setErrorMsg('');

    try {
      const reader = new FileReader();
      
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read the ZIP file.'));
        reader.readAsDataURL(file);
      });

      const zipBase64 = await fileDataPromise;

      const response = await fetch('/api/workspace/import-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, zipBase64 }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      onRefresh();
      if (e.target) {
        e.target.value = '';
      }
    } catch (err: any) {
      console.error('Import ZIP failed:', err);
      setErrorMsg(`فشل استيراد مشروع الـ ZIP: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerFileUploadInput = () => {
    fileUploadInputRef.current?.click();
  };

  const triggerFolderUploadInput = () => {
    folderUploadInputRef.current?.click();
  };

  return {
    isZipping,
    isImporting,
    errorMsg,
    setErrorMsg,
    fileInputRef,
    fileUploadInputRef,
    folderUploadInputRef,
    handleFilesUpload,
    handleFolderUpload,
    handleDownloadZip,
    handleImportZip,
    triggerFileInput,
    triggerFileUploadInput,
    triggerFolderUploadInput,
  };
}
