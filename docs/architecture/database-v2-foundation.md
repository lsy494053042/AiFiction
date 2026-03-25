# 数据库 V2 基础设计

## 1. 目标

当前 demo 已经证明主流程可以打通，但现有数据层仍偏向“快速落库”。
V2 的目标不是一口气做成最终版，而是把会影响未来 6 到 18 个月迭代成本的底座先设计好。

V2 要解决的问题：

- 降低未来大规模表结构重构的概率
- 避免把明显会扩张的数据长期塞在 JSON 字段里
- 为版本化、审计、回滚、Agent 运行轨迹、Prompt 管理预留足够空间
- 让 repository 成为唯一数据入口，而不是让页面和工作流直接耦合数据库细节

## 2. 当前 V1 的局限

当前 V1 适合作为 demo 骨架，但不适合作为长期模型直接扩展。

主要局限：

- 作品、章节、角色等实体字段已经可以工作，但很多扩展性信息仍在 JSON 内部。
- 章节场景、角色别名、角色关系、伏笔关联等结构未来一定会复杂化，当前还未拆表。
- 缺少 artifact 统一版本层，正文、章卡、审校报告、改写稿还没有统一抽象。
- 缺少 prompt registry，后面很难追踪“哪次产出使用了哪版提示词”。
- pipeline run 已有基础表，但缺少 step 级展开，不利于后续 agent / LangGraph 接入。

## 3. V2 设计原则

### 3.1 高频查询字段显式化

高频筛选、排序、统计、联表需要使用的字段必须落成显式列。

例如：

- 作品状态
- 章节顺序
- 角色类型
- 伏笔状态
- 运行阶段
- artifact 类型

### 3.2 不确定字段集中到扩展位

不是所有字段都值得立刻做成正式列。

因此每张核心表建议统一保留：

- `meta_json`: 给系统内部附加元数据使用
- `extra_json`: 给未来业务扩展、实验字段、自定义字段使用

这样可以把短期探索需求留在扩展位，而不污染正式列设计。

### 3.3 会扩张的结构优先拆子表

如果某类数据未来大概率会：

- 单独查询
- 单独修改
- 形成多对多关系
- 需要排序或版本化

那就不应该长期塞在一个 JSON 字段里。

典型对象：

- 角色别名
- 角色关系
- 章节场景
- 伏笔关联
- 运行步骤
- Prompt 版本

### 3.4 产物统一走版本层

正文、章卡、审校报告、改写稿、摘要等内容，不建议分散到多个专门字段中。

建议统一收敛到 artifact/version 体系：

- artifact 是“逻辑对象”
- artifact version 是“某次具体内容版本”

这样后面新增产物类型时，不需要改动很多表。

### 3.5 运行记录展开到 step 级

首版只记录一次 pipeline run 还不够。

后续接入：

- 多阶段重试
- 人工打回
- agent handoff
- LangGraph 节点运行

都需要 step 级别的数据结构。

## 4. V2 的核心分层

### 4.1 项目层

负责“这本书是什么”。

建议核心表：

- `novel_projects_v2`
- `project_profiles_v2`
- `guardrail_profiles_v2`
- `project_tags_v2`

### 4.2 叙事资产层

负责“这本书写了什么”。

建议核心表：

- `world_rules_v2`
- `characters_v2`
- `character_aliases_v2`
- `character_relationships_v2`
- `volumes_v2`
- `chapters_v2`
- `chapter_scenes_v2`
- `foreshadows_v2`
- `foreshadow_links_v2`
- `timeline_events_v2`
- `entity_state_snapshots_v2`

### 4.3 运行与版本层

负责“系统是如何生成与修订的”。

建议核心表：

- `artifacts_v2`
- `artifact_versions_v2`
- `pipeline_runs_v2`
- `pipeline_run_steps_v2`
- `prompt_templates_v2`
- `prompt_template_versions_v2`

## 5. 推荐的扩展位约定

### 5.1 `meta_json`

用途：

- 系统级元数据
- 内部标记
- 兼容未来工作流标志

不建议放：

- 关键业务字段
- 需要高频筛选或排序的字段

### 5.2 `extra_json`

用途：

- 试验字段
- 临时业务扩展
- 自定义标签
- 暂未稳定的结构

适合过渡使用，但一旦某个字段进入高频查询，就应该升格为正式列或子表。

## 6. Repository 边界建议

Repository 不应再只有一个“大而全”的整包写入方法。

建议按职责拆成：

- `ProjectCatalogRepository`
- `NarrativeAssetRepository`
- `MemorySnapshotRepository`
- `ArtifactRepository`
- `PipelineRunRepository`
- `PromptRegistryRepository`

工作流层只依赖这些接口，不依赖具体表结构。

## 7. 迁移策略

V2 不是立刻替换 V1，而是并行建设。

建议路径：

1. 保留当前 V1 schema 继续支撑 demo。
2. 在 `packages/data/src/v2` 下建立可编译、可审查的 V2 表结构骨架。
3. 先从 repository 接口层切换到更细粒度的抽象。
4. 再按模块逐步把 V1 读写迁移到 V2。
5. 迁移过程中保留 JSON 导出和数据库备份能力。

## 8. 当前阶段的结论

当前最值得优先投入的，不是继续加页面和 AI 接口，而是：

- 稳定 V2 的数据边界
- 明确 repository 合同
- 建立 artifact/version 体系
- 建立 prompt registry 体系

这些基础打稳后，后续无论加功能、换模型、做 agent、接 LangGraph，都属于“往上长”，而不是“推倒重来”。
