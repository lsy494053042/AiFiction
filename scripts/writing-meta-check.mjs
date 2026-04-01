import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const args = process.argv.slice(2);

const options = {
  dir: null,
  from: null,
  to: null,
  paths: [],
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--dir") {
    options.dir = args[i + 1];
    i += 1;
    continue;
  }

  if (arg === "--from") {
    options.from = Number(args[i + 1]);
    i += 1;
    continue;
  }

  if (arg === "--to") {
    options.to = Number(args[i + 1]);
    i += 1;
    continue;
  }

  options.paths.push(arg);
}

const checks = [
  { label: "卷级说明", regex: /卷[一二三四五六七八九十两]/g },
  { label: "卷末说明", regex: /卷末/g },
  { label: "阶段说明", regex: /第[一二三四五六七八九十两]+阶段|阶段第?[一二三四五六七八九十两]?/g },
  { label: "整书说明", regex: /整本/g },
  { label: "后续编排说明", regex: /下一组|下一阶段/g },
  { label: "作者总结腔", regex: /真正要点|真正的终点|前面追了那么久/g },
];

function resolveTarget(target) {
  if (!target) return null;
  return path.isAbsolute(target) ? target : path.resolve(cwd, target);
}

function collectMarkdownFiles(entryPath, results) {
  const stat = fs.statSync(entryPath);

  if (stat.isFile()) {
    if (entryPath.toLowerCase().endsWith(".md")) {
      results.push(entryPath);
    }
    return;
  }

  for (const item of fs.readdirSync(entryPath, { withFileTypes: true })) {
    const fullPath = path.join(entryPath, item.name);
    if (item.isDirectory()) {
      collectMarkdownFiles(fullPath, results);
      continue;
    }
    if (item.isFile() && item.name.toLowerCase().endsWith(".md")) {
      results.push(fullPath);
    }
  }
}

function chapterIndex(filePath) {
  const base = path.basename(filePath);
  const match = base.match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

function filterByRange(files) {
  if (options.from == null && options.to == null) {
    return files;
  }

  return files.filter((file) => {
    const index = chapterIndex(file);
    if (index == null) return false;
    if (options.from != null && index < options.from) return false;
    if (options.to != null && index > options.to) return false;
    return true;
  });
}

function lineNumberAt(content, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) {
    if (content[i] === "\n") {
      line += 1;
    }
  }
  return line;
}

const discovered = [];

if (options.dir) {
  const resolved = resolveTarget(options.dir);
  if (resolved && fs.existsSync(resolved)) {
    collectMarkdownFiles(resolved, discovered);
  }
}

for (const target of options.paths) {
  const resolved = resolveTarget(target);
  if (!resolved || !fs.existsSync(resolved)) {
    console.error(`[writing:meta-check] Path not found: ${target}`);
    process.exitCode = 1;
    continue;
  }
  collectMarkdownFiles(resolved, discovered);
}

if (!options.dir && options.paths.length === 0) {
  const defaultDir = path.resolve(cwd, "books");
  if (fs.existsSync(defaultDir)) {
    collectMarkdownFiles(defaultDir, discovered);
  }
}

const files = [...new Set(filterByRange(discovered))].sort();

if (files.length === 0) {
  console.error("[writing:meta-check] No markdown files matched.");
  process.exit(1);
}

const hits = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");

  for (const check of checks) {
    for (const match of content.matchAll(check.regex)) {
      const line = lineNumberAt(content, match.index ?? 0);
      hits.push({
        file,
        line,
        label: check.label,
        text: match[0],
      });
    }
  }
}

if (hits.length === 0) {
  console.log(`[writing:meta-check] OK (${files.length} files scanned)`);
  process.exit(0);
}

console.error(`[writing:meta-check] Found ${hits.length} potential meta-language hit(s):`);
for (const hit of hits) {
  console.error(`- ${path.relative(cwd, hit.file)}:${hit.line} [${hit.label}] ${hit.text}`);
}
process.exit(1);
