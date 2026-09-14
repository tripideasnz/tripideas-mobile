// Node test support for this repository's TypeScript/TSX and @/ imports.
// Uses the existing compiler dependency; does not load or modify Expo config.
import ts from 'typescript';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), root).href;
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') || specifier.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL);
      for (const suffix of ['.ts', '.tsx', '/index.ts']) {
        const candidate = new URL(url.href + suffix);
        try {
          await access(candidate);
          return { url: candidate.href, shortCircuit: true };
        } catch {
          // Try the next supported extension before returning the original error.
        }
      }
    }
    throw error;
  }
}

export async function load(url, context, next) {
  if (url.startsWith(root.href) && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
    const source = await readFile(new URL(url), 'utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  }
  return next(url, context);
}
