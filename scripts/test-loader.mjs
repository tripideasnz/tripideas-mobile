// Node test support for this repository's TypeScript/TSX and @/ imports.
// Uses the existing compiler dependency; does not load or modify Expo config.
import ts from 'typescript';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

// Expo inlines EXPO_PUBLIC_* values when it bundles; plain Node does not. The app has no defaults for
// them (config/required-env.ts), so modules under test that read them get these obviously fake values,
// which name no real environment. A test that needs the variables ABSENT sets
// TRIPIDEAS_TEST_NO_ENV_DEFAULTS=1 in a child process (config/required-env.test.js). The statement runs
// in the module itself, so the values reach the main thread, not just this hooks thread.
const TEST_PUBLIC_ENV = {
  EXPO_PUBLIC_API_URL: 'https://api.test.invalid',
  EXPO_PUBLIC_TRIP_SHARE_API_URL: 'https://share.test.invalid/api/trips/share',
};
const testEnvPrelude = Object.entries(TEST_PUBLIC_ENV)
  .map(([name, value]) => `if (!process.env.TRIPIDEAS_TEST_NO_ENV_DEFAULTS) process.env.${name} ??= ${JSON.stringify(value)};`)
  .join('\n') + '\n';

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
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    return {
      format: 'module',
      shortCircuit: true,
      source: source.includes('process.env.EXPO_PUBLIC_') ? testEnvPrelude + output : output,
    };
  }
  return next(url, context);
}
