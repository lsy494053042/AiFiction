import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * 作品表。
 * 保存一本书最顶层的定位信息，是整本书的主入口。
 */
export const worksTable = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    tagline: text("tagline").notNull(),
    genre: text("genre").notNull(),
    subgenre: text("subgenre"),
    targetPlatform: text("target_platform").notNull(),
    targetAudience: text("target_audience", { mode: "json" }).$type<string[]>().notNull(),
    targetWordCount: integer("target_word_count").notNull(),
    dailyWordTarget: integer("daily_word_target").notNull(),
    updateCadence: text("update_cadence").notNull(),
    commercialHooks: text("commercial_hooks", { mode: "json" }).$type<string[]>().notNull(),
    hardConstraints: text("hard_constraints", { mode: "json" }).$type<string[]>().notNull(),
    contentWarnings: text("content_warnings", { mode: "json" }).$type<string[]>().notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    slugIndex: uniqueIndex("works_slug_unique").on(table.slug),
  }),
);

/**
 * 风格卡表。
 * 单本书只维护一条主风格卡，因此对 workId 做唯一约束。
 */
export const styleProfilesTable = sqliteTable(
  "style_profiles",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    perspective: text("perspective").notNull(),
    languageDensity: text("language_density").notNull(),
    pacing: text("pacing").notNull(),
    emotionLevel: text("emotion_level").notNull(),
    dialogueRatio: real("dialogue_ratio").notNull(),
    sensoryDetailLevel: real("sensory_detail_level").notNull(),
    humorRatio: real("humor_ratio").notNull(),
    bannedPatterns: text("banned_patterns", { mode: "json" }).$type<string[]>().notNull(),
    styleAnchors: text("style_anchors", { mode: "json" }).$type<string[]>().notNull(),
    notes: text("notes", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: uniqueIndex("style_profiles_work_id_unique").on(table.workId),
  }),
);

/**
 * 世界规则表。
 * 规则一般会逐步累积，因此采用逐条 upsert，而不是整表覆盖。
 */
export const worldRulesTable = sqliteTable(
  "world_rules",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    hardConstraint: integer("hard_constraint", { mode: "boolean" }).notNull(),
    examples: text("examples", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: index("world_rules_work_id_idx").on(table.workId),
  }),
);

/**
 * 角色卡表。
 * 关系网络先以 JSON 形式存储，后续需要复杂分析时再拆关系表。
 */
export const charactersTable = sqliteTable(
  "characters",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    archetype: text("archetype").notNull(),
    publicIdentity: text("public_identity").notNull(),
    hiddenIdentity: text("hidden_identity"),
    coreDesire: text("core_desire").notNull(),
    coreFear: text("core_fear").notNull(),
    strengths: text("strengths", { mode: "json" }).$type<string[]>().notNull(),
    flaws: text("flaws", { mode: "json" }).$type<string[]>().notNull(),
    secrets: text("secrets", { mode: "json" }).$type<string[]>().notNull(),
    speechStyle: text("speech_style", { mode: "json" }).$type<string[]>().notNull(),
    growthArc: text("growth_arc").notNull(),
    relationships: text("relationships", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: index("characters_work_id_idx").on(table.workId),
  }),
);

/**
 * 角色状态快照表。
 * 长篇可控记忆的核心之一，每个角色可以拥有多条历史快照。
 */
export const characterStatesTable = sqliteTable(
  "character_states",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").notNull(),
    characterId: text("character_id").notNull().references(() => charactersTable.id, { onDelete: "cascade" }),
    knows: text("knows", { mode: "json" }).$type<string[]>().notNull(),
    resources: text("resources", { mode: "json" }).$type<string[]>().notNull(),
    wounds: text("wounds", { mode: "json" }).$type<string[]>().notNull(),
    emotionalState: text("emotional_state").notNull(),
    stanceSummary: text("stance_summary").notNull(),
    relationshipDeltas: text("relationship_deltas", { mode: "json" }).notNull(),
    unresolvedThreads: text("unresolved_threads", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: index("character_states_work_id_idx").on(table.workId),
    characterIndex: index("character_states_character_id_idx").on(table.characterId),
    chapterIndex: index("character_states_chapter_id_idx").on(table.chapterId),
  }),
);

/**
 * 分卷表。
 * 控制作品中期节奏，避免只有章节卡没有阶段目标。
 */
export const volumeOutlinesTable = sqliteTable(
  "volume_outlines",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    goal: text("goal").notNull(),
    mainConflict: text("main_conflict").notNull(),
    entryHook: text("entry_hook").notNull(),
    climax: text("climax").notNull(),
    payoff: text("payoff").notNull(),
    mustDeliverInfo: text("must_deliver_info", { mode: "json" }).$type<string[]>().notNull(),
    keyCharacters: text("key_characters", { mode: "json" }).$type<string[]>().notNull(),
    plannedChapterCount: integer("planned_chapter_count").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: index("volume_outlines_work_id_idx").on(table.workId),
  }),
);

