import { glob } from "glob";
import { readFile } from "node:fs/promises";
import { join, basename, dirname, extname, relative } from "node:path";
import matter from "gray-matter";

/**
 * Represents a discovered executable file.
 * @typedef {{
 *   path: string,
 *   relativePath: string,
 *   outputExtension: string,
 *   executorExtension: string,
 *   frontmatter: Record<string, any>,
 *   content: string,
 *   rawContent: string,
 *   dependencies: string[],
 *   variables: { name: string, valuesFile: string | null }[],
 *   cron: string | null,
 * }} ExecutableFile
 */

// Match files with 2+ extensions: e.g. foo.html.md, bar.json.js
const DOUBLE_EXT_PATTERN = "**/*.*.*";

// Executor extensions we know how to run
const EXECUTOR_EXTENSIONS = new Set([".md", ".js", ".ts"]);

/**
 * Scan a directory for double-extension files.
 * @param {string} rootDir
 * @returns {Promise<ExecutableFile[]>}
 */
export async function scanFiles(rootDir) {
  const files = await glob(DOUBLE_EXT_PATTERN, {
    cwd: rootDir,
    nodir: true,
    ignore: ["node_modules/**", ".git/**", ".github/**", "dist/**", "build/**"]
  });

  /** @type {ExecutableFile[]} */
  const executables = [];

  for (const relPath of files) {
    const fullPath = join(rootDir, relPath);
    const name = basename(relPath);

    // Get the last extension (executor) and everything before it (output)
    const executorExt = extname(name);
    if (!EXECUTOR_EXTENSIONS.has(executorExt)) continue;

    const withoutExecutor = name.slice(0, -executorExt.length);
    const outputExt = extname(withoutExecutor);
    if (!outputExt) continue; // need at least 2 extensions

    const rawContent = await readFile(fullPath, "utf-8");

    // Parse frontmatter for .md files
    let frontmatterData = {};
    let content = rawContent;
    if (executorExt === ".md") {
      const parsed = matter(rawContent);
      frontmatterData = parsed.data;
      content = parsed.content;
    } else {
      content = rawContent;
    }

    // Extract @{path} dependencies
    const dependencies = extractDependencies(content);

    // Extract [variable] patterns from path
    const variables = extractVariables(relPath, rootDir);

    // Extract cron
    const cron = frontmatterData.trigger || null;

    executables.push({
      path: fullPath,
      relativePath: relPath,
      outputExtension: outputExt,
      executorExtension: executorExt,
      frontmatter: frontmatterData,
      content,
      rawContent,
      dependencies,
      variables,
      cron
    });
  }

  return executables;
}

/**
 * Extract @{path} and @{URL} references from content.
 * @param {string} content
 * @returns {string[]}
 */
function extractDependencies(content) {
  const regex = /@\{([^}]+)\}/g;
  const deps = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const ref = match[1];
    // Skip URLs — only keep local paths
    if (!ref.startsWith("http://") && !ref.startsWith("https://")) {
      deps.push(ref);
    }
  }
  return deps;
}

/**
 * Extract [variable] patterns from file path and look for companion JSON.
 * @param {string} relPath
 * @param {string} rootDir
 * @returns {{ name: string, valuesFile: string | null }[]}
 */
function extractVariables(relPath, rootDir) {
  const regex = /\[([^\]]+)\]/g;
  const vars = [];
  let match;
  while ((match = regex.exec(relPath)) !== null) {
    const varName = match[1];
    // Look for companion JSON: same directory, varName.json
    const dir = dirname(relPath);
    const valuesFile = join(dir, `${varName}.json`);
    vars.push({ name: varName, valuesFile });
  }
  return vars;
}

/**
 * Load nlang.json config, walking up from file's directory to rootDir.
 * More specific configs override less specific ones.
 * @param {string} filePath - relative path of the file
 * @param {string} rootDir
 * @returns {Promise<Record<string, any>>}
 */
export async function loadConfig(filePath, rootDir) {
  const parts = dirname(filePath).split("/").filter(Boolean);
  const configPaths = [];

  // From most specific to least specific
  let current = "";
  // Root config
  configPaths.push(join(rootDir, "nlang.json"));
  // Also check ~/.nlang (global)
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (homeDir) {
    configPaths.push(join(homeDir, ".nlang"));
  }

  // Build paths from root to the file's directory
  const dirConfigs = [];
  for (const part of parts) {
    current = current ? join(current, part) : part;
    dirConfigs.push(join(rootDir, current, "nlang.json"));
  }

  // Merge: global < root < dir1 < dir2 < ... < most_specific_dir
  let merged = {};

  // Global config (lowest priority)
  if (homeDir) {
    merged = await tryLoadJson(join(homeDir, ".nlang"), merged);
  }

  // Root config
  merged = await tryLoadJson(join(rootDir, "nlang.json"), merged);

  // Directory configs (most specific wins)
  for (const configPath of dirConfigs) {
    merged = await tryLoadJson(configPath, merged);
  }

  return merged;
}

/**
 * @param {string} path
 * @param {Record<string, any>} base
 * @returns {Promise<Record<string, any>>}
 */
async function tryLoadJson(path, base) {
  try {
    const raw = await readFile(path, "utf-8");
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}
