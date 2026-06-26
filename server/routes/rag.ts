import { Router } from 'express';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import ts from 'typescript';
import { safePath, getWorkspaceDir } from '../utils/workspace';

const router = Router();

// --- Maximum characters per chunk returned to the LLM (prevents context overflow) ---
const MAX_CHUNK_CONTENT_CHARS = 1800;
// --- Maximum total chars across all results returned in one search ---
const MAX_TOTAL_RESULT_CHARS = 18000;

interface CodeChunk {
  filePath: string;
  name: string;
  type: string;
  content: string;
  startLine: number;
  endLine: number;
  fileHash?: string;
  embedding?: number[];
}

interface IndexFile {
  workspaceId: string;
  indexedAt: number;
  version: number;
  chunks: CodeChunk[];
}

// --- 1. TypeScript AST Parser ---
function parseTypeScript(filePath: string, content: string): Omit<CodeChunk, 'filePath'>[] {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const symbols: Omit<CodeChunk, 'filePath'>[] = [];

  function visit(node: ts.Node) {
    const isSymbol =
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isVariableStatement(node);

    if (isSymbol) {
      let name = 'anonymous';
      if ('name' in node && node.name && 'getText' in (node.name as any)) {
        name = (node.name as any).getText(sourceFile);
      } else if (ts.isVariableStatement(node)) {
        const decl = node.declarationList.declarations[0];
        name = decl?.name?.getText(sourceFile) ?? 'variable';
      }

      const type = ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) ? 'function'
        : ts.isClassDeclaration(node) ? 'class'
        : ts.isInterfaceDeclaration(node) ? 'interface'
        : ts.isTypeAliasDeclaration(node) ? 'type'
        : ts.isMethodDeclaration(node) ? 'method'
        : 'variable';

      const startPos = node.getStart(sourceFile);
      const endPos = node.getEnd();
      const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(startPos);
      const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(endPos);

      const rawContent = node.getText(sourceFile);
      symbols.push({
        name,
        type,
        startLine: startLine + 1,
        endLine: endLine + 1,
        content: rawContent.slice(0, MAX_CHUNK_CONTENT_CHARS),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return symbols;
}

// --- 2. Python Symbol Parser ---
function parsePython(content: string): Omit<CodeChunk, 'filePath'>[] {
  const lines = content.split('\n');
  const symbols: Omit<CodeChunk, 'filePath'>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = line.match(/^\s*def\s+([a-zA-Z0-9_]+)\s*\(/);
    const classMatch = line.match(/^\s*class\s+([a-zA-Z0-9_]+)\s*[:\(]/);
    if (!funcMatch && !classMatch) continue;

    const name = funcMatch ? funcMatch[1] : classMatch![1];
    const type = funcMatch ? 'function' : 'class';
    const startLine = i + 1;
    const indent = (line.match(/^(\s*)/) ?? ['', ''])[1].length;
    let endLine = startLine;

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (!next.trim()) continue;
      const nextIndent = (next.match(/^(\s*)/) ?? ['', ''])[1].length;
      if (nextIndent <= indent && !next.trim().startsWith('#')) { endLine = j; break; }
      endLine = j + 1;
    }

    symbols.push({
      name, type, startLine, endLine,
      content: lines.slice(startLine - 1, endLine).join('\n').slice(0, MAX_CHUNK_CONTENT_CHARS),
    });
  }
  return symbols;
}

// --- 3. Fallback: semantic line-boundary chunker ---
function genericChunk(content: string, linesPerChunk = 40): Omit<CodeChunk, 'filePath'>[] {
  const lines = content.split('\n');
  const chunks: Omit<CodeChunk, 'filePath'>[] = [];

  for (let i = 0; i < lines.length; i += linesPerChunk) {
    // Extend to next blank line for cleaner semantic boundaries
    let end = Math.min(i + linesPerChunk, lines.length);
    while (end < lines.length && lines[end].trim() !== '') end++;
    const slice = lines.slice(i, end);
    chunks.push({
      name: `chunk-${Math.floor(i / linesPerChunk) + 1}`,
      type: 'generic-chunk',
      startLine: i + 1,
      endLine: i + slice.length,
      content: slice.join('\n').slice(0, MAX_CHUNK_CONTENT_CHARS),
    });
    i = end - linesPerChunk; // adjust so we don't skip lines
  }
  return chunks;
}

// --- File hash helper ---
function hashContent(content: string): string {
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 16);
}

// --- Recursive file scanner ---
async function getFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files: string[] = [];
  const ignored = ['.git', 'node_modules', 'dist', 'build', '.cache', '.npm', '.chromium-profile', '.github-devy', 'coverage'];

  for (const entry of entries) {
    if (ignored.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getFiles(full, baseDir));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.json', '.md'].includes(ext)) {
        files.push(path.relative(baseDir, full).replace(/\\/g, '/'));
      }
    }
  }
  return files;
}

