import { scanFiles, loadConfig } from "./scanner.js";
import { buildExecutionGraph, getSubgraph } from "./graph.js";
import { loadCache, saveCache, computeHash, isCacheValid } from "./cache.js";
import { executeMarkdown } from "./executors/markdown.js";
import { executeJavaScript } from "./executors/javascript.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

/**
 * @param {string} rootDir
 * @param {{ dryRun?: boolean, file?: string }} opts
 */
export async function build(rootDir, opts = {}) {
  console.log(`\n🔨 nlang build starting in ${rootDir}\n`);

  // 1. Scan for executable files
  let allFiles = await scanFiles(rootDir);
  console.log(`📂 Found ${allFiles.length} executable file(s)\n`);

  if (allFiles.length === 0) {
    console.log("Nothing to build.");
    return;
  }

  // 2. If targeting a specific file, get its subgraph
  let files = allFiles;
  if (opts.file) {
    files = getSubgraph(allFiles, opts.file);
    console.log(
      `🎯 Building subgraph for ${opts.file}: ${files.length} file(s)\n`
    );
  }

  // 3. Expand variables — creates virtual file entries for each variable value
  files = await expandVariables(files, rootDir);

  // 4. Build execution graph
  const { layers } = buildExecutionGraph(files);
  console.log(`📊 Execution plan: ${layers.length} layer(s)\n`);
  for (let i = 0; i < layers.length; i++) {
    console.log(
      `  Layer ${i + 1}: ${layers[i].map((f) => f.relativePath).join(", ")}`
    );
  }
  console.log();

  if (opts.dryRun) {
    console.log("🏃 Dry run — not executing.");
    return;
  }

  // 5. Load cache
  const cache = await loadCache(rootDir);

  // 6. Execute layer by layer
  /** @type {Map<string, string>} - output path -> content */
  const outputs = new Map();

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    console.log(`\n⚡ Executing layer ${i + 1}/${layers.length}...`);

    await Promise.all(
      layer.map(async (file) => {
        try {
          const result = await executeFile(file, rootDir, cache, outputs);
          const outputPath = file.relativePath.slice(
            0,
            -file.executorExtension.length
          );
          outputs.set(outputPath, result);
          outputs.set(file.relativePath, result);
        } catch (err) {
          console.error(`  ❌ ${file.relativePath}: ${err.message}`);
        }
      })
    );
  }

  // 7. Write output files
  console.log(`\n📝 Writing ${outputs.size / 2} output file(s)...\n`);
  const distDir = join(rootDir, "dist");
  await mkdir(distDir, { recursive: true });

  for (const [relPath, content] of outputs) {
    // Skip the .xyz.md paths, only write the output paths (without executor ext)
    if (
      relPath.endsWith(".md") ||
      relPath.endsWith(".js") ||
      relPath.endsWith(".ts")
    ) {
      // Check if this is a source path (has double extension)
      const parts = relPath.split(".");
      if (parts.length > 2) continue;
    }

    const outPath = join(distDir, relPath);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, content);
    console.log(`  ✅ dist/${relPath}`);
  }

  // 8. Save cache
  await saveCache(rootDir, cache);
  console.log(`\n✨ Build complete!\n`);
}

/**
 * Execute a single file.
 * @param {import('./scanner.js').ExecutableFile} file
 * @param {string} rootDir
 * @param {Map<string, import('./cache.js').CacheEntry>} cache
 * @param {Map<string, string>} outputs - already-built outputs
 * @returns {Promise<string>}
 */
