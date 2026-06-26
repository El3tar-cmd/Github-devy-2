import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { safePath } from '../utils/workspace';

const router = Router();

interface AstNode {
  id: string;
  label: string;
  type: 'file' | 'directory';
}

interface AstLink {
  source: string;
  target: string;
  symbols: string[];
}

function traverseDirectory(dir: string, baseDir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.github-devy' || file === 'dist' || file.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDirectory(fullPath, baseDir, fileList);
    } else {
      const ext = path.extname(file);
      if (['.ts', '.tsx', '.js', '.jsx', '.json'].includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

router.post('/graph', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    const { wDir } = await safePath(workspaceId, '.');
    const resolvedWDir = path.resolve(wDir);

    const allFiles = traverseDirectory(resolvedWDir, resolvedWDir);
    const nodes: AstNode[] = [];
    const links: AstLink[] = [];
    
    // Maps to track file paths relative to workspace root
    const filePaths = allFiles.map(f => path.relative(resolvedWDir, f).replace(/\\/g, '/'));
    
    // Initialize nodes
    for (const relPath of filePaths) {
      nodes.push({
        id: relPath,
        label: path.basename(relPath),
        type: 'file',
      });
    }

    // Resolve helper to match relative imports to workspace files
    const resolveImport = (sourceFileRelPath: string, importPath: string): string | null => {
      if (!importPath.startsWith('.')) return null; // Ignore external/node_modules imports
      
      const sourceDir = path.dirname(path.join(resolvedWDir, sourceFileRelPath));
      const absoluteTarget = path.resolve(sourceDir, importPath);
      
      const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      
      // Try direct file resolve first
      if (fs.existsSync(absoluteTarget) && fs.statSync(absoluteTarget).isFile()) {
        return path.relative(resolvedWDir, absoluteTarget).replace(/\\/g, '/');
      }

      // Try extensions
      for (const ext of possibleExtensions) {
        const withExt = absoluteTarget + ext;
        if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
          return path.relative(resolvedWDir, withExt).replace(/\\/g, '/');
        }
      }
      return null;
    };

    // Parse each file
    for (const fileAbsPath of allFiles) {
      const relPath = path.relative(resolvedWDir, fileAbsPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fileAbsPath, 'utf8');
      
      // Determine script target based on extension
      const isTs = fileAbsPath.endsWith('.ts') || fileAbsPath.endsWith('.tsx');
      
      const sourceFile = ts.createSourceFile(
        relPath,
        content,
        ts.ScriptTarget.Latest,
        true,
        isTs ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
      );

      const importsFound = new Map<string, string[]>(); // TargetRelPath -> Imported Symbols

      const addImportSymbol = (importPath: string, symbol: string) => {
        const resolved = resolveImport(relPath, importPath);
        if (resolved) {
          const existing = importsFound.get(resolved) || [];
          if (!existing.includes(symbol) && symbol !== '*') {
            existing.push(symbol);
          }
          importsFound.set(resolved, existing);
        }
      };

      // Simple node traverser
      const visit = (node: ts.Node) => {
        // 1. ES Import Declarations: import { x } from './y'
        if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text;
          
          if (node.importClause) {
            // Default import: import X from './y'
            if (node.importClause.name) {
              addImportSymbol(importPath, node.importClause.name.text);
            }
            // Named imports: import { A, B } from './y'
            if (node.importClause.namedBindings) {
              if (ts.isNamedImports(node.importClause.namedBindings)) {
                for (const element of node.importClause.namedBindings.elements) {
                  addImportSymbol(importPath, element.name.text);
                }
              } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                // Namespace import: import * as X from './y'
                addImportSymbol(importPath, '*');
              }
            }
          } else {
            // Side-effect import: import './y'
            addImportSymbol(importPath, '*');
          }
        }
        
        // 2. Export Declarations with source: export { x } from './y'
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text;
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              addImportSymbol(importPath, element.name.text);
            }
          } else {
            addImportSymbol(importPath, '*');
          }
        }

        // 3. require/import calls: require('./y') or import('./y')
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          if ((ts.isIdentifier(expression) && expression.text === 'require') || node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const firstArg = node.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              addImportSymbol(firstArg.text, '*');
            }
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      // Convert importsFound map to links
      for (const [targetRelPath, symbols] of importsFound.entries()) {
        links.push({
          source: relPath,
          target: targetRelPath,
          symbols: symbols.length > 0 ? symbols : ['*'],
        });
      }
    }

    // Collect top-level symbols for nodes
    const fileSymbols = new Map<string, string[]>();
    for (const fileAbsPath of allFiles) {
      const relPath = path.relative(resolvedWDir, fileAbsPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fileAbsPath, 'utf8');
      const isTs = fileAbsPath.endsWith('.ts') || fileAbsPath.endsWith('.tsx');
      
      const sourceFile = ts.createSourceFile(
        relPath,
        content,
        ts.ScriptTarget.Latest,
        true,
        isTs ? ts.ScriptKind.TSX : ts.ScriptKind.JSX
      );

      const symbols: string[] = [];
      
      const collectSymbols = (node: ts.Node) => {
        // Collect at the root level only to keep it clean
        if (ts.isFunctionDeclaration(node) && node.name) {
          symbols.push(`function:${node.name.text}`);
        } else if (ts.isClassDeclaration(node) && node.name) {
          symbols.push(`class:${node.name.text}`);
        } else if (ts.isInterfaceDeclaration(node) && node.name) {
          symbols.push(`interface:${node.name.text}`);
        } else if (ts.isTypeAliasDeclaration(node) && node.name) {
          symbols.push(`type:${node.name.text}`);
        } else if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              symbols.push(`variable:${decl.name.text}`);
            }
          }
        }
      };

      ts.forEachChild(sourceFile, collectSymbols);
      fileSymbols.set(relPath, symbols);
    }

    res.json({
      success: true,
      nodes: nodes.map(n => ({
        ...n,
        symbols: fileSymbols.get(n.id) || [],
      })),
      links,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