/**
 * 章节卡表。
 * 场景卡暂时保存在 JSON 字段中，便于首版快速落地。
 */
export const chapterCardsTable = sqliteTable(
  "chapter_cards",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    volumeId: text("volume_id").notNull().references(() => volumeOutlinesTable.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    chapterGoal: text("chapter_goal").notNull(),
    conflict: text("conflict").notNull(),
    entryState: text("entry_state").notNull(),
    exitState: text("exit_state").notNull(),
    newInfo: text("new_info", { mode: "json" }).$type<string[]>().notNull(),
    foreshadowSeeds: text("foreshadow_seeds", { mode: "json" }).$type<string[]>().notNull(),
    requiredCallbacks: text("required_callbacks", { mode: "json" }).$type<string[]>().notNull(),
    endingHook: text("ending_hook").notNull(),
    keyCharacters: text("key_characters", { mode: "json" }).$type<string[]>().notNull(),
    sceneCards: text("scene_cards", { mode: "json" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: index("chapter_cards_work_id_idx").on(table.workId),
    volumeIndex: index("chapter_cards_volume_id_idx").on(table.volumeId),
  }),
);

/**
 * 伏笔账本表。
 * 伏笔一旦结构化，后续就可以做未回收伏笔提醒。
 */
export const foreshadowLedgerTable = sqliteTable(
  "foreshadow_ledger",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    seedChapterId: text("seed_chapter_id").notNull(),
    description: text("description").notNull(),
    narrativePurpose: text("narrative_purpose").notNull(),
    expectedPayoffVolumeId: text("expected_payoff_volume_id"),
    expectedPayoffChapterId: text("expected_payoff_chapter_id"),
    actualPayoffChapterId: text("actual_payoff_chapter_id"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: index("foreshadow_ledger_work_id_idx").on(table.workId),
  }),
);

/**
 * 时间线事件表。
 * 用来核对事件先后顺序和人物行程是否合理。
 */
export const timelineEventsTable = sqliteTable(
  "timeline_events",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    inWorldDay: integer("in_world_day").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    relatedChapterId: text("related_chapter_id").notNull(),
    involvedCharacterIds: text("involved_character_ids", { mode: "json" }).$type<string[]>().notNull(),
    consequences: text("consequences", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    workIndex: index("timeline_events_work_id_idx").on(table.workId),
    chapterIndex: index("timeline_events_related_chapter_id_idx").on(table.relatedChapterId),
  }),
);

/**
 * 流水线运行记录表。
 * 后面做成本统计、返工率统计和审计回放时会用到。
 */
export const pipelineRunsTable = sqliteTable(
  "pipeline_runs",
  {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull().references(() => worksTable.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id"),
    stage: text("stage").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    success: integer("success", { mode: "boolean" }).notNull(),
    inputSummary: text("input_summary").notNull(),
    outputSummary: text("output_summary").notNull(),
    estimatedTokenCost: real("estimated_token_cost").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    workIndex: index("pipeline_runs_work_id_idx").on(table.workId),
    chapterIndex: index("pipeline_runs_chapter_id_idx").on(table.chapterId),
  }),
);

export const worksRelations = relations(worksTable, ({ many, one }) => ({
  styleProfile: one(styleProfilesTable, {
    fields: [worksTable.id],
    references: [styleProfilesTable.workId],
  }),
  worldRules: many(worldRulesTable),
  characters: many(charactersTable),
  characterStates: many(characterStatesTable),
  volumes: many(volumeOutlinesTable),
  chapters: many(chapterCardsTable),
  foreshadows: many(foreshadowLedgerTable),
  timelineEvents: many(timelineEventsTable),
  pipelineRuns: many(pipelineRunsTable),
}));

export const volumesRelations = relations(volumeOutlinesTable, ({ many, one }) => ({
  work: one(worksTable, {
    fields: [volumeOutlinesTable.workId],
    references: [worksTable.id],
  }),
  chapters: many(chapterCardsTable),
}));

export const chaptersRelations = relations(chapterCardsTable, ({ one }) => ({
  work: one(worksTable, {
    fields: [chapterCardsTable.workId],
    references: [worksTable.id],
  }),
  volume: one(volumeOutlinesTable, {
    fields: [chapterCardsTable.volumeId],
    references: [volumeOutlinesTable.id],
  }),
}));

export const schema = {
  worksTable,
  styleProfilesTable,
  worldRulesTable,
  charactersTable,
  characterStatesTable,
  volumeOutlinesTable,
  chapterCardsTable,
  foreshadowLedgerTable,
  timelineEventsTable,
  pipelineRunsTable,
};