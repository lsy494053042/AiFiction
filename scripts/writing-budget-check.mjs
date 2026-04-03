import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const args = process.argv.slice(2);

const options = {
  bookRoot: null,
  from: null,
  to: null,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--book-root") {
    options.bookRoot = args[i + 1];
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
}

function resolveBookRoot() {
  if (options.bookRoot) {
    return path.isAbsolute(options.bookRoot)
      ? options.bookRoot
      : path.resolve(cwd, options.bookRoot);
  }

  const booksDir = path.resolve(cwd, "books");
  const firstBook = fs
    .readdirSync(booksDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory());

  if (!firstBook) {
    throw new Error("books 目录下没有找到任何作品目录。");
  }

  return path.join(booksDir, firstBook.name);
}

function chapterIndex(fileName) {
  const match = fileName.match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

function stripWhitespace(text) {
  return text.replace(/\s+/g, "");
}

function matchNumber(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`未能从 book.yml 中解析 ${label}。`);
  }

  return Number(match[1]);
}

const bookRoot = resolveBookRoot();
const chapterDir = path.join(bookRoot, "02-正文");
const bookConfigPath = path.join(bookRoot, "book.yml");

if (!fs.existsSync(bookConfigPath)) {
  console.error("[writing:budget-check] 缺少 book.yml，无法读取预算配置。");
  process.exit(1);
}

if (!fs.existsSync(chapterDir)) {
  console.error("[writing:budget-check] 缺少正文目录。");
  process.exit(1);
}

const bookConfig = fs.readFileSync(bookConfigPath, "utf8");
const chapterTarget = {
  min: matchNumber(
    bookConfig,
    /chapter_target_chars:\s*(?:\r?\n)+\s*min:\s*(\d+)/,
    "单章目标最小字数",
  ),
  max: matchNumber(
    bookConfig,
    /chapter_target_chars:\s*(?:\r?\n)+\s*min:\s*\d+\s*(?:\r?\n)+\s*max:\s*(\d+)/,
    "单章目标最大字数",
  ),
};

const volumeTarget = {
  chaptersMin: matchNumber(
    bookConfig,
    /volume_target:\s*(?:\r?\n)+\s*chapters_min:\s*(\d+)/,
    "卷目标最小章数",
  ),
  chaptersMax: matchNumber(
    bookConfig,
    /volume_target:\s*(?:\r?\n)+\s*chapters_min:\s*\d+\s*(?:\r?\n)+\s*chapters_max:\s*(\d+)/,
    "卷目标最大章数",
  ),
  charsMin: matchNumber(
    bookConfig,
    /volume_target:\s*(?:\r?\n)+\s*chapters_min:\s*\d+\s*(?:\r?\n)+\s*chapters_max:\s*\d+\s*(?:\r?\n)+\s*chars_min:\s*(\d+)/,
    "卷目标最小字数",
  ),
  charsMax: matchNumber(
    bookConfig,
    /volume_target:\s*(?:\r?\n)+\s*chapters_min:\s*\d+\s*(?:\r?\n)+\s*chapters_max:\s*\d+\s*(?:\r?\n)+\s*chars_min:\s*\d+\s*(?:\r?\n)+\s*chars_max:\s*(\d+)/,
    "卷目标最大字数",
  ),
};

const chapterFiles = fs
  .readdirSync(chapterDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
  .map((entry) => entry.name)
  .sort()
  .filter((name) => {
    const index = chapterIndex(name);
    if (index == null) return false;
    if (options.from != null && index < options.from) return false;
    if (options.to != null && index > options.to) return false;
    return true;
  });

if (chapterFiles.length === 0) {
  console.error("[writing:budget-check] 当前范围内没有找到正文文件。");
  process.exit(1);
}

const rows = chapterFiles.map((name) => {
  const raw = fs.readFileSync(path.join(chapterDir, name), "utf8");
  return {
    name,
    chars: stripWhitespace(raw).length,
  };
});

const totalChars = rows.reduce((sum, row) => sum + row.chars, 0);
const averageChars = totalChars / rows.length;
const projectedVolume = {
  min: Math.round(averageChars * volumeTarget.chaptersMin),
  max: Math.round(averageChars * volumeTarget.chaptersMax),
};
const requiredChapterCount = {
  min: Math.ceil(volumeTarget.charsMin / averageChars),
  max: Math.ceil(volumeTarget.charsMax / averageChars),
};

const chapterDrift =
  averageChars < chapterTarget.min || averageChars > chapterTarget.max;
const projectedTooSmall = projectedVolume.max < volumeTarget.charsMin;
const projectedTooLarge = projectedVolume.min > volumeTarget.charsMax;

console.log(`[writing:budget-check] 作品目录: ${path.relative(cwd, bookRoot)}`);
console.log(
  `[writing:budget-check] 当前范围: ${rows.length} 章 / ${totalChars} 字 / 平均每章 ${averageChars.toFixed(1)} 字`,
);
console.log(
  `[writing:budget-check] 规划要求: 单章 ${chapterTarget.min}-${chapterTarget.max} 字；卷 ${volumeTarget.chaptersMin}-${volumeTarget.chaptersMax} 章 / ${volumeTarget.charsMin}-${volumeTarget.charsMax} 字`,
);
console.log(
  `[writing:budget-check] 按当前章均推算: 卷总字数约 ${projectedVolume.min}-${projectedVolume.max} 字`,
);

if (!chapterDrift && !projectedTooSmall && !projectedTooLarge) {
  console.log("[writing:budget-check] OK：当前章均与整卷体量都在目标区间内。");
  process.exit(0);
}

console.error("[writing:budget-check] REPLAN REQUIRED：当前字数与卷规划不匹配。");

if (chapterDrift) {
  console.error(
    `- 当前平均每章 ${averageChars.toFixed(1)} 字，偏离单章目标 ${chapterTarget.min}-${chapterTarget.max} 字。`,
  );
}

if (projectedTooSmall || projectedTooLarge) {
  console.error(
    `- 按当前章均继续写，整卷只能落到 ${projectedVolume.min}-${projectedVolume.max} 字，不在卷目标 ${volumeTarget.charsMin}-${volumeTarget.charsMax} 字区间内。`,
  );
  console.error(
    `- 若保持当前章均不变，要达到卷目标，大约需要 ${requiredChapterCount.min}-${requiredChapterCount.max} 章。`,
  );
}

console.error("- 解决方向：");
console.error(`  1. 提高后续章节的有效事件量，把单章提升到至少 ${chapterTarget.min} 字以上`);
console.error(
  `  2. 如果不提高章均，就必须把整卷章数重算到 ${requiredChapterCount.min}-${requiredChapterCount.max} 章再继续写`,
);

process.exit(1);
