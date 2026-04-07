import { randomUUID } from "node:crypto";

import type { DraftArtifact, WorkProfile } from "@aifiction/schemas";

import { getSqliteClient } from "./client";
import {
  SqliteArtifactRepository,
  SqliteGenericEntityRepository,
  SqliteMemorySnapshotRepository,
  SqliteNarrativeAssetRepository,
  SqlitePipelineRunRepository,
  SqliteProjectCatalogRepository,
  SqlitePromptRegistryRepository,
} from "./repositories/v2";
import { ensureSqliteV2Bootstrap } from "./v2/bootstrap";
import { GenericEntityWorkbenchService } from "./workbench";

async function main() {
  const client = getSqliteClient();
  const databasePath = await ensureSqliteV2Bootstrap(client);

  const projectRepository = new SqliteProjectCatalogRepository(client);
  const genericEntityRepository = new SqliteGenericEntityRepository(client);
  const narrativeRepository = new SqliteNarrativeAssetRepository(client);
  const snapshotRepository = new SqliteMemorySnapshotRepository(client);
  const artifactRepository = new SqliteArtifactRepository(client);
  const pipelineRunRepository = new SqlitePipelineRunRepository(client);
  const promptRegistryRepository = new SqlitePromptRegistryRepository(client);
  const genericEntityWorkbenchService = new GenericEntityWorkbenchService(client);

  const work: WorkProfile = {
    id: "demo-work-v2",
    slug: "demo-work-v2",
    title: "长夜取火",
    tagline: "一个边境小人物在灾变时代偷来火种，逐步改写秩序。",
    genre: "玄幻",
    subgenre: "群像成长",
    targetPlatform: "起点中文网",
    targetAudience: ["男频", "成长流", "群像"],
    targetWordCount: 2200000,
    dailyWordTarget: 6000,
    updateCadence: "日更",
    commercialHooks: ["火种体系", "边境升级", "势力博弈"],
    hardConstraints: ["火种代价必须真实存在", "主角不能无代价跨阶"],
    contentWarnings: ["黑暗世界观", "战争描写"],
    status: "planning",
  };

  await projectRepository.saveProject(work, {
    source: "v2-smoke",
    reason: "验证 V2 项目目录仓储",
  });

  await narrativeRepository.saveCharacter(
    {
      id: "character-v2-mentor",
      workId: work.id,
      name: "沈烬",
      role: "导师",
      archetype: "灰烬守灯人",
      publicIdentity: "镇上放债人",
      hiddenIdentity: "旧火种谱系的残存引导者",
      coreDesire: "在火种彻底熄灭前找到真正能继火的人",
      coreFear: "把最后的火押错人",
      strengths: ["洞察力强", "擅长隐藏立场"],
      flaws: ["过度试探他人", "不肯轻易信任"],
      secrets: ["他一直在秘密观察主角"],
      speechStyle: ["话里有保留", "喜欢让别人自己悟"],
      growthArc: "从冷眼筛选继承者到真正承担守灯责任",
      relationships: [],
    },
    {
      source: "v2-smoke",
    },
  );

  await narrativeRepository.saveCharacter(
    {
      id: "character-v2-hero",
      workId: work.id,
      name: "顾徊",
      role: "主角",
      archetype: "背火者",
      publicIdentity: "边境矿镇的运炭工",
      hiddenIdentity: "旧王朝火种谱系幸存者",
      coreDesire: "活下去并守住仅剩的家人",
      coreFear: "再次失去火与归属",
      strengths: ["耐性强", "对危险极敏感"],
      flaws: ["不信任权威", "习惯独自扛事"],
      secrets: ["体内埋有未觉醒的古火种"],
      speechStyle: ["说话短促", "极少主动解释"],
      growthArc: "从只求自保成长为主动点燃秩序的人",
      relationships: [],
    },
    {
      source: "v2-smoke",
    },
  );

  await genericEntityRepository.saveEntity(
    {
      id: "faction-v2-cinder-guild",
      projectId: work.id,
      entityType: "faction",
      canonicalName: "灰烬会",
      displayName: "灰烬会",
      summary: "边境火种和违禁物资交易的灰色中介组织。",
      extraJson: {
        publicPosition: "矿镇外围中介",
        hiddenPosition: "旧火线情报节点",
      },
    },
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.replaceEntityAliases(
    "faction-v2-cinder-guild",
    [
      {
        alias: "灰会",
        aliasType: "short-name",
        sortOrder: 1,
      },
    ],
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.replaceEntityEdges(
    work.id,
    "character-v2-hero",
    [
      {
        targetEntityId: "character-v2-mentor",
        edgeType: "character_relationship",
        publicLabel: "债主",
        privateLabel: "引路人",
        directionality: "directed",
        weight: 35,
        extraJson: {
          tensionLevel: 60,
          notes: ["互相提防，但目标暂时一致"],
        },
      },
      {
        targetEntityId: "faction-v2-cinder-guild",
        edgeType: "faction_attention",
        publicLabel: "被盯上",
        privateLabel: "继火观察对象",
        directionality: "directed",
        weight: 55,
        extraJson: {
          watchLevel: "medium",
        },
      },
    ],
    {
      source: "v2-smoke",
    },
  );

  await genericEntityRepository.savePanelTemplate(
    {
      id: "panel-template-v2-character-core",
      ownerKey: `project:${work.id}`,
      projectId: work.id,
      scope: "project",
      templateKey: "character-core",
      label: "角色核心面板",
      appliesToEntityType: "character",
      description: "用于验证通用面板模板、字段和值链路。",
    },
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.replacePanelFields(
    "panel-template-v2-character-core",
    [
      {
        fieldKey: "clearance_level",
        label: "权限等级",
        valueType: "integer",
        cardinality: "single",
        sortOrder: 1,
        displayGroup: "systems",
        isSearchable: true,
        isFilterable: true,
        isTimelineTracked: true,
      },
      {
        fieldKey: "ember_stability",
        label: "火种稳定度",
        valueType: "number",
        cardinality: "single",
        sortOrder: 2,
        displayGroup: "systems",
        isSearchable: true,
        isFilterable: true,
        isTimelineTracked: true,
      },
    ],
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.replaceEntityPanelValues(
    work.id,
    "character-v2-hero",
    "panel-template-v2-character-core",
    [
      {
        fieldId: "panel-template-v2-character-core:field:clearance_level",
        valueInteger: 2,
      },
      {
        fieldId: "panel-template-v2-character-core:field:ember_stability",
        valueNumber: 0.61,
      },
    ],
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.saveTagTaxonomy(
    {
      id: "taxonomy-v2-aptitude",
      ownerKey: `project:${work.id}`,
      projectId: work.id,
      scope: "project",
      taxonomyKey: "aptitude",
      label: "角色能力标签",
      description: "用于验证实体标签和分类能力。",
    },
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.replaceEntityTags(
    work.id,
    "character-v2-hero",
    "taxonomy-v2-aptitude",
    [
      {
        tagCode: "ember-affinity",
        tagLabel: "火种亲和",
        weight: 90,
      },
      {
        tagCode: "risk-sense",
        tagLabel: "危险感知",
        weight: 78,
      },
    ],
    {
      source: "v2-smoke",
    },
  );

  await genericEntityRepository.saveTaskTemplate(
    {
      id: "task-template-v2-vault-recon",
      ownerKey: `project:${work.id}`,
      projectId: work.id,
      scope: "project",
      templateKey: "vault-recon",
      label: "火库侦察",
      taskType: "recon",
      description: "验证任务模板、要求、指派和匹配链路。",
    },
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.replaceTaskRequirements(
    "task-template-v2-vault-recon",
    [
      {
        requirementKey: "need-ember-affinity",
        requirementType: "tag-weight",
        targetKey: "ember-affinity",
        expectedNumber: 70,
        weight: 70,
        sortOrder: 1,
      },
      {
        requirementKey: "need-clearance",
        requirementType: "panel-number",
        targetKey: "clearance_level",
        expectedNumber: 2,
        weight: 30,
        sortOrder: 2,
      },
    ],
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.saveTaskAssignment(
    {
      projectId: work.id,
      taskTemplateId: "task-template-v2-vault-recon",
      entityId: "character-v2-hero",
      assignmentStatus: "assigned",
      rationale: "顾徊是当前唯一同时满足火种亲和和最低权限门槛的人。",
    },
    {
      source: "v2-smoke",
    },
  );
  await genericEntityRepository.saveEntityTaskMatch(
    {
      projectId: work.id,
      taskTemplateId: "task-template-v2-vault-recon",
      entityId: "character-v2-hero",
      matchScore: 0.84,
      matchLabel: "recommended",
      reasonsJson: ["火种亲和权重高", "权限等级满足最低要求"],
    },
    {
      source: "v2-smoke",
    },
  );
  await narrativeRepository.saveVolume(
    {
      id: "volume-v2-1",
      workId: work.id,
      order: 1,
      title: "边火初燃",
      goal: "建立主角在边境矿镇的生存基础与第一条火种主线",
      mainConflict: "主角必须在矿镇追杀与火种失控之间活下来",
      entryHook: "矿镇夜里有人偷走了禁火库的火种残片",
      climax: "主角被迫在众人面前点燃失控火种",
      payoff: "读者确认主角具备真正改写命运的资格",
      mustDeliverInfo: ["火种体系的代价", "矿镇权力结构"],
      keyCharacters: ["character-v2-hero", "character-v2-mentor"],
      plannedChapterCount: 48,
    },
    {
      source: "v2-smoke",
    },
  );

  await narrativeRepository.saveChapter(
    {
      id: "chapter-v2-1",
      workId: work.id,
      volumeId: "volume-v2-1",
      order: 1,
      title: "火库缺口",
      summary: "主角发现矿镇禁火库被盗，自己却意外卷入追查。",
      chapterGoal: "建立开篇危机并让主角被迫入局",
      conflict: "主角既要隐藏自己与火种残片的联系，又必须自证清白",
      entryState: "矿镇表面平静，主角还在运炭讨生活",
      exitState: "主角被迫带着残火离开矿镇外层",
      newInfo: ["禁火库的火种残片丢失", "镇上存在第三方势力"],
      foreshadowSeeds: ["残火会认主", "导师角色早就盯上主角"],
      requiredCallbacks: [],
      endingHook: "主角回家时发现自家门前留下了火灰印记",
      keyCharacters: ["character-v2-hero", "character-v2-mentor"],
      sceneCards: [
        {
          id: "scene-v2-1",
          title: "晨间点名",
          purpose: "用秩序化日常反衬危机即将来临",
          conflict: "矿头突然清点夜间出勤，引发众人不安",
          emotionalShift: "从麻木到隐约不安",
        },
        {
          id: "scene-v2-2",
          title: "火库搜查",
          purpose: "把主角正式拉进事件中心",
          conflict: "搜查队怀疑主角偷火，主角必须应对盘问",
          emotionalShift: "从不安到强烈压迫",
        },
      ],
    },
    {
      source: "v2-smoke",
    },
  );

  await narrativeRepository.saveForeshadow(
    {
      id: "foreshadow-v2-1",
      workId: work.id,
      seedChapterId: "chapter-v2-1",
      description: "火灰印记会在真正的火种继承者附近重复出现",
      narrativePurpose: "提示主角身世线并为后续认主埋钩子",
      expectedPayoffVolumeId: "volume-v2-1",
      expectedPayoffChapterId: undefined,
      actualPayoffChapterId: undefined,
      status: "seeded",
    },
    {
      source: "v2-smoke",
    },
  );

  await snapshotRepository.saveEntitySnapshot(
    {
      projectId: work.id,
      entityType: "character",
      entityId: "character-v2-hero",
      chapterId: "chapter-v2-1",
      snapshotLabel: "chapter-1-end",
      stateJson: {
        knows: ["矿镇在追查失窃火种", "自己可能被盯上了"],
        resources: ["残火碎片"],
        wounds: [],
      },
    },
    {
      source: "v2-smoke",
    },
  );

  const draftArtifact: DraftArtifact = {
    id: randomUUID(),
    workId: work.id,
    chapterId: "chapter-v2-1",
    stage: "draft",
    version: 1,
    content: "矿镇清晨的风里全是煤灰味，顾徊刚放下炭篓，就看见禁火库方向升起了警铃。",
    summary: "第一章初稿预览",
    promptVersion: "draft-v2-smoke",
    model: "preview-provider",
    createdAt: new Date().toISOString(),
  };
  await artifactRepository.saveArtifactVersion(draftArtifact, {
    source: "v2-smoke",
  });

  await genericEntityRepository.saveEntityStateEvent(
    {
      projectId: work.id,
      entityId: "character-v2-hero",
      fieldId: "panel-template-v2-character-core:field:ember_stability",
      chapterId: "chapter-v2-1",
      eventType: "stability_drop",
      reason: "首次接触残火导致稳定度下降。",
      oldValueJson: 0.88,
      newValueJson: 0.61,
      sourceArtifactId: `${work.id}:chapter:chapter-v2-1:artifact:draft:version:1`,
    },
    {
      source: "v2-smoke",
    },
  );

  const runId = await pipelineRunRepository.startRun({
    projectId: work.id,
    scopeType: "chapter",
    scopeId: "chapter-v2-1",
    workflowName: "chapter-draft",
    workflowVersion: "v2-smoke",
  });
  await pipelineRunRepository.appendRunStep({
    runId,
    stepKey: "assemble-context",
    stepType: "context",
    status: "completed",
  });
  await pipelineRunRepository.appendRunStep({
    runId,
    stepKey: "generate-draft",
    stepType: "generation",
    status: "completed",
    outputArtifactId: `${work.id}:chapter:chapter-v2-1:artifact:draft:version:1`,
  });
  await pipelineRunRepository.finishRun(runId, "completed");

  const templateId = await promptRegistryRepository.saveTemplate({
    projectId: work.id,
    templateKey: "chapter-draft",
    stage: "draft",
    ownerScope: "project",
  });
  await promptRegistryRepository.saveTemplateVersion({
    templateId,
    versionName: "v1",
    systemPrompt: "你是一名擅长写网络长篇小说的创作助手。",
    userPrompt: "根据章节卡撰写本章初稿。",
    outputContract: "markdown",
    changeSummary: "V2 smoke baseline",
  });

  const projects = await projectRepository.listProjects({ limit: 10 });
  const entities = await genericEntityWorkbenchService.listEntities(work.id);
  const characters = await narrativeRepository.listCharacters(work.id);
  const chapters = await narrativeRepository.listChapters(work.id, "volume-v2-1");
  const artifacts = await artifactRepository.listArtifactVersions("chapter-v2-1", "draft");
  const snapshots = await snapshotRepository.listEntitySnapshots({
    projectId: work.id,
    entityType: "character",
    entityId: "character-v2-hero",
  });
  const heroBundle = await genericEntityWorkbenchService.getEntityBundle("character-v2-hero");
  const taskBundle = await genericEntityWorkbenchService.getTaskBundle("task-template-v2-vault-recon");

  console.log(`[AiFiction Data] SQLite path: ${databasePath}`);
  console.log(`[AiFiction Data] V2 projects: ${projects.length}`);
  console.log(`[AiFiction Data] V2 entities: ${entities.length}`);
  console.log(`[AiFiction Data] V2 characters: ${characters.length}`);
  console.log(`[AiFiction Data] V2 chapters in volume 1: ${chapters.length}`);
  console.log(`[AiFiction Data] V2 artifact versions: ${artifacts.length}`);
  console.log(`[AiFiction Data] V2 snapshots: ${snapshots.length}`);
  console.log(`[AiFiction Data] V2 panel values: ${heroBundle?.panelValues.length ?? 0}`);
  console.log(`[AiFiction Data] V2 entity tags: ${heroBundle?.tags.length ?? 0}`);
  console.log(`[AiFiction Data] V2 entity edges: ${heroBundle?.edges.length ?? 0}`);
  console.log(`[AiFiction Data] V2 task requirements: ${taskBundle?.requirements.length ?? 0}`);
  console.log(`[AiFiction Data] V2 task matches: ${taskBundle?.matches.length ?? 0}`);
  console.log(`[AiFiction Data] Latest project: ${projects[0]?.title ?? "N/A"}`);
  console.log(`[AiFiction Data] Latest chapter: ${chapters[0]?.title ?? "N/A"}`);
}

main().catch((error) => {
  console.error("[AiFiction Data] V2 smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
