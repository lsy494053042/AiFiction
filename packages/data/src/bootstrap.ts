import { getSqliteClient } from "./client";

const bootstrapStatements = [
  `CREATE TABLE IF NOT EXISTS works (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    tagline TEXT NOT NULL,
    genre TEXT NOT NULL,
    subgenre TEXT,
    target_platform TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    target_word_count INTEGER NOT NULL,
    daily_word_target INTEGER NOT NULL,
    update_cadence TEXT NOT NULL,
    commercial_hooks TEXT NOT NULL,
    hard_constraints TEXT NOT NULL,
    content_warnings TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS style_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL UNIQUE,
    perspective TEXT NOT NULL,
    language_density TEXT NOT NULL,
    pacing TEXT NOT NULL,
    emotion_level TEXT NOT NULL,
    dialogue_ratio REAL NOT NULL,
    sensory_detail_level REAL NOT NULL,
    humor_ratio REAL NOT NULL,
    banned_patterns TEXT NOT NULL,
    style_anchors TEXT NOT NULL,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS world_rules (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    hard_constraint INTEGER NOT NULL,
    examples TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS world_rules_work_id_idx ON world_rules(work_id)`,
  `CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    archetype TEXT NOT NULL,
    public_identity TEXT NOT NULL,
    hidden_identity TEXT,
    core_desire TEXT NOT NULL,
    core_fear TEXT NOT NULL,
    strengths TEXT NOT NULL,
    flaws TEXT NOT NULL,
    secrets TEXT NOT NULL,
    speech_style TEXT NOT NULL,
    growth_arc TEXT NOT NULL,
    relationships TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS characters_work_id_idx ON characters(work_id)`,
  `CREATE TABLE IF NOT EXISTS volume_outlines (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    main_conflict TEXT NOT NULL,
    entry_hook TEXT NOT NULL,
    climax TEXT NOT NULL,
    payoff TEXT NOT NULL,
    must_deliver_info TEXT NOT NULL,
    key_characters TEXT NOT NULL,
    planned_chapter_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS volume_outlines_work_id_idx ON volume_outlines(work_id)`,
  `CREATE TABLE IF NOT EXISTS chapter_cards (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    volume_id TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    chapter_goal TEXT NOT NULL,
    conflict TEXT NOT NULL,
    entry_state TEXT NOT NULL,
    exit_state TEXT NOT NULL,
    new_info TEXT NOT NULL,
    foreshadow_seeds TEXT NOT NULL,
    required_callbacks TEXT NOT NULL,
    ending_hook TEXT NOT NULL,
    key_characters TEXT NOT NULL,
    scene_cards TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (volume_id) REFERENCES volume_outlines(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS chapter_cards_work_id_idx ON chapter_cards(work_id)`,
  `CREATE INDEX IF NOT EXISTS chapter_cards_volume_id_idx ON chapter_cards(volume_id)`,
  `CREATE TABLE IF NOT EXISTS character_states (
    snapshot_id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    knows TEXT NOT NULL,
    resources TEXT NOT NULL,
    wounds TEXT NOT NULL,
    emotional_state TEXT NOT NULL,
    stance_summary TEXT NOT NULL,
    relationship_deltas TEXT NOT NULL,
    unresolved_threads TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS character_states_work_id_idx ON character_states(work_id)`,
  `CREATE INDEX IF NOT EXISTS character_states_character_id_idx ON character_states(character_id)`,
  `CREATE INDEX IF NOT EXISTS character_states_chapter_id_idx ON character_states(chapter_id)`,
  `CREATE TABLE IF NOT EXISTS foreshadow_ledger (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    seed_chapter_id TEXT NOT NULL,
    description TEXT NOT NULL,
    narrative_purpose TEXT NOT NULL,
    expected_payoff_volume_id TEXT,
    expected_payoff_chapter_id TEXT,
    actual_payoff_chapter_id TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS foreshadow_ledger_work_id_idx ON foreshadow_ledger(work_id)`,
  `CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    in_world_day INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    related_chapter_id TEXT NOT NULL,
    involved_character_ids TEXT NOT NULL,
    consequences TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS timeline_events_work_id_idx ON timeline_events(work_id)`,
  `CREATE INDEX IF NOT EXISTS timeline_events_related_chapter_id_idx ON timeline_events(related_chapter_id)`,
  `CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY NOT NULL,
    work_id TEXT NOT NULL,
    chapter_id TEXT,
    stage TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    model TEXT NOT NULL,
    success INTEGER NOT NULL,
    input_summary TEXT NOT NULL,
    output_summary TEXT NOT NULL,
    estimated_token_cost REAL NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error_message TEXT,
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS pipeline_runs_work_id_idx ON pipeline_runs(work_id)`,
  `CREATE INDEX IF NOT EXISTS pipeline_runs_chapter_id_idx ON pipeline_runs(chapter_id)`
];

/**
 * 创建首版 SQLite 基础表结构。
 * 当前先用显式 SQL bootstrap，后面可以平滑升级到更完整的 drizzle 迁移链路。
 */
export async function ensureSqliteBootstrap(): Promise<string> {
  const client = getSqliteClient();

  for (const statement of bootstrapStatements) {
    await client.sqlite.execute(statement);
  }

  return client.databasePath;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  ensureSqliteBootstrap()
    .then((databasePath) => {
      console.log(`[AiFiction Data] SQLite bootstrap finished: ${databasePath}`);
    })
    .catch((error) => {
      console.error("[AiFiction Data] SQLite bootstrap failed.");
      console.error(error);
      process.exitCode = 1;
    });
}