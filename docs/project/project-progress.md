# AiFiction 项目进度

最后更新：2026-03-25

## 1. 当前项目目标

当前阶段的总目标不是把产品做全，而是把“个人网文工作台”的底层打稳。

具体来说，要先完成这几件事：

- 建立长期可维护的数据层
- 建立稳定的章节级流水线骨架
- 建立可扩展的模型与工作流边界
- 为后续 CRUD、真实模型接入、Agent 扩展留好口

## 2. 当前所处阶段

当前阶段：**阶段 3 / V2 接入与应用层打通准备**

当前重点：

- 让 Worker 和后续 Web 入口逐步切到 V2 repository
- 设计 V1 -> V2 的双写或模块级切换策略
- 开始接作品、角色、章节的 CRUD 入口

## 3. 已完成内容

### 3.1 工程骨架

- monorepo 结构已建立
- Web / Worker / Core / Prompts / Schemas / Data 分层已落地
- 项目 README 已整理

### 3.2 文档体系

- 产品 MVP 文档已建立
- 领域模型文档已建立
- 数据库 V2 基础设计文档已建立
- 数据库 V2 决策地图已建立
- 操作手册、设计文档、项目进度文档已建立

### 3.3 运行链路

- 本地 SQLite 已接入
- V1 repository 已能写入和读取 demo 数据
- Worker 已能跑通章节预览链路
- Preview provider 已可输出草稿预览和审校预览

### 3.4 数据架构

- V2 schema 已拆为项目层、叙事资产层、运行版本层
- `artifacts_v2` / `artifact_versions_v2` 已建立
- `pipeline_runs_v2` / `pipeline_run_steps_v2` 已建立
- `prompt_templates_v2` / `prompt_template_versions_v2` 已建立
- Drizzle 初始 migration 已生成
- V2 bootstrap 已落地
- V2 repository 已落地
- V2 smoke 脚本已通过

### 3.5 已实现的 V2 仓储

- `SqliteProjectCatalogRepository`
- `SqliteNarrativeAssetRepository`
- `SqliteMemorySnapshotRepository`
- `SqliteArtifactRepository`
- `SqlitePipelineRunRepository`
- `SqlitePromptRegistryRepository`

### 3.6 项目技能

- `aifiction-local-commands`
- `aifiction-db-architect`
- `aifiction-doc-sync`

## 4. 当前仍未完成的关键项

### P0

- V1 -> V2 的迁移/双写策略
- Worker 改走 V2 repository 主链路
- artifact/version 被工作流正式接管
- prompt registry 被工作流正式接管

### P1

- 作品管理页
- 角色管理页
- 章节管理页
- 基础 CRUD / server action / API 入口

### P2

- 真实模型 provider 接入
- 连续性审校结构化输出
- 运行记录查看页
- prompt registry 管理页

### P3

- Agent 局部接入
- LangGraph 集成
- 更细的记忆检索与状态回写策略

## 5. 下一阶段要做什么

下一阶段默认进入：

**V2 接入与 CRUD 起步阶段**

建议顺序：

1. 先把 Worker 的项目/章节上下文读取开始迁到 V2
2. 建立作品、角色、章节的基础读写入口
3. 再决定是走双写还是模块级切换
4. 最后让真实工作流正式接管 artifact/version 与 prompt registry

## 6. 当前风险与注意点

- 当前实际运行主链路仍主要依赖 V1
- Web 还只是展示骨架，不是可用后台
- 真实模型层尚未接入，当前生成结果仍为 preview
- 当前 V2 已可写可读，但还没成为默认应用层真相源
- 如果接下来不尽快做切换策略，V1 / V2 会进入长期并行状态

## 7. 当前判断

当前底层路线是健康的，原因是：

- 先有可运行 demo
- 再补 V2 数据架构
- 再补迁移、bootstrap、repository
- 再用 smoke 验证真实写读

这比一开始就上复杂 Agent 或一次性重构更稳。

## 8. 文档同步规则

以后每次发生“有意义的项目变化”时，都要同步检查并更新这 3 份总览文档：

- `docs/operations/workbench-operations-manual.md`
- `docs/architecture/system-design.md`
- `docs/project/project-progress.md`

更新原则：

- 操作方式变了，更新操作手册
- 设计边界变了，更新设计文档
- 阶段目标、完成度、下一步变了，更新项目进度

即使某次改动只明显影响其中一份文档，也要至少复查另外两份是否需要同步修正。
