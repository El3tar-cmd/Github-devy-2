import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { safePath } from '../utils/workspace';

const router = Router();

// Endpoint to list sqlite database files in workspace
router.post('/list', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    
    // Recursive search for sqlite db files
    async function findDbs(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let results: string[] = [];
      const ignored = ['.git', 'node_modules', 'dist', 'build', '.cache', '.npm', '.chromium-profile'];
      for (const entry of entries) {
        if (ignored.includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(await findDbs(full));
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.db', '.sqlite', '.sqlite3', '.db3'].includes(ext)) {
            const rel = path.relative(wDir, full).replace(/\\/g, '/');
            results.push(rel);
          }
        }
      }
      return results;
    }
    
    const dbs = await findDbs(wDir);
    res.json({ success: true, databases: dbs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to run query via python sqlite3 wrapper
router.post('/query', async (req, res) => {
  try {
    const { workspaceId, dbPath, query } = req.body;
    if (!dbPath || !query) {
      return res.status(400).json({ error: 'dbPath and query are required' });
    }
    
    const { resolved } = await safePath(workspaceId, dbPath);
    
    // Python script to execute and output JSON
    const pythonScript = `
import sqlite3, json, sys
try:
    conn = sqlite3.connect(sys.argv[1])
    cursor = conn.cursor()
    cursor.execute(sys.argv[2])
    if cursor.description:
        colnames = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        result = []
        for row in rows:
            row_dict = {}
            for col, val in zip(colnames, row):
                if isinstance(val, bytes):
                    row_dict[col] = val.decode('utf-8', errors='ignore')
                else:
                    row_dict[col] = val
            result.append(row_dict)
        print(json.dumps({"success": True, "type": "select", "columns": colnames, "rows": result}))
    else:
        conn.commit()
        print(json.dumps({"success": True, "type": "write", "affectedRows": cursor.rowcount, "lastInsertRowid": cursor.lastrowid}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(pythonCmd, ['-c', pythonScript, resolved, query]);
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code !== 0 && !stdout) {
        return res.status(500).json({ error: stderr || `Python process exited with code ${code}` });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        res.json(parsed);
      } catch (err: any) {
        res.status(500).json({ error: `Failed to parse Python JSON output: ${stdout}\nStderr: ${stderr}` });
      }
    });
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to list tables in a database
router.post('/tables', async (req, res) => {
  try {
    const { workspaceId, dbPath } = req.body;
    if (!dbPath) return res.status(400).json({ error: 'dbPath required' });
    const { resolved } = await safePath(workspaceId, dbPath);
    
    const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
    const pythonScript = `
import sqlite3, json, sys
try:
    conn = sqlite3.connect(sys.argv[1])
    cursor = conn.cursor()
    cursor.execute(sys.argv[2])
    rows = cursor.fetchall()
    tables = [r[0] for r in rows]
    print(json.dumps({"success": True, "tables": tables}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(pythonCmd, ['-c', pythonScript, resolved, query]);
    let stdout = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.on('close', () => {
      try {
        res.json(JSON.parse(stdout.trim()));
      } catch {
        res.status(500).json({ error: 'Failed to list tables' });
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