async function executeFile(file, rootDir, cache, outputs) {
  const config = await loadConfig(file.relativePath, rootDir);

  // Resolve dependencies from outputs or filesystem
  /** @type {Record<string, string>} */
  const resolvedDeps = {};
  for (const dep of file.dependencies) {
    if (outputs.has(dep)) {
      resolvedDeps[dep] = outputs.get(dep);
    } else {
      // Try reading from filesystem
      try {
        resolvedDeps[dep] = await readFile(join(rootDir, dep), "utf-8");
      } catch {
        // Try from dist
        try {
          resolvedDeps[dep] = await readFile(
            join(rootDir, "dist", dep),
            "utf-8"
          );
        } catch {
          console.warn(
            `  ⚠️  Dependency ${dep} not found for ${file.relativePath}`
          );
        }
      }
    }
  }

  // Compute content hash for caching
  const fullContent =
    file.content +
    JSON.stringify(resolvedDeps) +
    JSON.stringify(file._variables || {});
  const hash = computeHash(fullContent, config);

  // Determine TTL: if MCP is used, default to 0 (no cache) unless explicitly set
  const usesMcp = file.frontmatter.mcp || config.mcp;
  const defaultTtl = usesMcp ? 0 : 3600; // 1 hour default
  const ttl = file.frontmatter.cacheTtl ?? config.cacheTtl ?? defaultTtl;

  // Check cache
  const cacheKey = file.relativePath + (file._variantKey || "");
  const cached = cache.get(cacheKey);
  if (isCacheValid(cached, hash)) {
    console.log(`  💾 ${file.relativePath} (cached)`);
    return cached.result;
  }

  console.log(`  🔧 ${file.relativePath}`);

  let result;

  if (file.executorExtension === ".md") {
    result = await executeMarkdown({
      content: file.content,
      frontmatter: file.frontmatter,
      config,
      rootDir,
      resolvedDeps,
      variables: file._variables || {}
    });
  } else if (
    file.executorExtension === ".js" ||
    file.executorExtension === ".ts"
  ) {
    result = await executeJavaScript({
      filePath: file.path,
      content: file.content,
      resolvedDeps,
      variables: file._variables || {},
      config,
      rootDir
    });
  } else {
    throw new Error(`Unknown executor: ${file.executorExtension}`);
  }

  // Update cache
  cache.set(cacheKey, {
    hash,
    result,
    timestamp: Date.now(),
    ttl
  });

  return result;
}

/**
 * Expand [variable] files into multiple virtual file entries.
 * @param {import('./scanner.js').ExecutableFile[]} files
 * @param {string} rootDir
 * @returns {Promise<import('./scanner.js').ExecutableFile[]>}
 */
async function expandVariables(files, rootDir) {
  /** @type {import('./scanner.js').ExecutableFile[]} */
  const expanded = [];

  for (const file of files) {
    if (file.variables.length === 0) {
      expanded.push(file);
      continue;
    }

    // Load variable values
    /** @type {Record<string, string[]>} */
    const varValues = {};
    let hasAllValues = true;

    for (const v of file.variables) {
      const valuesPath = join(rootDir, v.valuesFile);
      try {
        const raw = await readFile(valuesPath, "utf-8");
        const values = JSON.parse(raw);
        if (Array.isArray(values)) {
          varValues[v.name] = values;
        } else {
          console.warn(`  ⚠️  ${v.valuesFile} should contain a JSON array`);
          hasAllValues = false;
        }
      } catch {
        console.warn(
          `  ⚠️  Variable file ${v.valuesFile} not found for ${file.relativePath}`
        );
        hasAllValues = false;
      }
    }

    if (!hasAllValues) {
      expanded.push(file);
      continue;
    }

    // Generate combinations (for simplicity, handle single variable; multi-var is a cartesian product)
    const varNames = Object.keys(varValues);
    const combos = cartesian(varNames.map((n) => varValues[n]));

    for (const combo of combos) {
      const vars = {};
      let path = file.relativePath;
      for (let j = 0; j < varNames.length; j++) {
        vars[varNames[j]] = combo[j];
        path = path.replaceAll(`[${varNames[j]}]`, combo[j]);
      }

      expanded.push({
        ...file,
        relativePath: path,
        _variables: vars,
        _variantKey: JSON.stringify(vars),
        variables: [] // already expanded
      });
    }
  }

  return expanded;
}

/**
 * Cartesian product of arrays.
 * @param {string[][]} arrays
 * @returns {string[][]}
 */
function cartesian(arrays) {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restCombos = cartesian(rest);
  return first.flatMap((val) => restCombos.map((combo) => [val, ...combo]));
}
