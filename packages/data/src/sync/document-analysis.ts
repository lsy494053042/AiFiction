import path from "node:path";

export interface SourceDocumentAnalysis {
  title: string;
  summary: string;
  headingTrail: string[];
  candidateNames: string[];
  paragraphCount: number;
  lineCount: number;
  characterCount: number;
  confidenceLevel: "low" | "medium";
  reviewHints: string[];
}

export interface LoadedSourceDocumentText {
  textContent?: string;
  originalFormat?: string;
  unsupportedReason?: string;
}

const bannedTokens = new Set([
  "他们",
  "我们",
  "你们",
  "自己",
  "不是",
  "如果",
  "因为",
  "然后",
  "已经",
  "没有",
  "可以",
  "这个",
  "那个",
  "一个",
  "一种",
  "时候",
  "地方",
  "事情",
  "问题",
  "里面",
  "外面",
  "之前",
  "之后",
  "今天",
  "明天",
]);

const commonChineseSurnames = new Set(
  "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫房解应宗丁宣邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊惠甄曲家封储靳焦牧山蔡田樊胡霍宁仇栾甘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴郁胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公仉督岳帅缑亢况后有琴归海南宫令狐皇甫诸葛上官司徒司空夏侯东方独孤".split(""),
);

/**
 * 读取可直接分析的文本内容。
 * 当前先支持 markdown / txt，docx 先进入待审查队列。
 */
export function loadSourceDocumentText(absolutePath: string, fileBuffer: Buffer): LoadedSourceDocumentText {
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension === ".md") {
    return {
      textContent: stripBom(fileBuffer.toString("utf8")),
      originalFormat: "text/markdown",
    };
  }

  if (extension === ".txt") {
    return {
      textContent: stripBom(fileBuffer.toString("utf8")),
      originalFormat: "text/plain",
    };
  }

  return {
    unsupportedReason: `Unsupported source format: ${extension || "unknown"}`,
  };
}

/**
 * 基于本地启发式规则生成“摘要 + 候选实体”预览。
 * 这层后续可以被真实模型抽取器替换，但输出结构尽量保持稳定。
 */
export function analyzeSourceDocumentText(input: {
  relativePath: string;
  documentKind: string;
  textContent: string;
}): SourceDocumentAnalysis {
  const normalizedText = normalizeText(input.textContent);
  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const lines = normalizedText
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const headingTrail = extractHeadingTrail(normalizedText);
  const title = extractTitle(input.relativePath, lines, headingTrail);
  const summary = buildSummary(paragraphs);
  const candidateNames = extractCandidateNames(normalizedText);
  const characterCount = normalizedText.replace(/\s+/g, "").length;
  const reviewHints: string[] = [];

  if (characterCount < 80) {
    reviewHints.push("Document is short, summary confidence is limited.");
  }
  if (!candidateNames.length && input.documentKind === "chapter") {
    reviewHints.push("No stable character candidates were detected yet.");
  }
  if (headingTrail.length > 3) {
    reviewHints.push("Document hierarchy is deep and may need finer-grained splitting.");
  }

  return {
    title,
    summary,
    headingTrail,
    candidateNames,
    paragraphCount: paragraphs.length,
    lineCount: lines.length,
    characterCount,
    confidenceLevel: reviewHints.length ? "low" : "medium",
    reviewHints,
  };
}

/**
 * 把分析结果格式化成统一的 Markdown 产物。
 * 后续就算切到模型摘要，也仍然可以沿用这份 artifact 结构。
 */
export function formatSourceSummaryArtifact(input: {
  relativePath: string;
  documentKind: string;
  analysis: SourceDocumentAnalysis;
}): string {
  const headings = input.analysis.headingTrail.length ? input.analysis.headingTrail.join(" > ") : "-";
  const candidateNames = input.analysis.candidateNames.length ? input.analysis.candidateNames.join(", ") : "-";
  const reviewHints = input.analysis.reviewHints.length
    ? input.analysis.reviewHints.map((item) => `- ${item}`).join("\n")
    : "- No obvious review warnings were detected.";

  return [
    "# Auto Summary Preview",
    "",
    `- File: ${input.relativePath}`,
    `- Kind: ${input.documentKind}`,
    `- Title: ${input.analysis.title}`,
    `- Summary: ${input.analysis.summary}`,
    `- Candidate Names: ${candidateNames}`,
    `- Headings: ${headings}`,
    `- Paragraphs: ${input.analysis.paragraphCount}`,
    `- Lines: ${input.analysis.lineCount}`,
    `- Characters: ${input.analysis.characterCount}`,
    `- Confidence: ${input.analysis.confidenceLevel}`,
    "",
    "## Review Hints",
    reviewHints,
  ].join("\n");
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
}

function extractHeadingTrail(text: string): string[] {
  const headingMatches = text.match(/^#{1,6}\s+.+$/gm) ?? [];
  return headingMatches.slice(0, 5).map((heading) => heading.replace(/^#{1,6}\s+/, "").trim());
}

function extractTitle(relativePath: string, lines: string[], headingTrail: string[]): string {
  if (headingTrail[0]) {
    return headingTrail[0];
  }

  if (lines[0]) {
    return lines[0].replace(/^#+\s*/, "").trim();
  }

  const baseName = path.basename(relativePath, path.extname(relativePath));
  return baseName || "Untitled document";
}

function buildSummary(paragraphs: string[]): string {
  const candidateParagraph = paragraphs.find((paragraph) => paragraph.replace(/\s+/g, "").length >= 30) ?? paragraphs[0] ?? "";
  const compact = candidateParagraph.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "No usable summary was extracted from this document.";
  }

  return compact.length <= 120 ? compact : `${compact.slice(0, 117)}...`;
}

function extractCandidateNames(text: string): string[] {
  const counts = new Map<string, number>();
  const boundaryMatches = text.matchAll(/(?<![\p{Script=Han}])([\p{Script=Han}]{2,4})(?![\p{Script=Han}])/gu);

  for (const match of boundaryMatches) {
    const token = match[1];
    if (!isLikelyNameCandidate(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const hanCharacters = [...text].filter((character) => /\p{Script=Han}/u.test(character));
  for (let index = 0; index < hanCharacters.length; index += 1) {
    for (const length of [2, 3]) {
      const token = hanCharacters.slice(index, index + length).join("");
      if (!isLikelyChinesePersonName(token)) {
        continue;
      }
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([name, count]) => isLikelyNameCandidate(name) && count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .slice(0, 5)
    .map(([name]) => name);
}

function isLikelyNameCandidate(token: string): boolean {
  if (!token || bannedTokens.has(token)) {
    return false;
  }

  if (/^[第一二三四五六七八九十百千万上下左右前后中大小新旧远近轻重长短高低冷热真假黑白红蓝金银春夏秋冬风雨雷雪云火山水海天门路街巷楼城院库灯夜晨午晚朝暮的了在是]/u.test(token) && token.length <= 2) {
    return false;
  }

  if (/^[\u7b2c\u4e00-\u9fa5]*[的了在是]$/u.test(token)) {
    return false;
  }

  return token.length >= 2 && token.length <= 4;
}

function isLikelyChinesePersonName(token: string): boolean {
  if (!token || token.length < 2 || token.length > 3) {
    return false;
  }

  const [surname] = [...token];
  if (!commonChineseSurnames.has(surname)) {
    return false;
  }

  if (bannedTokens.has(token)) {
    return false;
  }

  return [...token].every((character) => /\p{Script=Han}/u.test(character));
}