/**
 * Lets Node's built-in TypeScript type stripping run the app's own modules from scripts/:
 * resolves the `@/` alias to `src/` and extensionless relative imports to `.ts`/`.tsx`/index.
 * Used with `node --import ./scripts/ts-resolve.mjs`. No dependencies.
 */
import { existsSync, statSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);

function candidate(url) {
  const path = fileURLToPath(url);
  if (existsSync(path) && statSync(path).isFile()) return url;
  for (const suffix of [".ts", ".tsx", "/index.ts"]) {
    if (existsSync(path + suffix)) return pathToFileURL(path + suffix).href;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  const isAlias = specifier.startsWith("@/");
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  if (isAlias || (isRelative && context.parentURL?.startsWith("file:"))) {
    const base = isAlias ? new URL(specifier.slice(2), SRC) : new URL(specifier, context.parentURL);
    const found = candidate(base.href);
    if (found) return next(found, context);
  }
  return next(specifier, context);
}

if (!import.meta.url.includes("?hook")) register(`${import.meta.url}?hook`);
