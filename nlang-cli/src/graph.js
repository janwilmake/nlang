/**
 * Build a dependency graph and return execution order.
 * Returns layers of files that can be executed in parallel.
 *
 * @typedef {import('./scanner.js').ExecutableFile} ExecutableFile
 */

/**
 * @param {ExecutableFile[]} files
 * @returns {{ layers: ExecutableFile[][], order: ExecutableFile[] }}
 */
export function buildExecutionGraph(files) {
  // Map relative paths to files (including output paths)
  /** @type {Map<string, ExecutableFile>} */
  const fileMap = new Map();
  for (const file of files) {
    fileMap.set(file.relativePath, file);
    // Also map by output path (without executor extension)
    const outputPath = file.relativePath.slice(
      0,
      -file.executorExtension.length,
    );
    fileMap.set(outputPath, file);
  }

  // Build adjacency list: file -> files it depends on
  /** @type {Map<string, Set<string>>} */
  const adj = new Map();
  /** @type {Map<string, number>} */
  const inDegree = new Map();

  for (const file of files) {
    const key = file.relativePath;
    if (!adj.has(key)) adj.set(key, new Set());
    if (!inDegree.has(key)) inDegree.set(key, 0);

    for (const dep of file.dependencies) {
      // Resolve dep to a known file
      const depFile = fileMap.get(dep);
      if (depFile && depFile.relativePath !== key) {
        const depKey = depFile.relativePath;
        if (!adj.has(depKey)) adj.set(depKey, new Set());
        if (!inDegree.has(depKey)) inDegree.set(depKey, 0);

        // dep must run before this file
        adj.get(depKey).add(key);
        inDegree.set(key, (inDegree.get(key) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm — topological sort with layers for parallelism
  /** @type {ExecutableFile[][]} */
  const layers = [];
  let queue = [];

  for (const file of files) {
    if ((inDegree.get(file.relativePath) || 0) === 0) {
      queue.push(file.relativePath);
    }
  }

  const visited = new Set();

  while (queue.length > 0) {
    const layer = [];
    const nextQueue = [];

    for (const key of queue) {
      if (visited.has(key)) continue;
      visited.add(key);
      const file = files.find((f) => f.relativePath === key);
      if (file) layer.push(file);

      for (const neighbor of adj.get(key) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          nextQueue.push(neighbor);
        }
      }
    }

    if (layer.length > 0) layers.push(layer);
    queue = nextQueue;
  }

  // Check for cycles
  if (visited.size < files.length) {
    const unvisited = files.filter((f) => !visited.has(f.relativePath));
    console.error(
      "⚠️  Circular dependencies detected in:",
      unvisited.map((f) => f.relativePath),
    );
  }

  const order = layers.flat();
  return { layers, order };
}

/**
 * Given a specific file, find all its transitive dependencies and dependants.
 * @param {ExecutableFile[]} allFiles
 * @param {string} targetPath - relative path
 * @returns {ExecutableFile[]}
 */
export function getSubgraph(allFiles, targetPath) {
  /** @type {Map<string, ExecutableFile>} */
  const fileMap = new Map();
  for (const f of allFiles) {
    fileMap.set(f.relativePath, f);
    const outputPath = f.relativePath.slice(0, -f.executorExtension.length);
    fileMap.set(outputPath, f);
  }

  const needed = new Set();

  // Collect transitive dependencies (upstream)
  function collectDeps(path) {
    if (needed.has(path)) return;
    needed.add(path);
    const file = fileMap.get(path);
    if (!file) return;
    for (const dep of file.dependencies) {
      const depFile = fileMap.get(dep);
      if (depFile) collectDeps(depFile.relativePath);
    }
  }

  // Collect transitive dependants (downstream)
  function collectDependants(path) {
    if (needed.has(path)) return;
    needed.add(path);
    for (const f of allFiles) {
      const outputPath = path.slice(
        0,
        -((fileMap.get(path)?.executorExtension || "").length || 0),
      );
      if (f.dependencies.includes(path) || f.dependencies.includes(outputPath)) {
        collectDependants(f.relativePath);
      }
    }
  }

  collectDeps(targetPath);
  collectDependants(targetPath);

  return allFiles.filter((f) => needed.has(f.relativePath));
}