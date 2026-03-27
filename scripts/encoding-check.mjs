import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const selfRelativePath = path.relative(repoRoot, __filename).replace(/\\/g, "/");
const skipDirs = new Set([".git", "node_modules", ".next", "dist", "coverage", ".turbo", "storage"]);
const textExtensions = new Set([".md", ".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".css"]);
const suspiciousFragments = ["锘", "闃舵", "鎬昏", "褰撳墠", "鍙樻洿", "鐩綍", "寰呭鐞"];

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name), results);
      continue;
    }
    if (textExtensions.has(path.extname(entry.name))) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

const findings = [];
for (const filePath of walk(repoRoot)) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  if (relativePath === selfRelativePath) {
    continue;
  }

  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\?{3,}/.test(line)) {
      findings.push({ file: relativePath, line: index + 1, reason: "contains repeated question marks" });
    }
    if (line.includes("�")) {
      findings.push({ file: relativePath, line: index + 1, reason: "contains replacement character" });
    }
    for (const fragment of suspiciousFragments) {
      if (line.includes(fragment)) {
        findings.push({ file: relativePath, line: index + 1, reason: `contains suspicious mojibake fragment: ${fragment}` });
        break;
      }
    }
  });
}

if (findings.length) {
  console.error("Encoding check failed. Suspicious text found:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.reason}`);
  }
  process.exit(1);
}

console.log("Encoding check passed.");