// --- INCREMENTAL index builder ---
async function buildCodebaseIndex(
  workspaceId: string,
  apiKey?: string,
  forceRebuild = false
): Promise<IndexFile> {
  const { wDir } = await safePath(workspaceId, '.');
  const indexPath = path.join(wDir, '.github-devy', 'rag_index.json');

  // Load existing index for incremental update
  let existingIndex: IndexFile | null = null;
  if (!forceRebuild) {
    try {
      const raw = await fs.readFile(indexPath, 'utf8');
      existingIndex = JSON.parse(raw) as IndexFile;
    } catch { /* no existing index — full build */ }
  }

  // Build a map of existing chunks by file+hash for O(1) lookup
  const existingByFileHash = new Map<string, CodeChunk[]>();
  if (existingIndex) {
    for (const chunk of existingIndex.chunks) {
      const key = `${chunk.filePath}::${chunk.fileHash ?? ''}`;
      if (!existingByFileHash.has(key)) existingByFileHash.set(key, []);
      existingByFileHash.get(key)!.push(chunk);
    }
  }

  const files = await getFiles(wDir, wDir);
  const allChunks: CodeChunk[] = [];
  const chunksNeedingEmbedding: CodeChunk[] = [];

  for (const relFile of files) {
    const absPath = path.join(wDir, relFile);
    let content: string;
    try {
      content = await fs.readFile(absPath, 'utf8');
    } catch { continue; }

    const hash = hashContent(content);
    const cacheKey = `${relFile}::${hash}`;

    // If file unchanged, reuse existing chunks (with embeddings)
    if (existingByFileHash.has(cacheKey)) {
      allChunks.push(...existingByFileHash.get(cacheKey)!);
      continue;
    }

    // File is new or changed — re-parse
    const ext = path.extname(relFile).toLowerCase();
    let fileChunks: Omit<CodeChunk, 'filePath'>[] = [];

    try {
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        fileChunks = parseTypeScript(relFile, content);
      } else if (ext === '.py') {
        fileChunks = parsePython(content);
      }
    } catch (err) {
      console.error(`AST parse failed for ${relFile}:`, err);
    }

    if (fileChunks.length === 0) fileChunks = genericChunk(content);

    const newChunks: CodeChunk[] = fileChunks.map(c => ({ ...c, filePath: relFile, fileHash: hash }));
    allChunks.push(...newChunks);
    chunksNeedingEmbedding.push(...newChunks);
  }

  // Embed only new/changed chunks
  if (apiKey && chunksNeedingEmbedding.length > 0) {
    console.log(`Embedding ${chunksNeedingEmbedding.length} new/changed chunks (${allChunks.length - chunksNeedingEmbedding.length} reused from cache)...`);
    const batchSize = 50;

    for (let i = 0; i < chunksNeedingEmbedding.length; i += batchSize) {
      const batch = chunksNeedingEmbedding.slice(i, i + batchSize);
      const requests = batch.map(c => ({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: `File: ${c.filePath}\nSymbol: ${c.name} (${c.type})\nCode:\n${c.content.slice(0, 1000)}` }] }
      }));

      try {
        const embedRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ requests }),
        });

        if (embedRes.ok) {
          const data = await embedRes.json();
          const embeddings = data.embeddings || [];
          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]?.values) batch[j].embedding = embeddings[j].values;
          }
        } else {
          console.error(`Embeddings batch failed: ${embedRes.status}`);
        }
      } catch (err) {
        console.error('Embeddings API error:', err);
      }
    }
  }

  const indexData: IndexFile = {
    workspaceId,
    indexedAt: Date.now(),
    version: (existingIndex?.version ?? 0) + 1,
    chunks: allChunks,
  };

  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(indexData), 'utf8'); // no pretty-print for perf
  return indexData;
}

