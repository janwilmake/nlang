import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

const CACHE_DIR = ".nlang-cache";

/**
 * @typedef {{
 *   hash: string,
 *   result: string,
 *   timestamp: number,
 *   ttl: number,
 * }} CacheEntry
 */

/**
 * @param {string} rootDir
 * @returns {Promise<Map<string, CacheEntry>>}
 */
export async function loadCache(rootDir) {
  const cachePath = join(rootDir, CACHE_DIR, "cache.json");
  try {
    const raw = await readFile(cachePath, "utf-8");
    const entries = JSON.parse(raw);
    return new Map(Object.entries(entries));
  } catch {
    return new Map();
  }
}

/**
 * @param {string} rootDir
 * @param {Map<string, CacheEntry>} cache
 */
export async function saveCache(rootDir, cache) {
  const cachePath = join(rootDir, CACHE_DIR, "cache.json");
  await mkdir(dirname(cachePath), { recursive: true });
  const obj = Object.fromEntries(cache);
  await writeFile(cachePath, JSON.stringify(obj, null, 2));
}

/**
 * Get a cache key hash for a file's content + dependencies.
 * @param {string} content
 * @param {Record<string, any>} config
 * @returns {string}
 */
export function computeHash(content, config = {}) {
  const hash = createHash("sha256");
  hash.update(content);
  hash.update(JSON.stringify(config));
  return hash.digest("hex").slice(0, 16);
}

/**
 * Check if a cache entry is still valid.
 * @param {CacheEntry | undefined} entry
 * @param {string} currentHash
 * @returns {boolean}
 */
export function isCacheValid(entry, currentHash) {
  if (!entry) return false;
  if (entry.hash !== currentHash) return false;
  if (entry.ttl > 0) {
    const elapsed = Date.now() - entry.timestamp;
    if (elapsed > entry.ttl * 1000) return false;
  }
  return true;
}
