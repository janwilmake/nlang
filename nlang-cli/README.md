# nlang — Executable Extensions

A build system where **file extensions define the build pipeline**. Files with double extensions (`.html.md`, `.json.js`, `.css.md`) are automatically executed: markdown files are sent to an LLM, JavaScript/TypeScript files are run in Node.js.

## Install

```bash
npm install -g nlang
```

## Quick Start

1. Create a file with a double extension:

```markdown
## <!-- index.html.md -->

## model: gpt-4o-mini

Create a simple landing page for a developer portfolio.
Include a hero section, about section, and contact form.
Use modern CSS with a dark theme.
```

2. Generate the GitHub Action:

```bash
nlang init
```

3. Set your API key in GitHub repo Settings → Secrets → `OPENAI_API_KEY`

4. Push — your files will be built automatically!

## How It Works

### Double Extensions

The **last extension** determines the executor, everything before it is the output format:

| Source File      | Executor             | Output        |
| ---------------- | -------------------- | ------------- |
| `index.html.md`  | LLM prompt           | `index.html`  |
| `styles.css.md`  | LLM prompt           | `styles.css`  |
| `data.json.js`   | Node.js              | `data.json`   |
| `readme.md.md`   | LLM prompt           | `readme.md`   |
| `sitemap.xml.ts` | Node.js (TypeScript) | `sitemap.xml` |

### Markdown Executor (LLM)

Markdown files are sent as prompts to an LLM. Configure with **frontmatter**:

```markdown
---
model: gpt-4o
temperature: 0.7
max_tokens: 8192
system: "You are an expert web developer."
cacheTtl: 86400
---

Your prompt here...
```

### JavaScript/TypeScript Executor

JS/TS files export a function that returns the output:

```javascript
// data.json.js
export default async function (ctx) {
  const response = await fetch("https://api.example.com/data");
  const data = await response.json();
  return JSON.stringify(data, null, 2);
}
```

The `ctx` object contains:

- `deps` — resolved dependency contents
- `variables` — variable values for this variant
- `config` — merged nlang.json configuration
- `rootDir` — project root path
- `env` — environment variables

### Dependencies with `@{path}`

Reference other files in your prompts:

```markdown
<!-- components.html.md -->

Create HTML components following this design system:

@{design-tokens.json}

And matching these TypeScript types:

@{src/types.ts}
```

Files are built in dependency order. If `design-tokens.json` is itself generated (e.g., from `design-tokens.json.md`), it will be built first.

You can also reference URLs:

```markdown
@{https://raw.githubusercontent.com/user/repo/main/schema.json}
```

### Variables with `[name]`

Use bracket syntax in paths for templated builds:

```
blog/
  name.json          # ["hello-world", "getting-started", "advanced-tips"]
  [name].html.md     # Template that uses [name] in the prompt
```

The `[name].html.md` file will be executed once for each value in `name.json`, producing:

- `blog/hello-world.html`
- `blog/getting-started.html`
- `blog/advanced-tips.html`

### Cron Schedules

Add a `trigger` to frontmatter for scheduled rebuilds:

```markdown
---
trigger: "0 */6 * * *"
---

Fetch the latest news and generate an HTML summary...
```

When you run `nlang init`, this is picked up and added to the GitHub Action schedule.

### Configuration: `nlang.json`

Place `nlang.json` in any directory. More specific configs override parent configs:

```json
{
  "model": "gpt-4o",
  "temperature": 0,
  "cacheTtl": 3600,
  "baseURL": "https://api.openai.com/v1",
  "system": "You are a helpful assistant."
}
```

Config resolution order (later wins):

1. `~/.nlang` (global)
2. `./nlang.json` (project root)
3. `./subdir/nlang.json` (closer to file)
4. File frontmatter (highest priority)

### Caching

LLM responses are cached by content hash with configurable TTL:

- Default TTL: **1 hour** (3600s)
- When MCP is enabled: **no cache** by default
- Override with `cacheTtl` in frontmatter or `nlang.json`
- Set `cacheTtl: 0` to disable caching
- Set `cacheTtl: -1` for infinite cache (only invalidated by content changes)

## CLI

```bash
# Generate GitHub Action workflow
nlang init

# Build all executable files
nlang build

# Build a specific file and its dependency chain
nlang build --file blog/[name].html.md

# Dry run — show execution plan without running
nlang build --dry-run

# Specify project directory
nlang build -d /path/to/project
```

## Environment Variables

| Variable         | Description                                      |
| ---------------- | ------------------------------------------------ |
| `OPENAI_API_KEY` | OpenAI API key                                   |
| `LLM_API_KEY`    | Alternative API key (for OpenAI-compatible APIs) |

## Example Project

```
my-site/
├── nlang.json              # {"model": "gpt-4o-mini"}
├── index.html.md            # Landing page prompt
├── styles.css.md            # CSS prompt (references index.html.md output)
├── blog/
│   ├── name.json            # ["intro", "tutorial"]
│   ├── [name].html.md       # Blog post template
│   └── index.html.js        # Blog index (reads generated posts)
├── data/
│   └── api-data.json.ts     # Fetches and transforms API data
└── dist/                    # ← Build output (auto-generated)
    ├── index.html
    ├── styles.css
    ├── blog/
    │   ├── intro.html
    │   ├── tutorial.html
    │   └── index.html
    └── data/
        └── api-data.json
```
