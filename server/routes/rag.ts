import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import ts from 'typescript';
import { safePath, getWorkspaceDir } from '../utils/workspace';

const router = Router();

interface CodeChunk {
  filePath: string;
  name: string;
  type: string; // 'function' | 'class' | 'interface' | 'method' | 'generic-chunk'
  content: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
}

interface IndexFile {
  workspaceId: string;
  indexedAt: number;
  chunks: CodeChunk[];
}

// 1. TypeScript AST Parser
function parseTypeScript(filePath: string, content: string): Omit<CodeChunk, 'filePath'>[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const symbols: Omit<CodeChunk, 'filePath'>[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isMethodDeclaration(node)
    ) {
      const name = node.name ? node.name.getText(sourceFile) : 'anonymous';
      const type = ts.isFunctionDeclaration(node) ? 'function' :
                   ts.isClassDeclaration(node) ? 'class' :
                   ts.isInterfaceDeclaration(node) ? 'interface' : 'method';
      
      const startPos = node.getStart(sourceFile);
      const endPos = node.getEnd();
      
      const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(startPos);
      const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(endPos);
      
      symbols.push({
        name,
        type,
        startLine: startLine + 1,
        endLine: endLine + 1,
        content: node.getText(sourceFile)
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return symbols;
}

// 2. Python Symbol Parser
function parsePython(content: string): Omit<CodeChunk, 'filePath'>[] {
  const lines = content.split('\n');
  const symbols: Omit<CodeChunk, 'filePath'>[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = line.match(/^\s*def\s+([a-zA-Z0-9_]+)\s*\(/);
    const classMatch = line.match(/^\s*class\s+([a-zA-Z0-9_]+)\s*[:\(]/);
    
    if (funcMatch || classMatch) {
      const name = funcMatch ? funcMatch[1] : classMatch![1];
      const type = funcMatch ? 'function' : 'class';
      const startLine = i + 1;
      
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      let endLine = startLine;
      
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.trim() === '') continue;
        const nextIndentMatch = nextLine.match(/^(\s*)/);
        const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;
        
        if (nextIndent <= indent && !nextLine.trim().startsWith('#')) {
          endLine = j;
          break;
        }
        endLine = j + 1;
      }
      
      symbols.push({
        name,
        type,
        startLine,
        endLine,
        content: lines.slice(startLine - 1, endLine).join('\n')
      });
    }
  }
  return symbols;
}

// 3. Fallback generic text chunker (by line size)
function genericChunk(content: string, linesPerChunk = 50): Omit<CodeChunk, 'filePath'>[] {
  const lines = content.split('\n');
  const chunks: Omit<CodeChunk, 'filePath'>[] = [];
  
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const slice = lines.slice(i, i + linesPerChunk);
    chunks.push({
      name: `chunk-${Math.floor(i / linesPerChunk) + 1}`,
      type: 'generic-chunk',
      startLine: i + 1,
      endLine: i + slice.length,
      content: slice.join('\n')
    });
  }
  return chunks;
}

// Helper to scan directory files recursively
async function getFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files: string[] = [];
  const ignored = ['.git', 'node_modules', 'dist', 'build', '.cache', '.npm', '.chromium-profile', '.github-devy'];
  
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

// Shared index builder helper
async function buildCodebaseIndex(workspaceId: string, apiKey?: string): Promise<IndexFile> {
  const { wDir } = await safePath(workspaceId, '.');
  const indexPath = path.join(wDir, '.github-devy', 'rag_index.json');
  
  const files = await getFiles(wDir, wDir);
  const allChunks: CodeChunk[] = [];
  
  for (const relFile of files) {
    const absPath = path.join(wDir, relFile);
    const content = await fs.readFile(absPath, 'utf8');
    const ext = path.extname(relFile).toLowerCase();
    
    let fileChunks: Omit<CodeChunk, 'filePath'>[] = [];
    
    try {
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        fileChunks = parseTypeScript(relFile, content);
      } else if (['.py'].includes(ext)) {
        fileChunks = parsePython(content);
      }
    } catch (err) {
      console.error(`Failed to AST-parse ${relFile}:`, err);
    }
    
    if (fileChunks.length === 0) {
      fileChunks = genericChunk(content, 40);
    }
    
    allChunks.push(...fileChunks.map(c => ({ ...c, filePath: relFile })));
  }

  // Embed chunks in batches of 50 if Gemini API Key is available
  if (apiKey && allChunks.length > 0) {
    console.log(`Generating semantic embeddings for ${allChunks.length} chunks...`);
    const batchSize = 50;
    
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const requests = batch.map(c => ({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: `File: ${c.filePath}\nSymbol: ${c.name} (${c.type})\nCode:\n${c.content}` }] }
      }));
      
      try {
        const embedRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({ requests })
        });
        
        if (embedRes.ok) {
          const data = await embedRes.json();
          const embeddings = data.embeddings || [];
          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]?.values) {
              batch[j].embedding = embeddings[j].values;
            }
          }
        } else {
          console.error(`Embeddings batch failed: ${embedRes.status} ${await embedRes.text()}`);
        }
      } catch (err) {
        console.error('Embeddings API call error:', err);
      }
    }
  }
  
  const indexData: IndexFile = {
    workspaceId,
    indexedAt: Date.now(),
    chunks: allChunks
  };
  
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf8');
  return indexData;
}

