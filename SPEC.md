nlang

# Executable Extensions

- if a file has more than 1 extension, it may be treated as something that needs to be executed in the build-step
- `.md` is the main executable as it may contain a prompt, for example for:
  - .html.md
  - .css.md
  - .js.md
  - .md.md
  - .json.md
- `.js` and `.ts` can also be executed by assuming the response is a file, for example:
  - `.html.js`
  - `.md.ts`
  - `.json.js`
  - `.png.ts`

## Javascript execution

## Markdown Execution

- **Frontmatter**: you can configure individual markdown files with frontmatter: choose the model, enable MCP(s)
- **extexe.json**: this file cna also configure things like the model, this can be configured in any folder up to the root folder of the project, or globally at `.extexe`. The more specific ones have priority.

### Variables

You can put variables in the folder and filenames, which can in turn be used in the prompt in the `.xyz.md` file, for example:

- `blog/[name].md.md` can contain [name] in the prompt to be filled.
- `blog/name.json` may exist. If it does, it is assumed to contain the available name paths.

### Cronjobs

With frontmatter you can set `trigger: {cron-expression}`. This will trigger a build for this particular file and all it's dependencies and dependants.

### Linking other files

Files and folders can be linked using `@{URL}` or with `@{path}`. Before building, all files are scanned for path-dependencies and the order of the execution is determined in an as parallel way as possible.

### Caching

The LLM api should have build-in cache with configurable TTL such that not all LLM prompts are re-ran every time. When MCP is used, cache should be turned off by default unless turned on in front-matter.

# Output

The build output is to be deployed automatically whenever a change occurs as a set of files.
