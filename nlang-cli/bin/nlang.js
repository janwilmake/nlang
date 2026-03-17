#!/usr/bin/env node

import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { initWorkflow } from "../src/init.js";
import { build } from "../src/build.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: "string", short: "d", default: "." },
    help: { type: "boolean", short: "h", default: false },
    "dry-run": { type: "boolean", default: false },
    file: { type: "string", short: "f" }
  }
});

const command = positionals[0];

if (values.help || !command) {
  console.log(`
nlang - Executable Extensions

Commands:
  init      Scan repo and generate .github/workflows/nlang.yml
  build     Execute all double-extension files in dependency order
  
Options:
  -d, --dir <path>    Root directory (default: .)
  -f, --file <path>   Build only a specific file (and its dependencies)
  --dry-run            Show what would be executed without running
  -h, --help           Show this help
`);
  process.exit(0);
}

const rootDir = resolve(values.dir);

if (command === "init") {
  await initWorkflow(rootDir);
} else if (command === "build") {
  await build(rootDir, { dryRun: values["dry-run"], file: values.file });
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