// --- Cosine similarity ---
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- Routes ---

router.post('/status', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const indexPath = path.join(wDir, '.github-devy', 'rag_index.json');
    try {
      const raw = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(raw) as IndexFile;
      return res.json({ exists: true, indexedAt: index.indexedAt, chunksCount: index.chunks.length, version: index.version ?? 1, workspaceId });
    } catch {
      return res.json({ exists: false, indexedAt: 0, chunksCount: 0, version: 0, workspaceId });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/index', async (req, res) => {
  try {
    const { workspaceId, clientApiKey, forceRebuild = false } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    const indexData = await buildCodebaseIndex(workspaceId, apiKey, forceRebuild);
    res.json({
      success: true,
      indexedAt: indexData.indexedAt,
      chunksCount: indexData.chunks.length,
      version: indexData.version,
      embeddedCount: indexData.chunks.filter(c => !!c.embedding).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { workspaceId, query, clientApiKey, limit = 8 } = req.body;
    if (!query) return res.status(400).json({ error: 'Query parameter is required' });

    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    const { wDir } = await safePath(workspaceId, '.');
    const indexPath = path.join(wDir, '.github-devy', 'rag_index.json');

    let index: IndexFile;
    try {
      const raw = await fs.readFile(indexPath, 'utf8');
      index = JSON.parse(raw) as IndexFile;
    } catch {
      console.log(`RAG index not found for ${workspaceId}. Building on demand...`);
      index = await buildCodebaseIndex(workspaceId, apiKey);
    }

    const chunks = index.chunks;

    // 1. Keyword scorer (TF-weighted)
    const queryTerms = query.toLowerCase().split(/\W+/).filter(Boolean);
    const scoredChunks = chunks.map(chunk => {
      let keywordScore = 0;
      const contentLower = chunk.content.toLowerCase();
      const nameLower = chunk.name.toLowerCase();
      const pathLower = chunk.filePath.toLowerCase();
      for (const term of queryTerms) {
        if (pathLower.includes(term)) keywordScore += 1.5;
        if (nameLower.includes(term)) keywordScore += 3.0;
        const hits = (contentLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (hits > 0) keywordScore += Math.log(1 + hits);
      }
      return { chunk, keywordScore, vectorScore: 0, finalScore: keywordScore };
    });

    // 2. Vector semantic scorer
    let queryEmbedding: number[] | null = null;
    if (apiKey && chunks.some(c => !!c.embedding)) {
      try {
        const embedRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: query }] } }),
        });
        if (embedRes.ok) {
          const data = await embedRes.json();
          queryEmbedding = data.embedding?.values || null;
        }
      } catch (err) {
        console.error('Failed to embed search query:', err);
      }
    }

    for (const item of scoredChunks) {
      if (queryEmbedding && item.chunk.embedding) {
        item.vectorScore = cosineSimilarity(queryEmbedding, item.chunk.embedding);
        const scaledKeyword = Math.min(1.0, item.keywordScore / 10);
        item.finalScore = (scaledKeyword * 0.35) + (item.vectorScore * 0.65);
      } else {
        item.finalScore = item.keywordScore;
      }
    }

    scoredChunks.sort((a, b) => b.finalScore - a.finalScore);

    // 3. Build results with total token budget
    const topCandidates = scoredChunks.slice(0, limit * 2); // over-fetch then trim
    const results: any[] = [];
    let totalChars = 0;

    for (const item of topCandidates) {
      if (results.length >= limit) break;
      if (totalChars >= MAX_TOTAL_RESULT_CHARS) break;

      const remainingBudget = MAX_TOTAL_RESULT_CHARS - totalChars;
      const content = item.chunk.content.slice(0, Math.min(MAX_CHUNK_CONTENT_CHARS, remainingBudget));
      totalChars += content.length;

      results.push({
        filePath: item.chunk.filePath,
        name: item.chunk.name,
        type: item.chunk.type,
        startLine: item.chunk.startLine,
        endLine: item.chunk.endLine,
        content,
        keywordScore: Math.round(item.keywordScore * 100) / 100,
        vectorScore: Math.round(item.vectorScore * 1000) / 1000,
        finalScore: Math.round(item.finalScore * 1000) / 1000,
      });
    }

    res.json({ success: true, query, results, totalChars });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
