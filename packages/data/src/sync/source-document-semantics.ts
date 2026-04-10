import { createHash } from "node:crypto";

import type { SourceDocumentAnalysis } from "./document-analysis";
import { getAifictionPluginRegistry } from "../plugins/registry";
import type { AifictionPlugin, SourceDocumentSemanticExtractorRegistration } from "../plugins/types";

export type SemanticConfidenceLevel = "low" | "medium";

export interface RegisteredDocumentSemanticInput {
  relativePath: string;
  documentKind: string;
  templateKey?: string;
  scope?: string;
  textContent: string;
  analysis: SourceDocumentAnalysis;
}

export interface ExtractedSemanticEdge {
  targetSemanticKey: string;
  edgeType: string;
  publicLabel: string;
  directionality?: string;
  weight?: number;
}

export interface ExtractedSemanticEntity {
  semanticKey: string;
  entityType: string;
  semanticGroup: string;
  displayName: string;
  canonicalName: string;
  summary: string;
  sectionTitle?: string;
  sectionLevel?: number;
  confidenceLevel: SemanticConfidenceLevel;
  extractionMode: "template" | "fallback";
  evidenceExcerpt?: string;
  listItems?: string[];
  keywords?: string[];
  edges?: ExtractedSemanticEdge[];
}

export interface SourceDocumentSemanticExtraction {
  extractorKey: string;
  entities: ExtractedSemanticEntity[];
  reviewHints: string[];
}

interface SourceDocumentSemanticDraftExtraction {
  extractorKey: string;
  entities: SemanticEntityDraft[];
  reviewHints: string[];
}

interface MarkdownSection {
  level: number;
  title: string;
  normalizedTitle: string;
  body: string;
  listItems: string[];
  lineCount: number;
  order: number;
}

interface SemanticEntityDraft {
  semanticKey: string;
  entityType: string;
  semanticGroup: string;
  displayName: string;
  summary: string;
  sectionTitle?: string;
  sectionLevel?: number;
  confidenceLevel?: SemanticConfidenceLevel;
  extractionMode?: "template" | "fallback";
  evidenceExcerpt?: string;
  listItems?: string[];
  keywords?: string[];
  edges?: ExtractedSemanticEdge[];
}

type SemanticExtractor = (
  input: RegisteredDocumentSemanticInput,
  sections: MarkdownSection[],
) => SourceDocumentSemanticDraftExtraction;

export function extractRegisteredSourceDocumentSemantics(
  input: RegisteredDocumentSemanticInput,
): SourceDocumentSemanticExtraction {
  const sections = parseMarkdownSections(input.textContent);
  const extractorKey = input.templateKey?.trim() || input.documentKind;
  const extractor = getAifictionPluginRegistry()
    .getSourceDocumentSemanticExtractor<
      RegisteredDocumentSemanticInput,
      MarkdownSection[],
      SourceDocumentSemanticDraftExtraction
    >(extractorKey)?.extractor;
  let extraction = buildFallbackSemanticExtraction(input, sections, extractorKey);
  if (extractor) {
    try {
      extraction = extractor(input, sections);
    } catch {
      extraction = buildFallbackSemanticExtraction(input, sections, extractorKey);
    }
  }

  if (extraction.entities.length) {
    return {
      ...extraction,
      extractorKey,
      entities: finalizeEntities(input, extraction.entities),
    };
  }

  return {
    extractorKey,
    reviewHints: [`No semantic entities were extracted for ${extractorKey}; fallback root entity was created.`],
    entities: finalizeEntities(input, [
      buildRootEntity({
        semanticKey: "root",
        entityType: "document-semantic-root",
        semanticGroup: "document",
        displayName: input.analysis.title,
        summary: input.analysis.summary,
      }),
    ]),
  };
}

