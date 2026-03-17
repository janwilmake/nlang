# Testing the nlang CLI

## Prerequisites

```bash
# From the nlang project root (parent of this test-repo)
npm link
# Or use directly:
node ../bin/nlang.js
```

Set your API key:

```bash
export OPENAI_API_KEY=sk-your-key-here
```

## Test Commands

### 1. Dry run — see the execution plan

```bash
cd test-repo
nlang build --dry-run
```

Expected: Shows all discovered files, the dependency graph layers, and execution order — but doesn't execute anything.

### 2. Init — generate the GitHub Action

```bash
nlang init
```

Expected: Creates `.github/workflows/nlang.yml` with:

- `on: push` trigger
- Two `schedule` entries:
  - `0 */12 * * *` (for feed.xml.md — every 12 hours)
  - `0 8 * * 1` (for news/digest.html.md — Mondays at 8am)
- Conditional build logic for each cron schedule

### 3. Full build

```bash
nlang build
```

Expected execution order (approximately):

- **Layer 1** (no dependencies): `index.html.md`, `about.md.md`, `data/site-meta.json.js`, `data/skills.json.js`, `data/stats.json.md`, `blog/index.html.js`, `news/digest.html.md`, `sitemap.xml.md`
- **Layer 2** (depends on layer 1 outputs): `styles.css.md` (needs index.html), `data/combined.json.md` (needs site-meta + skills + stats), `feed.xml.md` (needs site-meta + name.json)
- **Layer 3** (depends on layer 2): `blog/[name].html.md` × 3 variants (needs site-meta.json)

Output should appear in `dist/`:

```
dist/
├── index.html
├── styles.css
├── about.md
├── sitemap.xml
├── feed.xml
├── data/
│   ├── site-meta.json
│   ├── skills.json
│   ├── stats.json
│   └── combined.json
├── blog/
│   ├── index.html
│   ├── hello-world.html
│   ├── getting-started-with-rust.html
│   └── why-typescript.html
└── news/
    └── digest.html
```

### 4. Single file build

```bash
nlang build --file styles.css.md
```

Expected: Builds `index.html.md` first (dependency), then `styles.css.md`.

### 5. Caching test

```bash
# First build
nlang build

# Second build — should use cache for most files
nlang build
```

Expected: Second run shows `💾 (cached)` for most files.

## Features Exercised

| Feature                | Test Files                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| LLM markdown execution | `index.html.md`, `about.md.md`, `styles.css.md`                                                |
| JS execution           | `data/site-meta.json.js`, `data/skills.json.js`, `blog/index.html.js`                          |
| `@{path}` dependencies | `styles.css.md` → `index.html`, `data/combined.json.md` → 3 deps                               |
| `[variable]` expansion | `blog/[name].html.md` + `blog/name.json`                                                       |
| Cron triggers          | `feed.xml.md` (every 12h), `news/digest.html.md` (weekly Monday)                               |
| Cache TTL config       | `feed.xml.md` (43200s), `news/digest.html.md` (0 = no cache), `sitemap.xml.md` (-1 = infinite) |
| Frontmatter config     | Various: model, temperature, trigger, cacheTtl                                                 |
| Config hierarchy       | Root `nlang.json` provides defaults                                                            |
| Parallel execution     | Layer 1 has ~8 independent files                                                               |
| Dependency chain       | `combined.json.md` depends on 3 generated files                                                |
