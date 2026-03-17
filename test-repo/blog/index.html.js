// blog/index.html.js — generates the blog index page from the post list
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export default async function (ctx) {
  // Read the list of blog post slugs
  let names;
  try {
    const raw = await readFile(
      join(ctx.rootDir, "blog", "name.json"),
      "utf-8",
    );
    names = JSON.parse(raw);
  } catch {
    names = ["hello-world", "getting-started-with-rust", "why-typescript"];
  }

  const postLinks = names
    .map((slug) => {
      const title = slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return `      <li><a href="${slug}.html">${title}</a></li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog - Alex Developer</title>
  <style>
    body { background: #0d1117; color: #c9d1d9; font-family: 'Inter', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1 { border-bottom: 1px solid #21262d; padding-bottom: 0.5rem; }
    li { margin: 0.75rem 0; font-size: 1.1rem; }
    .back { display: inline-block; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <a class="back" href="../index.html">← Back to Home</a>
  <h1>Blog Posts</h1>
  <ul>
${postLinks}
  </ul>
  <footer style="margin-top:3rem;color:#484f58;font-size:0.85rem">
    Built with extexe · ${new Date().toISOString().split("T")[0]}
  </footer>
</body>
</html>`;
}