function extractProjectBriefSemantics(
  input: RegisteredDocumentSemanticInput,
  sections: MarkdownSection[],
): SourceDocumentSemanticDraftExtraction {
  const entities: SemanticEntityDraft[] = [];
  const reviewHints: string[] = [];

  pushUniqueEntity(
    entities,
    buildRootEntity({
      semanticKey: "root",
      entityType: "story-vision",
      semanticGroup: "project",
      displayName: input.analysis.title,
      summary: input.analysis.summary,
      edges: [
        edgeTo("premise", "defines", "defines"),
        edgeTo("protagonist-role", "defines", "defines"),
        edgeTo("organization-role", "defines", "defines"),
        edgeTo("experience-pillars", "defines", "defines"),
        edgeTo("story-drivers", "defines", "defines"),
        edgeTo("scale-interpretation", "defines", "defines"),
        edgeTo("endgame-goal", "targets", "targets"),
        edgeTo("tone-profile", "frames", "frames"),
        edgeTo("narrative-boundaries", "constrains", "constrains"),
      ],
    }),
  );

  pushMappedSectionEntity(entities, sections, {
    semanticKey: "premise",
    entityType: "story-premise",
    semanticGroup: "premise",
    displayName: "一句话定义",
    matchers: ["一句话定义"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "protagonist-role",
    entityType: "protagonist-role",
    semanticGroup: "character",
    displayName: "主角定位",
    matchers: ["主角定位"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "organization-role",
    entityType: "organization-vision",
    semanticGroup: "organization",
    displayName: "组织定位",
    matchers: ["组织定位"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "experience-pillars",
    entityType: "experience-pillars",
    semanticGroup: "experience",
    displayName: "核心体验",
    matchers: ["核心体验"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "story-drivers",
    entityType: "story-driver-framework",
    semanticGroup: "plot",
    displayName: "主要驱动力",
    matchers: ["主要驱动力"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "scale-interpretation",
    entityType: "organization-scale-interpretation",
    semanticGroup: "organization",
    displayName: "大型组织的正确理解",
    matchers: ["大型组织的正确理解"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "endgame-goal",
    entityType: "long-term-goal",
    semanticGroup: "goal",
    displayName: "最终目标",
    matchers: ["最终目标"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "tone-profile",
    entityType: "tone-profile",
    semanticGroup: "experience",
    displayName: "作品味道",
    matchers: ["这本书的味道", "味道"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "narrative-boundaries",
    entityType: "narrative-boundary",
    semanticGroup: "boundary",
    displayName: "创作边界",
    matchers: ["绝不能再跑偏", "边界"],
  });

  if (entities.length <= 1) {
    reviewHints.push("Project brief semantic extraction only produced the root entity.");
  }

  return { extractorKey: "project-brief", entities, reviewHints };
}

function extractWorldSettingSemantics(
  input: RegisteredDocumentSemanticInput,
  sections: MarkdownSection[],
): SourceDocumentSemanticDraftExtraction {
  const entities: SemanticEntityDraft[] = [];
  const reviewHints: string[] = [];

  pushUniqueEntity(
    entities,
    buildRootEntity({
      semanticKey: "root",
      entityType: "world-blueprint",
      semanticGroup: "world",
      displayName: input.analysis.title,
      summary: input.analysis.summary,
      edges: [
        edgeTo("world-overview", "defines", "defines"),
        edgeTo("world-structure", "defines", "defines"),
        edgeTo("world-consciousness", "defines", "defines"),
        edgeTo("contamination-model", "defines", "defines"),
        edgeTo("central-system-model", "defines", "defines"),
        edgeTo("energy-economy", "defines", "defines"),
        edgeTo("recruitment-model", "defines", "defines"),
        edgeTo("organization-framework", "defines", "defines"),
        edgeTo("internal-society-model", "defines", "defines"),
        edgeTo("anchor-principles", "defines", "defines"),
        edgeTo("task-system", "defines", "defines"),
        edgeTo("cognition-filter", "defines", "defines"),
        edgeTo("support-protocol", "defines", "defines"),
        edgeTo("external-force-map", "defines", "defines"),
        edgeTo("endgame-goal", "targets", "targets"),
        edgeTo("story-driver-framework", "drives", "drives"),
        edgeTo("world-boundaries", "constrains", "constrains"),
      ],
    }),
  );

  pushMappedSectionEntity(entities, sections, {
    semanticKey: "world-overview",
    entityType: "world-overview",
    semanticGroup: "world",
    displayName: "世界总述",
    matchers: ["世界总述"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "world-structure",
    entityType: "world-structure",
    semanticGroup: "world",
    displayName: "世界结构",
    matchers: ["世界结构"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "world-consciousness",
    entityType: "world-consciousness",
    semanticGroup: "world",
    displayName: "世界意识",
    matchers: ["世界意识"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "contamination-model",
    entityType: "contamination-model",
    semanticGroup: "mechanism",
    displayName: "外神、污染与眷属",
    matchers: ["外神", "污染", "眷属"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "central-system-model",
    entityType: "central-system-model",
    semanticGroup: "system",
    displayName: "主角与主神空间",
    matchers: ["主角与主神空间"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "energy-economy",
    entityType: "energy-economy",
    semanticGroup: "economy",
    displayName: "双轨制能源经济",
    matchers: ["双轨制能源经济"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "recruitment-model",
    entityType: "recruitment-model",
    semanticGroup: "organization",
    displayName: "招募机制",
    matchers: ["招募机制"],
  });
  const organizationFramework = pushMappedSectionEntity(entities, sections, {
    semanticKey: "organization-framework",
    entityType: "organization-framework",
    semanticGroup: "organization",
    displayName: "组织体系",
    matchers: ["组织体系"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "internal-society-model",
    entityType: "internal-society-model",
    semanticGroup: "organization",
    displayName: "组织生态与内部交易",
    matchers: ["组织生态", "内部交易"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "anchor-principles",
    entityType: "anchor-principles",
    semanticGroup: "character",
    displayName: "角色锚点原则",
    matchers: ["角色锚点原则"],
  });
  const taskSystem = pushMappedSectionEntity(entities, sections, {
    semanticKey: "task-system",
    entityType: "task-system",
    semanticGroup: "mechanism",
    displayName: "任务系统",
    matchers: ["任务系统"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "cognition-filter",
    entityType: "cognition-filter",
    semanticGroup: "mechanism",
    displayName: "理智屏障与认知滤镜",
    matchers: ["理智屏障", "认知滤镜"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "support-protocol",
    entityType: "support-protocol",
    semanticGroup: "mechanism",
    displayName: "AI 与战斗支援",
    matchers: ["AI", "战斗支援"],
  });
  const externalForceMap = pushMappedSectionEntity(entities, sections, {
    semanticKey: "external-force-map",
    entityType: "external-force-map",
    semanticGroup: "faction",
    displayName: "本土势力",
    matchers: ["本土势力"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "endgame-goal",
    entityType: "long-term-goal",
    semanticGroup: "goal",
    displayName: "最终目标",
    matchers: ["最终目标"],
  });
  const driverFramework = pushMappedSectionEntity(entities, sections, {
    semanticKey: "story-driver-framework",
    entityType: "story-driver-framework",
    semanticGroup: "plot",
    displayName: "故事真正的推进线",
    matchers: ["推进线", "故事真正"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "world-boundaries",
    entityType: "narrative-boundary",
    semanticGroup: "boundary",
    displayName: "当前版本的硬边界",
    matchers: ["硬边界"],
  });

  if (organizationFramework) {
    addListChildren(entities, organizationFramework, {
      itemType: "organization-function",
      semanticGroup: "department",
      edgeType: "has_function",
      publicLabel: "has function",
      allowShortItems: true,
    });
  }
  if (taskSystem) {
    addListChildren(entities, taskSystem, {
      itemType: "task-type",
      semanticGroup: "task",
      edgeType: "has_task_type",
      publicLabel: "has task type",
      allowShortItems: true,
    });
  }
  if (externalForceMap) {
    addSubsectionChildren(entities, sections, externalForceMap, {
      subsectionKeys: ["官方异常处理体系", "财阀与企业势力", "黑市与地下中介", "邪教与异端团体"],
      itemType: "external-force",
      semanticGroup: "faction",
      edgeType: "maps_force",
      publicLabel: "maps force",
    });
  }
  if (driverFramework) {
    addListChildren(entities, driverFramework, {
      itemType: "story-driver",
      semanticGroup: "plot",
      edgeType: "contains_driver",
      publicLabel: "contains driver",
      allowShortItems: false,
    });
  }

  if (entities.length <= 1) {
    reviewHints.push("World setting semantic extraction only produced the root entity.");
  }

  return { extractorKey: "world-setting", entities, reviewHints };
}

function extractOrganizationEcologySemantics(
  input: RegisteredDocumentSemanticInput,
  sections: MarkdownSection[],
): SourceDocumentSemanticDraftExtraction {
  const entities: SemanticEntityDraft[] = [];
  const reviewHints: string[] = [];

  pushUniqueEntity(
    entities,
    buildRootEntity({
      semanticKey: "root",
      entityType: "organization-ecology",
      semanticGroup: "organization",
      displayName: input.analysis.title,
      summary: input.analysis.summary,
      edges: [
        edgeTo("ecology-definition", "defines", "defines"),
        edgeTo("operation-logic", "defines", "defines"),
        edgeTo("personnel-structure", "defines", "defines"),
        edgeTo("internal-economy", "defines", "defines"),
        edgeTo("gray-rules", "defines", "defines"),
        edgeTo("retention-model", "defines", "defines"),
        edgeTo("team-ecology", "defines", "defines"),
        edgeTo("research-framework", "defines", "defines"),
        edgeTo("anchor-framework", "defines", "defines"),
        edgeTo("final-direction", "targets", "targets"),
      ],
    }),
  );

  pushMappedSectionEntity(entities, sections, {
    semanticKey: "ecology-definition",
    entityType: "organization-definition",
    semanticGroup: "organization",
    displayName: "生态总定义",
    matchers: ["生态总定义"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "operation-logic",
    entityType: "operation-logic",
    semanticGroup: "mechanism",
    displayName: "组织的三层运转逻辑",
    matchers: ["三层运转逻辑"],
  });
  const personnelStructure = pushMappedSectionEntity(entities, sections, {
    semanticKey: "personnel-structure",
    entityType: "personnel-structure",
    semanticGroup: "structure",
    displayName: "人员层级",
    matchers: ["人员层级"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "internal-economy",
    entityType: "internal-economy",
    semanticGroup: "economy",
    displayName: "内部交易体系",
    matchers: ["内部交易体系"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "gray-rules",
    entityType: "gray-rules",
    semanticGroup: "rule",
    displayName: "信用与灰规则",
    matchers: ["信用与灰规则"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "retention-model",
    entityType: "retention-model",
    semanticGroup: "organization",
    displayName: "为什么人会留下",
    matchers: ["为什么人会留下"],
  });
  const teamEcology = pushMappedSectionEntity(entities, sections, {
    semanticKey: "team-ecology",
    entityType: "team-ecology",
    semanticGroup: "team",
    displayName: "小队与项目生态",
    matchers: ["小队与项目生态"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "research-framework",
    entityType: "research-framework",
    semanticGroup: "research",
    displayName: "科研与解析为什么必须存在",
    matchers: ["科研与解析"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "anchor-framework",
    entityType: "anchor-framework",
    semanticGroup: "character",
    displayName: "核心员工的组织锚点",
    matchers: ["组织锚点"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "final-direction",
    entityType: "long-term-goal",
    semanticGroup: "goal",
    displayName: "最终方向",
    matchers: ["最终方向"],
  });

  if (personnelStructure) {
    addSubsectionChildren(entities, sections, personnelStructure, {
      subsectionKeys: ["中枢层", "核心层", "执行层", "支撑层", "外围层"],
      itemType: "organization-layer",
      semanticGroup: "layer",
      edgeType: "has_layer",
      publicLabel: "has layer",
    });
  }

  if (teamEcology) {
    addListChildren(entities, teamEcology, {
      itemType: "team-archetype",
      semanticGroup: "team",
      edgeType: "has_team_shape",
      publicLabel: "has team shape",
      allowShortItems: true,
    });
  }

  if (entities.length <= 1) {
    reviewHints.push("Organization ecology semantic extraction only produced the root entity.");
  }

  return { extractorKey: "organization-ecology", entities, reviewHints };
}

function extractCharacterSettingSemantics(
  input: RegisteredDocumentSemanticInput,
  sections: MarkdownSection[],
): SourceDocumentSemanticDraftExtraction {
  const entities: SemanticEntityDraft[] = [];
  const reviewHints: string[] = [];

  pushUniqueEntity(
    entities,
    buildRootEntity({
      semanticKey: "root",
      entityType: "character-framework",
      semanticGroup: "character",
      displayName: input.analysis.title,
      summary: input.analysis.summary,
      edges: [
        edgeTo("protagonist", "defines", "defines"),
        edgeTo("employee-chen-mo", "defines", "defines"),
        edgeTo("support-avatar-protocol", "defines", "defines"),
        edgeTo("character-design-rules", "defines", "defines"),
      ],
    }),
  );
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "protagonist",
    entityType: "character",
    semanticGroup: "character",
    displayName: "主角",
    matchers: ["主角"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "employee-chen-mo",
    entityType: "character",
    semanticGroup: "character",
    displayName: "陈默",
    matchers: ["陈默", "一号员工"],
  });
  pushMappedSectionEntity(entities, sections, {
    semanticKey: "support-avatar-protocol",
    entityType: "support-avatar-protocol",
    semanticGroup: "protocol",
    displayName: "协同支援马甲原则",
    matchers: ["协同支援马甲原则"],
  });
  const characterRules = pushMappedSectionEntity(entities, sections, {
    semanticKey: "character-design-rules",
    entityType: "character-design-rules",
    semanticGroup: "rule",
    displayName: "后续角色设计硬规则",
    matchers: ["后续角色设计硬规则"],
  });

  if (characterRules) {
    addSubsectionChildren(entities, sections, characterRules, {
      subsectionKeys: ["必须有三类锚点", "必须有清晰功能", "必须能嵌入组织"],
      itemType: "character-rule",
      semanticGroup: "rule",
      edgeType: "contains_rule",
      publicLabel: "contains rule",
    });
  }

  if (entities.length <= 1) {
    reviewHints.push("Character setting semantic extraction only produced the root entity.");
  }

  return { extractorKey: "character-setting", entities, reviewHints };
}

function buildFallbackSemanticExtraction(
  input: RegisteredDocumentSemanticInput,
  sections: MarkdownSection[],
  extractorKey: string,
): SourceDocumentSemanticDraftExtraction {
  const entities: SemanticEntityDraft[] = [
    buildRootEntity({
      semanticKey: "root",
      entityType: "document-semantic-root",
      semanticGroup: "document",
      displayName: input.analysis.title,
      summary: input.analysis.summary,
    }),
  ];

  for (const section of sections.filter((item) => item.level <= 2).slice(0, 8)) {
    pushUniqueEntity(entities, {
      semanticKey: `section-${section.order}`,
      entityType: "document-section",
      semanticGroup: "section",
      displayName: section.normalizedTitle || section.title,
      summary: summarizeSection(section),
      sectionTitle: section.title,
      sectionLevel: section.level,
      confidenceLevel: "low",
      extractionMode: "fallback",
      evidenceExcerpt: buildEvidenceExcerpt(section),
      listItems: section.listItems,
      keywords: buildKeywords(section),
    });
    appendEdge(entities, "root", edgeTo(`section-${section.order}`, "contains_section", "contains section"));
  }

  return {
    extractorKey,
    entities,
    reviewHints: [`Template ${extractorKey} is not registered for semantic extraction, so generic section fallback was used.`],
  };
}

function finalizeEntities(
  input: RegisteredDocumentSemanticInput,
  entities: SemanticEntityDraft[],
): ExtractedSemanticEntity[] {
  const seenSemanticKeys = new Set<string>();
  const finalized: ExtractedSemanticEntity[] = [];

  for (const entity of entities) {
    if (seenSemanticKeys.has(entity.semanticKey)) {
      continue;
    }
    seenSemanticKeys.add(entity.semanticKey);

    finalized.push({
      semanticKey: entity.semanticKey,
      entityType: entity.entityType,
      semanticGroup: entity.semanticGroup,
      displayName: entity.displayName,
      canonicalName: buildCanonicalName(input.relativePath, entity.semanticKey, entity.displayName),
      summary: entity.summary,
      sectionTitle: entity.sectionTitle,
      sectionLevel: entity.sectionLevel,
      confidenceLevel: entity.confidenceLevel ?? "medium",
      extractionMode: entity.extractionMode ?? "template",
      evidenceExcerpt: entity.evidenceExcerpt,
      listItems: entity.listItems?.slice(0, 12),
      keywords: entity.keywords?.slice(0, 10),
      edges: dedupeEdges(entity.edges ?? []),
    });
  }

  return finalized;
}

function parseMarkdownSections(text: string): MarkdownSection[] {
  const normalizedText = text.replace(/\r\n/g, "\n").trim();
  const lines = normalizedText.split("\n");
  const sections: MarkdownSection[] = [];
  let current:
    | {
        level: number;
        title: string;
        normalizedTitle: string;
        lines: string[];
        order: number;
      }
    | undefined;

  const flushCurrent = () => {
    if (!current) {
      return;
    }
    const bodyLines = current.lines.map((line) => line.trim()).filter(Boolean);
    const listItems = bodyLines
      .map((line) => extractListItem(line))
      .filter((item): item is string => Boolean(item));

    sections.push({
      level: current.level,
      title: current.title,
      normalizedTitle: current.normalizedTitle,
      body: bodyLines.join("\n"),
      listItems,
      lineCount: bodyLines.length,
      order: current.order,
    });
  };

  let order = 0;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      flushCurrent();
      order += 1;
      current = {
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        normalizedTitle: normalizeHeadingTitle(headingMatch[2]),
        lines: [],
        order,
      };
      continue;
    }

    if (!current) {
      order += 1;
      current = {
        level: 0,
        title: "Document Body",
        normalizedTitle: "Document Body",
        lines: [],
        order,
      };
    }
    current.lines.push(line);
  }

  flushCurrent();
  return sections;
}

function pushMappedSectionEntity(
  entities: SemanticEntityDraft[],
  sections: MarkdownSection[],
  input: {
    semanticKey: string;
    entityType: string;
    semanticGroup: string;
    displayName: string;
    matchers: string[];
  },
): MarkdownSection | undefined {
  const section = findSection(sections, input.matchers);
  if (!section) {
    return undefined;
  }

  pushUniqueEntity(entities, {
    semanticKey: input.semanticKey,
    entityType: input.entityType,
    semanticGroup: input.semanticGroup,
    displayName: input.displayName,
    summary: summarizeSection(section),
    sectionTitle: section.title,
    sectionLevel: section.level,
    evidenceExcerpt: buildEvidenceExcerpt(section),
    listItems: section.listItems,
    keywords: buildKeywords(section),
  });

  return section;
}

function addSubsectionChildren(
  entities: SemanticEntityDraft[],
  sections: MarkdownSection[],
  parentSection: MarkdownSection,
  input: {
    subsectionKeys: string[];
    itemType: string;
    semanticGroup: string;
    edgeType: string;
    publicLabel: string;
  },
) {
  for (const subsectionKey of input.subsectionKeys) {
    const section = findSection(sections, [subsectionKey]);
    if (!section || section.level <= parentSection.level) {
      continue;
    }

    const semanticKey = `${parentSection.level}-${parentSection.order}-${hashFragment(subsectionKey)}`;
    pushUniqueEntity(entities, {
      semanticKey,
      entityType: input.itemType,
      semanticGroup: input.semanticGroup,
      displayName: section.normalizedTitle || subsectionKey,
      summary: summarizeSection(section),
      sectionTitle: section.title,
      sectionLevel: section.level,
      evidenceExcerpt: buildEvidenceExcerpt(section),
      listItems: section.listItems,
      keywords: buildKeywords(section),
    });
    appendEdge(entities, parentSectionToSemanticKey(parentSection, entities), edgeTo(semanticKey, input.edgeType, input.publicLabel));
  }
}

function addListChildren(
  entities: SemanticEntityDraft[],
  parentSection: MarkdownSection,
  input: {
    itemType: string;
    semanticGroup: string;
    edgeType: string;
    publicLabel: string;
    allowShortItems: boolean;
  },
) {
  const parentSemanticKey = parentSectionToSemanticKey(parentSection, entities);
  const parsedItems = parentSection.listItems
    .map((item) => parseListItem(item))
    .filter((item) => input.allowShortItems || item.summary.replace(/\s+/g, "").length >= 8)
    .slice(0, 12);

  for (let index = 0; index < parsedItems.length; index += 1) {
    const item = parsedItems[index];
    const semanticKey = `${parentSemanticKey}-item-${index + 1}`;
    pushUniqueEntity(entities, {
      semanticKey,
      entityType: input.itemType,
      semanticGroup: input.semanticGroup,
      displayName: item.title,
      summary: item.summary,
      evidenceExcerpt: item.summary,
      listItems: [item.raw],
      keywords: [item.title],
    });
    appendEdge(entities, parentSemanticKey, edgeTo(semanticKey, input.edgeType, input.publicLabel));
  }
}

function parentSectionToSemanticKey(parentSection: MarkdownSection, entities: SemanticEntityDraft[]): string {
  const match = entities.find(
    (entity) =>
      entity.sectionTitle === parentSection.title &&
      entity.sectionLevel === parentSection.level &&
      entity.extractionMode !== "fallback",
  );
  return match?.semanticKey ?? `section-${parentSection.order}`;
}

function findSection(sections: MarkdownSection[], matchers: string[]): MarkdownSection | undefined {
  return sections.find((section) => matchers.some((matcher) => section.normalizedTitle.includes(matcher)));
}

function pushUniqueEntity(entities: SemanticEntityDraft[], entity: SemanticEntityDraft) {
  const existingIndex = entities.findIndex((item) => item.semanticKey === entity.semanticKey);
  if (existingIndex >= 0) {
    entities[existingIndex] = mergeEntityDrafts(entities[existingIndex], entity);
    return;
  }
  entities.push(entity);
}

function mergeEntityDrafts(left: SemanticEntityDraft, right: SemanticEntityDraft): SemanticEntityDraft {
  return {
    ...left,
    ...right,
    edges: dedupeEdges([...(left.edges ?? []), ...(right.edges ?? [])]),
    listItems: dedupeStrings([...(left.listItems ?? []), ...(right.listItems ?? [])]),
    keywords: dedupeStrings([...(left.keywords ?? []), ...(right.keywords ?? [])]),
  };
}

function appendEdge(entities: SemanticEntityDraft[], sourceSemanticKey: string, edge: ExtractedSemanticEdge) {
  const entity = entities.find((item) => item.semanticKey === sourceSemanticKey);
  if (!entity) {
    return;
  }
  entity.edges = dedupeEdges([...(entity.edges ?? []), edge]);
}

function buildRootEntity(input: {
  semanticKey: string;
  entityType: string;
  semanticGroup: string;
  displayName: string;
  summary: string;
  edges?: ExtractedSemanticEdge[];
}): SemanticEntityDraft {
  return {
    semanticKey: input.semanticKey,
    entityType: input.entityType,
    semanticGroup: input.semanticGroup,
    displayName: input.displayName,
    summary: input.summary,
    confidenceLevel: "medium",
    extractionMode: "template",
    keywords: [input.displayName],
    edges: input.edges ?? [],
  };
}

function buildCanonicalName(relativePath: string, semanticKey: string, displayName: string): string {
  const digest = createHash("sha1")
    .update(`${relativePath}:${semanticKey}:${displayName}`)
    .digest("hex")
    .slice(0, 12);
  return `semantic-${semanticKey}-${digest}`;
}

function normalizeHeadingTitle(title: string): string {
  return title
    .replace(/\*\*/g, "")
    .replace(/^[一二三四五六七八九十百零]+[、.．]\s*/u, "")
    .replace(/^\d+[、.．]\s*/u, "")
    .trim();
}

function extractListItem(line: string): string | undefined {
  const match = line.match(/^\s*(?:[-*+]|(?:\d+[.、]))\s+(.+?)\s*$/);
  if (!match) {
    return undefined;
  }
  return match[1].replace(/\*\*/g, "").trim();
}

function parseListItem(raw: string): { raw: string; title: string; summary: string } {
  const normalized = raw.replace(/\*\*/g, "").trim();
  const parts = normalized.split(/[：:]/, 2).map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      raw,
      title: parts[0],
      summary: parts[1],
    };
  }

  return {
    raw,
    title: normalized.length <= 16 ? normalized : normalized.slice(0, 16),
    summary: normalized,
  };
}

function summarizeSection(section: MarkdownSection): string {
  const candidate = section.body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("-") && !/^\d+[.、]/.test(line));

  if (candidate) {
    return clampText(candidate);
  }

  if (section.listItems[0]) {
    return clampText(section.listItems.join("；"));
  }

  return clampText(section.title);
}

function buildEvidenceExcerpt(section: MarkdownSection): string {
  if (!section.body) {
    return section.title;
  }
  return clampText(section.body.replace(/\n+/g, " "));
}

function buildKeywords(section: MarkdownSection): string[] {
  return dedupeStrings([
    section.normalizedTitle,
    ...section.listItems.map((item) => parseListItem(item).title),
  ]).slice(0, 8);
}

function clampText(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 3)}...`;
}

function edgeTo(
  targetSemanticKey: string,
  edgeType: string,
  publicLabel: string,
  directionality = "directed",
  weight = 100,
): ExtractedSemanticEdge {
  return {
    targetSemanticKey,
    edgeType,
    publicLabel,
    directionality,
    weight,
  };
}

function hashFragment(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function dedupeEdges(edges: ExtractedSemanticEdge[]): ExtractedSemanticEdge[] {
  const seen = new Set<string>();
  const output: ExtractedSemanticEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.targetSemanticKey}:${edge.edgeType}:${edge.publicLabel}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(edge);
  }
  return output;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

const builtinSourceDocumentSemanticExtractors: SourceDocumentSemanticExtractorRegistration<
  RegisteredDocumentSemanticInput,
  MarkdownSection[],
  SourceDocumentSemanticDraftExtraction
>[] = [
  {
    extractorKey: "project-brief",
    supportedDocKinds: ["project-brief"],
    supportedTemplateKeys: ["project-brief"],
    extractor: extractProjectBriefSemantics,
  },
  {
    extractorKey: "world-setting",
    supportedDocKinds: ["world-setting"],
    supportedTemplateKeys: ["world-setting"],
    extractor: extractWorldSettingSemantics,
  },
  {
    extractorKey: "organization-ecology",
    supportedDocKinds: ["organization-setting"],
    supportedTemplateKeys: ["organization-ecology"],
    extractor: extractOrganizationEcologySemantics,
  },
  {
    extractorKey: "character-setting",
    supportedDocKinds: ["character-setting"],
    supportedTemplateKeys: ["character-setting"],
    extractor: extractCharacterSettingSemantics,
  },
];

export const builtinSourceDocumentSemanticsPlugin: AifictionPlugin = {
  manifest: {
    pluginId: "builtin.source-document-semantics",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Builtin Source Document Semantics",
    description: "Registers the default semantic extractors for source-of-truth documents.",
    builtin: true,
    requiresPlugins: ["builtin.source-document-definitions"],
    capabilityKinds: ["source-document-semantic-extractor"],
  },
  sourceDocumentSemanticExtractors: builtinSourceDocumentSemanticExtractors,
};
