export const pipelineSteps = [
  { name: "作品定位", detail: "明确平台、题材、卖点、读者和更新节奏。" },
  { name: "设定圣经", detail: "沉淀角色卡、世界规则、风格卡和禁忌边界。" },
  { name: "大纲拆分", detail: "从全书大纲落到分卷大纲，再落到章节卡。" },
  { name: "章节初稿", detail: "按章节卡生成正文，不直接跳过规划层。" },
  { name: "连续性检查", detail: "检查设定、人物、时间线和伏笔回收。" },
  { name: "状态回写", detail: "把章节新事实回写到角色状态、时间线和伏笔账本。" },
];

export const controlPillars = [
  {
    title: "书级控制",
    detail: "每本书维护自己的定位卡、风格卡、规则库和角色资产，避免只按单章自由生成。",
  },
  {
    title: "结构化记忆",
    detail: "真正长期保存的是角色状态、时间线、伏笔和摘要，而不是把整本正文一直塞进上下文。",
  },
  {
    title: "阶段闸门",
    detail: "每一步都必须有输入、输出和可重跑记录，关键节点保留人工确认。",
  },
];

export const builtModules = [
  "packages/schemas：作品、角色、章节、伏笔、状态快照、运行记录等核心模型",
  "packages/data：SQLite + Drizzle 的表结构、bootstrap 和 repository 层",
  "packages/prompts：章节初稿与连续性检查的 prompt 模板",
  "packages/core：上下文筛选、provider 抽象和章节工作流服务",
  "apps/worker：会把 Demo 数据落库，再从数据库组回章节记忆包",
  "docs/product 与 docs/data-model：产品设计与领域模型文档",
];

export const runtimeNotes = [
  {
    title: "数据库位置",
    detail: "默认写入 storage/db/aifiction.sqlite，方便本地备份与后续迁移。",
  },
  {
    title: "模型接入方式",
    detail: "当前先保留 Preview provider，后续可以平滑替换成 OpenAI、Claude、DeepSeek 或本地模型。",
  },
  {
    title: "后续扩展",
    detail: "以后要接 Agent 或 LangGraph，主要是往 worker 与 workflow 层扩展，不需要推翻 schema 和 repository。",
  },
];