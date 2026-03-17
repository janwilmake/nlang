import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Execute a markdown file by sending it to an LLM.
 *
 * @param {object} opts
 * @param {string} opts.content - The markdown prompt (frontmatter stripped)
 * @param {Record<string, any>} opts.frontmatter
 * @param {Record<string, any>} opts.config - merged nlang.json config
 * @param {string} opts.rootDir
 * @param {Record<string, string>} opts.resolvedDeps - map of dep path -> content
 * @param {Record<string, string>} opts.variables - map of variable name -> value
 * @returns {Promise<string>}
 */
export async function executeMarkdown({
  content,
  frontmatter,
  config,
  rootDir,
  resolvedDeps,
  variables
}) {
  // Replace @{path} references with resolved content
  let prompt = content;
  for (const [depPath, depContent] of Object.entries(resolvedDeps)) {
    prompt = prompt.replaceAll(`@{${depPath}}`, depContent);
  }

  // Replace [variable] references
  for (const [varName, varValue] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`[${varName}]`, varValue);
  }

  // Also handle @{URL} references by fetching them
  const urlRegex = /@\{(https?:\/\/[^}]+)\}/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(prompt)) !== null) {
    const url = urlMatch[1];
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      prompt = prompt.replaceAll(`@{${url}}`, text);
    } catch (err) {
      console.warn(`⚠️  Failed to fetch ${url}: ${err.message}`);
    }
  }

  // Determine model and API settings
  const model = frontmatter.model || config.model || "gpt-4o-mini";
  const baseURL = frontmatter.baseURL || config.baseURL || undefined;
  const apiKey =
    frontmatter.apiKey ||
    config.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error(
      "No API key found. Set OPENAI_API_KEY or LLM_API_KEY env var, or configure in nlang.json"
    );
  }

  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {})
  });

  const systemPrompt =
    frontmatter.system ||
    config.system ||
    "You are a build tool. Output ONLY the requested file content, no explanations, no markdown fences unless the output format is markdown.";

  console.log(`  🤖 Calling ${model}...`);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    temperature: frontmatter.temperature ?? config.temperature ?? undefined,
    max_completion_tokens:
      frontmatter.max_tokens ?? config.max_tokens ?? undefined
  });

  const result = response.choices[0]?.message?.content || "";

  // Strip wrapping code fences if present and the output isn't markdown
  return stripCodeFences(result);
}

/**
 * Strip leading/trailing code fences from LLM output.
 * e.g. ```html\n...\n``` -> ...
 * @param {string} text
 * @returns {string}
 */
function stripCodeFences(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```\w*\n([\s\S]*?)\n```$/);
  if (match) return match[1];
  return trimmed;
}
