import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

/**
 * Execute a .js or .ts file and capture its output.
 *
 * The file should export a default function or be a script that returns/logs content.
 * Convention: export default async function(context) { return "file content" }
 *
 * @param {object} opts
 * @param {string} opts.filePath - absolute path to the .js/.ts file
 * @param {string} opts.content - raw file content
 * @param {Record<string, string>} opts.resolvedDeps - map of dep path -> content
 * @param {Record<string, string>} opts.variables - map of variable name -> value
 * @param {Record<string, any>} opts.config
 * @param {string} opts.rootDir
 * @returns {Promise<string>}
 */
export async function executeJavaScript({
  filePath,
  content,
  resolvedDeps,
  variables,
  config,
  rootDir
}) {
  // For .ts files, we rely on Node 22+ --experimental-strip-types or tsx
  // For now, try direct import first

  const context = {
    deps: resolvedDeps,
    variables,
    config,
    rootDir,
    env: process.env
  };

  try {
    // Dynamic import
    const fileUrl = pathToFileURL(filePath).href;
    const mod = await import(fileUrl);

    if (typeof mod.default === "function") {
      const result = await mod.default(context);
      if (typeof result === "string") return result;
      if (typeof result === "object") return JSON.stringify(result, null, 2);
      return String(result);
    }

    if (typeof mod.default === "string") {
      return mod.default;
    }

    // If module has a named export 'output'
    if (typeof mod.output === "function") {
      const result = await mod.output(context);
      return typeof result === "string"
        ? result
        : JSON.stringify(result, null, 2);
    }

    if (typeof mod.output === "string") {
      return mod.output;
    }

    throw new Error(
      `${filePath}: No default export or 'output' export found. ` +
        `Export a function or string: export default async function(ctx) { return "..." }`
    );
  } catch (err) {
    // If import fails for .ts, try with tsx if available
    if (filePath.endsWith(".ts")) {
      return executeWithTsx(filePath, context);
    }
    throw err;
  }
}

/**
 * Fallback: execute .ts file via tsx/npx tsx
 * @param {string} filePath
 * @param {object} context
 * @returns {Promise<string>}
 */
async function executeWithTsx(filePath, context) {
  const { execSync } = await import("node:child_process");

  // Write a wrapper that imports the file and prints the result
  const tmpFile = join(tmpdir(), `nlang-${randomBytes(4).toString("hex")}.mjs`);
  const wrapper = `
import { pathToFileURL } from 'node:url';
const mod = await import(pathToFileURL(${JSON.stringify(filePath)}).href);
const ctx = ${JSON.stringify(context)};
let result;
if (typeof mod.default === 'function') result = await mod.default(ctx);
else if (typeof mod.default === 'string') result = mod.default;
else if (typeof mod.output === 'function') result = await mod.output(ctx);
else if (typeof mod.output === 'string') result = mod.output;
else throw new Error('No default or output export');
if (typeof result !== 'string') result = JSON.stringify(result, null, 2);
process.stdout.write(result);
`;

  await writeFile(tmpFile, wrapper);

  try {
    const result = execSync(`npx tsx ${tmpFile}`, {
      encoding: "utf-8",
      cwd: dirname(filePath),
      timeout: 60000
    });
    return result;
  } finally {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpFile);
    } catch {}
  }
}
