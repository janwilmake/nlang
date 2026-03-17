# nlang

A build system for **executable extensions** — files with double extensions (like `.html.md`, `.css.md`, `.json.js`) that get executed at build time to produce their output files.

Write your site content as LLM prompts or JavaScript, and nlang builds it into static files.

## How it works

If a file has more than one extension, nlang treats it as executable:

- **`.md` executor** — The file contains an LLM prompt. The response becomes the output file.
  - `index.html.md` → prompts an LLM → produces `index.html`
  - `styles.css.md` → prompts an LLM → produces `styles.css`
  - `about.md.md` → prompts an LLM → produces `about.md`

- **`.js` / `.ts` executor** — The file is a script whose output becomes the result.
  - `data.json.js` → runs the script → produces `data.json`

## Features

- **Dependency graph** — Files can reference each other with `@{path}`. nlang scans all files, resolves dependencies, and executes in parallel where possible.
- **Dynamic routes** — Use bracket notation for parameterized paths: `blog/[name].html.md` with a corresponding `blog/name.json` providing the available values.
- **Frontmatter config** — Configure model, MCP servers, and other options per-file via YAML frontmatter.
- **Cron triggers** — Set `trigger: {cron-expression}` in frontmatter to schedule rebuilds.
- **Caching** — Built-in LLM response cache with configurable TTL to avoid redundant API calls.
- **CI/CD integration** — `nlang init` generates a GitHub Actions workflow for automatic builds.

## Install

```bash
npm install -g nlang-cli
```

Requires Node.js >= 18.

## Usage

```bash
# Generate a GitHub Actions workflow for your repo
nlang init

# Build all executable files in the current directory
nlang build

# Build a specific file (and its dependencies)
nlang build -f index.html.md

# Preview what would be executed
nlang build --dry-run

# Build from a specific directory
nlang build -d ./my-site
```

## Project config

Add an `nlang.json` to your project root (or any subdirectory — more specific configs take priority):

```json
{
  "model": "gpt-5.4-2026-03-05",
  "out": "dist"
}
```

## Example

```
my-site/
  nlang.json
  index.html.md        # LLM prompt → index.html
  styles.css.md        # LLM prompt → styles.css
  about.md.md          # LLM prompt → about.md
  blog/
    [name].html.md     # Dynamic route template
    name.json           # ["hello-world", "second-post"]
  data/
    stats.json.md      # LLM prompt → stats.json
  dist/                 # Build output
```

## License

MIT