// Route to check RAG index status
router.post('/status', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const indexPath = path.join(wDir, '.github-devy', 'rag_index.json');
    
    try {
      const indexContent = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(indexContent) as IndexFile;
      return res.json({
        exists: true,
        indexedAt: index.indexedAt,
        chunksCount: index.chunks.length,
        workspaceId
      });
    } catch {
      return res.json({
        exists: false,
        indexedAt: 0,
        chunksCount: 0,
        workspaceId
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Route to build codebase index
router.post('/index', async (req, res) => {
  try {
    const { workspaceId, clientApiKey } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    const indexData = await buildCodebaseIndex(workspaceId, apiKey);
    
    res.json({
      success: true,
      indexedAt: indexData.indexedAt,
      chunksCount: indexData.chunks.length,
      embeddedCount: indexData.chunks.filter(c => !!c.embedding).length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Route to perform search
router.post('/search', async (req, res) => {
  try {
    const { workspaceId, query, clientApiKey, limit = 10 } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    const { wDir } = await safePath(workspaceId, '.');
    const indexPath = path.join(wDir, '.github-devy', 'rag_index.json');
    
    let index: IndexFile;
    try {
      const indexContent = await fs.readFile(indexPath, 'utf8');
      index = JSON.parse(indexContent) as IndexFile;
    } catch {
      console.log(`RAG Index not found for workspace ${workspaceId}. Building index on the fly...`);
      index = await buildCodebaseIndex(workspaceId, apiKey);
    }
    
    const chunks = index.chunks;
    
    // 1. TF-IDF Keyword Matcher
    const queryTerms = query.toLowerCase().split(/\W+/).filter(Boolean);
    const scoredChunks = chunks.map(chunk => {
      let keywordScore = 0;
      const contentLower = chunk.content.toLowerCase();
      const nameLower = chunk.name.toLowerCase();
      const pathLower = chunk.filePath.toLowerCase();
      
      for (const term of queryTerms) {
        if (pathLower.includes(term)) keywordScore += 1.5;
        if (nameLower.includes(term)) keywordScore += 3.0;
        
        const matches = contentLower.split(term).length - 1;
        if (matches > 0) {
          keywordScore += Math.log(1 + matches);
        }
      }
      return { chunk, keywordScore, vectorScore: 0, finalScore: keywordScore };
    });
    
    // 2. Vector Semantic Matcher
    let queryEmbedding: number[] | null = null;
    if (apiKey && chunks.some(c => !!c.embedding)) {
      try {
        const embedRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: query }] }
          })
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
        item.finalScore = (scaledKeyword * 0.4) + (item.vectorScore * 0.6);
      } else {
        item.finalScore = item.keywordScore;
      }
    }
    
    scoredChunks.sort((a, b) => b.finalScore - a.finalScore);
    const topResults = scoredChunks.slice(0, limit).map(item => ({
      filePath: item.chunk.filePath,
      name: item.chunk.name,
      type: item.chunk.type,
      startLine: item.chunk.startLine,
      endLine: item.chunk.endLine,
      content: item.chunk.content,
      keywordScore: item.keywordScore,
      vectorScore: item.vectorScore,
      finalScore: item.finalScore
    }));
    
    res.json({
      success: true,
      query,
      results: topResults
    });
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
