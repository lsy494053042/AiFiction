# AiFiction 系统设计与数据库冻结清单

最后更新：2026-04-08

## 1. 这份文档的定位

这是一份主文档，用来冻结 AiFiction 当前的系统边界。

后续关于以下内容，默认都先以这份文档为准：

- 项目定位
- 文件 / 协议 / 数据库 / 页面分层
- 通用小说数据库的核心边界
- 扩展机制
- 知识系统与写作流程
- 治理、修复、回滚、降级、验收线

除非出现跨题材、跨作品的真实新需求，否则不再反复讨论核心架构。

配套文档：

- [默认架构收口方案](./default-architecture-convergence.md)

## 2. 项目定位

AiFiction 不是某一本小说的定制数据库，也不是单纯的网页工作台。

它的定位是：

**一个面向长篇小说创作的通用操作系统。**

它要稳定支撑的是：

- 不同题材
- 不同人物密度
- 不同世界规则
- 不同写作节奏
- 不同复杂度的结构化信息

它不应该因为换一本书，就重构一次数据库。

## 3. 总原则

系统只按稳定的信息学问题建模，不按题材建模。

数据库只解决这些问题：

1. 这是什么对象
2. 对象叫什么
3. 对象之间有什么关系
4. 对象当前是什么状态
5. 对象什么时候、因为什么发生了变化
6. 这些信息来自哪里
7. 当前写作到底需要取哪一小部分出来

如果某个需求不能归到这几类问题，优先考虑放到：

- 文件
- 协议
- 模板
- 上下文包
- 页面投影视图

而不是先改核心 schema。

### 3.1 项目治理分层

这里说的不是技术实现分层，而是**问题治理分层**。

以后项目里出现的新问题，默认先按下面四层判断归属：

- `内核层`
  - 跨作品稳定成立的通用能力，例如协议、实体、插件运行时、检查链、上下文主链。
- `题材 / 工作流层`
  - 平台差异、题材预设、长短篇节奏、试写规则、批处理方式、默认 gate 口径。
- `单书层`
  - 某一本书自己的设定、权限边界、文风规则、人物规则、叙事约束。
- `运行时层`
  - 某一卷、某一批、某一次扫描、某一次补丁、某一次复盘、某一次临时回写产生的东西。

硬规则：

- 单书问题默认不能直接上升为内核问题。
- 运行时问题默认只能在运行时层收口，不能反向决定核心结构。
- 只有跨书重复出现、且能稳定复用的问题，才允许提升到题材层或内核层。

### 3.2 绿地优先，兼容落地

以后所有新问题，先按没有历史包袱的理想结构判断它应该落哪一层，再决定怎么在当前项目里兼容落地。

这意味着：

- `绿地判断` 是设计标准。
- `兼容保留` 是落地策略。

不允许出现下面这种倒置：

- 因为旧写法已经存在，所以默认它就是对的。
- 因为某本书已经这么写了，所以项目级架构必须跟着它拐。
- 因为当前正文里有某种临时表达，所以核心层必须马上为它让路。

兼容可以保留，但兼容不是标准答案。

### 3.3 提升准入规则

一个问题想从单书层或运行时层提升到题材层或内核层，至少要同时满足下面几条：

1. 不是某一本书的局部表达问题，而是跨书都会遇到的稳定问题。
2. 不是一次性补丁，而是后续会被持续消费的通用能力。
3. 放进更高一层后，能减少后续同类问题的重复劳动，而不是只把特殊情况包装得更复杂。
4. 能明确说明它进入高层后，对现有协议、文档、数据、检查链分别产生什么影响。

只要上面四条说不清，就不允许提升层级，继续留在单书层或运行时层解决。

### 3.4 卷后同步是硬门禁

对写作链来说，卷后同步不是可做可不做的整理动作，而是正式门禁。

硬规则如下：

- 一卷正文写完后，必须先完成整卷扫描、问题收口、设定回写、状态同步和必要检查。
- 上述动作没完成前，下一卷最多只能停留在准备态，不能算正式放行。
- 运行时产物、聊天结论、临时记忆，不能代替卷后同步结果。

这条规则的目的不是增加流程，而是防止“正文已经往后写了，设定和状态还停在上一卷”的失控。

## 4. 分层与职责

上面是问题治理分层，下面这一节才是技术实现分层。

### 4.1 文件层

作用：

- 保存创作真相源
- 保存完整设定、大纲、正文

位置：

- `books/作品名/00-设定`
- `books/作品名/01-大纲`
- `books/作品名/02-正文`

说明：

- 这是最重要的真相源
- 页面、数据库、上下文包都不能替代它

### 4.2 协议层

作用：

- 保存当前运行控制信息
- 指定当前作品、当前批次、当前 gate、当前工作流开关

位置：

- `workspace.yml`
- `books/作品名/book.yml`
- 模板：
  - `templates/protocol/workspace.template.yml`
  - `templates/protocol/book.template.yml`

说明：

- 协议不保存长篇经验正文
- 协议只回答“系统现在怎么跑”

### 4.3 数据库层

作用：

- 保存结构化状态
- 保存来源链
- 保存知识系统对象
- 保存 gate、复盘、应用记录

当前位置：

- schema：`packages/data/src/v2`
- 仓储：`packages/data/src/repositories/v2`
- 迁移：`packages/data/drizzle`

说明：

- 数据库不是完整正文的真相源
- 数据库也不负责保存页面临时状态

### 4.4 上下文包层

作用：

- 生成当前批次最小工作集
- 给写作、复盘、排查使用

位置：

- `books/作品名/03-中间产物/context-packs`

说明：

- 上下文包是运行时产物
- 可以重建
- 不应承担当长期真相源

### 4.5 页面层

作用：

- 展示投影视图
- 暴露例外处理入口

说明：

- 页面不是数据真相源
- 页面不能反向决定核心 schema

## 5. 去哪里读、改、执行

### 5.1 读创作内容

- 设定：`books/作品名/00-设定`
- 大纲：`books/作品名/01-大纲`
- 正文：`books/作品名/02-正文`

### 5.2 改运行配置

- 当前工作区：`workspace.yml`
- 当前作品：`books/作品名/book.yml`
- 模板：`templates/protocol/*.yml`

### 5.3 改写作模板

- 通用模板：`templates/writing/*.md`
- 本书写作卡：`books/作品名/00-设定/文风与写作卡.md`

### 5.4 改数据库

- 核心 schema：`packages/data/src/v2/*.ts`
- 仓储：`packages/data/src/repositories/v2/*.ts`
- 迁移：`packages/data/drizzle/*.sql`

### 5.5 改知识流转

- 协议服务：`packages/data/src/protocol/workspace-protocol.service.ts`
- 协议 smoke：`packages/data/src/protocol-smoke.ts`

### 5.6 跑检查

- 编码检查：`npm.cmd run encoding:check`
- 协议链检查：`npm.cmd run db:protocol-smoke`
- 数据层检查：`npm.cmd run db:check`
- 元语言检查：`npm.cmd run writing:meta-check -- --dir ... --from ... --to ...`
- 字数预算检查：`npm.cmd run writing:budget-check -- --book-root books/作品名`

### 5.7 核心文档治理与执行规则（2026-04-08）

项目级核心文档不是 3 份，而是固定的 4 + 1 份，协议文档另算：

1. [README.md](/f:/AiFiction/README.md)
2. [workbench-operations-manual.md](/f:/AiFiction/docs/operations/workbench-operations-manual.md)
3. [system-design.md](/f:/AiFiction/docs/architecture/system-design.md)
4. [project-progress.md](/f:/AiFiction/docs/project/project-progress.md)
5. [default-architecture-convergence.md](/f:/AiFiction/docs/architecture/default-architecture-convergence.md)

它们的职责固定如下：

- [README.md](/f:/AiFiction/README.md)
  保存项目入口、总览、目录结构、默认工作流与常用命令。
- [workbench-operations-manual.md](/f:/AiFiction/docs/operations/workbench-operations-manual.md)
  保存面向实际使用的操作说明与推荐流程。
- [system-design.md](/f:/AiFiction/docs/architecture/system-design.md)
  保存主架构边界、稳定对象、总原则与最终裁决口径。
- [project-progress.md](/f:/AiFiction/docs/project/project-progress.md)
  保存当前主线、当前阶段、阶段状态、下一步与最近完成记录。
- [default-architecture-convergence.md](/f:/AiFiction/docs/architecture/default-architecture-convergence.md)
  保存默认入口收口方向、完全插件化阶段路线、验收标准与完成后的能力边界。

协议文档单独计算，不并入核心文档集合：

- [workspace.yml](/f:/AiFiction/workspace.yml)
- `books/<作品>/book.yml`

补充说明：

- [writing-knowledge-system.md](/f:/AiFiction/docs/architecture/writing-knowledge-system.md) 目前只保留说明页，内容已经并入主文档，不再算独立核心文档。
- “核心文档”指项目级固定读物；“协议文档”指运行时状态；“作品文档”指具体作品真相源。

新窗口的默认读取顺序固定如下：

1. 先读 [README.md](/f:/AiFiction/README.md)。
2. 再读 [workbench-operations-manual.md](/f:/AiFiction/docs/operations/workbench-operations-manual.md)。
3. 再读 [system-design.md](/f:/AiFiction/docs/architecture/system-design.md)。
4. 再读 [project-progress.md](/f:/AiFiction/docs/project/project-progress.md)。
5. 再读 [default-architecture-convergence.md](/f:/AiFiction/docs/architecture/default-architecture-convergence.md)。
6. 然后再读当前 [workspace.yml](/f:/AiFiction/workspace.yml) 与当前作品 `book.yml`。
7. 最后按任务读取当前作品的设定、大纲、正文与运行产物。

从现在开始：

- 聊天结论不能长期充当真相源。
- 运行时产物不能反向决定主架构。
- 单本书问题不能直接反推核心 schema。
- 核心文档之间一旦出现旧示例、旧流程、乱码或口径冲突，优先直接修正文档本体，不再额外新增补丁文档。

## 6. 核心稳定对象

以下对象属于核心边界，后续尽量稳定，不因单本书而改。

- `project`
- `entity`
- `entity_alias`
- `entity_edge`
- `volume`
- `chapter`
- `scene`
- `timeline_event`
- `entity_snapshot`
- `entity_state_event`
- `source_ref`
- `source_document`
- `knowledge_batch`
- `knowledge_finding`
- `knowledge_item`
- `knowledge_profile`
- `knowledge_profile_rule`
- `knowledge_application`
- `knowledge_gate`

### 6.1 默认入口收口补充（2026-04-08）

当前主文档已经明确了通用实体、面板扩展、来源链与投影视图方向，但默认入口仍然没有完全收口。

目前的真实缺口是：

- 默认入口仍然偏固定 `source_of_truth` 槽位。
- 默认同步入口仍然偏“章节 + 大纲”。
- 默认写回仍然偏固定资产。
- 普通用户开新书时，仍然容易感受到“换题材就要担心数据层”。

从现在开始，主架构补充以下默认原则：

1. 文档入口逐步从固定槽位转向可注册文档集合。
2. 新增结构化事实默认优先落通用实体层，而不是优先落强类型专表。
3. `character / volume / chapter / world_rule` 继续保留，但定义为投影与兼容层。
4. 题材差异优先通过模板注册、面板字段、标签和任务规则承接，不优先通过改主表承接。
5. 系统必须支持未知类型回退，保证新设定最差也能以候选或通用实体方式落地。
6. 上下文包按任务类型组装，而不是默认只按最近章节和最近角色组装。

详细收口方案见：

- [AiFiction 默认架构收口方案](./default-architecture-convergence.md)

原则：

- 不按题材新增主表
- 不按单本书新增主表
- 不因为页面样式而改核心对象

## 7. 实体与关系的泛化原则

### 7.1 实体统一模型

统一按 `entity` 建模。

可作为实体的对象包括：

- 人物
- 势力
- 地点
- 物品
- 组织
- 岗位
- 特殊概念
- 规则对象

人物只是其中一种：

- `entity_type = character`

### 7.2 关系统一模型

统一按 `entity_edge` 建模。

关系可以是：

- 人物-人物
- 人物-势力
- 人物-地点
- 人物-物品
- 势力-地点
- 势力-势力
- 人物-岗位
- 人物-任务

不再只做人际关系。

## 8. 扩展机制

### 8.1 为什么不能继续加主表字段

不同小说的差异很大，例如：

- 境界
- 权限等级
- 污染值
- SAN
- 职级
- 技能树
- 任务偏好

这些差异不能通过不断给角色主表加字段解决。

### 8.2 正确做法

通过三层扩展：

- `panel_template`
- `panel_field`
- `entity_panel_value`

#### `panel_template`

定义一类面板的用途和作用对象。

例如：

- `character_core`
- `faction_core`
- `employee_ops`
- `cultivation_character`

#### `panel_field`

定义字段本身。

至少包含：

- `field_key`
- `label`
- `value_type`
- `cardinality`
- `is_searchable`
- `is_filterable`
- `is_timeline_tracked`
- `display_group`

#### `entity_panel_value`

存某个实体当前字段值。

### 8.3 扩展原则

- 稳定共性进核心结构
- 差异字段走模板字段
- 不是全塞 JSON
- 也不是每本书都改主表

## 9. 状态模型

### 9.1 当前状态

看“现在是什么”：

- `entity_snapshot`
- `entity_panel_value`

### 9.2 变化事件

看“为什么变成这样”：

- `entity_state_event`

### 9.3 强制分离

不能长期只存当前值。

否则后面这些需求都无法稳定支撑：

- 状态信息流
- 面板变化
- 跨章节对比
- 回溯原因

## 10. 标签、任务与匹配

对人物很多、组织复杂、需要调度的小说，系统不能只“存人物”，还要能“组织人物”。

应支持：

- `tag_taxonomy`
- `entity_tag`
- `task_template`
- `task_requirement`
- `task_assignment`
- `entity_task_match`

用途：

- 给实体打标签
- 定义任务需求
- 记录人和任务的匹配结果

这仍然是通用建模，不是题材专用建模。

## 11. 来源链、置信度、人工覆盖

### 11.1 来源链

每一条结构化信息都要能回到来源：

- 哪个文件
- 哪章
- 哪段设定
- 哪次复盘
- 哪条反馈

### 11.2 置信度

必须区分：

- 文件直读
- 人工确认
- 规则推导
- AI/抽取候选

建议至少带：

- `source_kind`
- `confidence`
- `verification_status`
- `verified_by`

### 11.3 人工覆盖

必须允许人工修正，而且人工优先。

需要明确：

- 人工修正写到哪里
- 再次同步时如何保留
- 自动结果何时不能覆盖人工结果

## 12. 生命周期与知识系统

### 12.1 统一对象

知识系统围绕这些对象工作：

- `batch`
- `finding`
- `knowledge_item`
- `profile`
- `profile_rule`
- `application`
- `gate`

### 12.2 生命周期状态

统一使用：

- `candidate`
- `active`
- `book_only`
- `validated_global`
- `merged`
- `archived`
- `deprecated`

### 12.3 升级/降级原则

升级到 `book_only`：

- 同一本书连续多次命中
- 或高权重反馈支持后又被批次复盘验证

升级到 `validated_global`：

- 跨书有效
- 或多次独立批次有效且来源稳定

降到 `archived`：

- 长时间未使用
- 当前阶段已不活跃

降到 `deprecated`：

- 多次证明无效
- 或明显造成文本僵化、误导、冲突

## 13. 工作集预算

允许总库增长，不允许当前工作集无限增长。

默认预算建议：

- 活跃通用规则：`8-12`
- 活跃本书规则：`8-12`
- 当前批次重点问题：`3-5`
- 本书活跃规则总量：`15-20`

超限时只能做三件事：

- 合并
- 归档
- 废弃

## 14. 治理、修复、回滚、降级

### 14.1 可重建性

要明确区分：

- 真相源
- 可重建派生层

派生层包括：

- review 产物
- projection
- 页面投影视图
- 上下文包

### 14.2 修复与回滚

系统必须支持：

- 单书重建
- 单批次重跑
- 局部回滚
- 错误抽取修复

### 14.3 降级模式

至少要有：

- `full mode`
- `degraded mode`

例如：

- 数据库不可用时，退回文件 + 协议
- 抽取失败时，继续写，但少结构化能力
- 页面结构化读取失败时，退回文件只读视图

## 15. 分类治理、并发、稳定 ID

### 15.1 分类治理

以下分类不允许野生增长：

- `entity_type`
- `edge_type`
- `field_type`
- `tag_taxonomy`
- `gate_code`
- `finding_domain`

必须有命名规则和合并原则。

### 15.2 并发与锁

必须明确：

- 谁能写真相源
- 谁只能写派生产物
- 同一本书 / 同一批次是否加锁
- 冲突时谁优先

### 15.3 稳定 ID

必须冻结稳定 ID：

- `project_id`
- `entity_id`
- `batch_id`
- `template_id`
- `field_id`
- `profile_id`
- `chapter_id`

规则：

- 展示名可变
- 路径可变
- 标题可变
- ID 不变

## 16. 校验与回归

校验应分层，而不是想到一个加一个。

### 文件层

- 编码
- 目录结构

### 协议层

- protocol smoke
- gate 完整性

### 写作层

- meta check
- budget check
- continuity / anchoring / opening arc review

### 数据层

- schema
- id
- source chain

### 回归层

- 不同题材样本书回归

## 17. 最小运行路径

V1 必须支持：

- 文件是真相源
- 协议能控制流程
- 数据库能承接实体 / 关系 / 状态 / 知识闭环
- 复盘能入库
- 写作包能按 gate 分流

V1 明确不要求：

- 图谱 UI
- 重型推荐系统
- 全自动抽取取代人工
- 复杂调度引擎
- 高级可视化管理

## 18. 禁止项

以下内容禁止进入核心数据库：

- 题材专用主表
- 页面临时展示状态
- 无来源的 AI 猜测当真相
- 长篇说明文直接当核心结构
- 为单本书临时加的方便字段

## 19. 冻结线

从现在开始，核心架构只允许在同时满足以下三条时变更：

1. 新需求无法归入现有核心对象或扩展机制
2. 模板 / 字段定义 / 标签 / 事件流无法解决
3. 该问题会影响至少两本不同类型小说的稳定运行

只要不同时满足这三条，就：

- 不改核心库
- 只做扩展
- 或只做投影视图/模板/流程

## 20. 当前结论

当前系统应当按以下原则继续推进：

- 核心数据库只负责稳定共性
- 题材差异通过模板字段、标签、事件流和投影视图承接
- 写作流程继续以文件为真相源
- 协议负责控制流程，不承载长经验正文
- 知识系统继续以批次复盘、候选规则、profile、gate 作为闭环基础

这份文档之后不再作为讨论稿使用。

后续如需变更，先证明问题已经越过冻结线，再进入架构层面讨论。

## 21. 数据库扩展草案（VNext）

这一节回答的不是“现在怎么写书”，而是：

**在不破坏当前 V2 的前提下，下一步如何把数据库扩展成真正通用的小说数据库。**

原则：

- 先新增，不先推翻
- 先并行，不先替换
- 先保兼容，不先清旧表

### 21.1 当前保留的表

以下表继续保留，不作为本轮重构对象：

- `novel_projects_v2`
- `project_profiles_v2`
- `guardrail_profiles_v2`
- `project_tags_v2`
- `knowledge_*`
- `volumes_v2`
- `chapters_v2`
- `chapter_scenes_v2`
- `foreshadows_v2`
- `foreshadow_links_v2`
- `timeline_events_v2`
- `entity_state_snapshots_v2`
- `world_rules_v2`
- `artifacts_*`
- `sync_*`
- `source_*`

说明：

- 这些对象已经能支撑当前项目运行
- 本轮扩展不去动它们的职责

### 21.2 需要逐步泛化的旧表

以下表当前可继续使用，但中长期应转为兼容层：

- `characters_v2`
- `character_aliases_v2`
- `character_relationships_v2`

中长期目标不是继续给这些表加字段，而是：

- 让它们逐步退化成 `entity` 模型下的角色投影
- 新需求优先落在通用实体层，而不是继续往角色专用表上堆

### 21.3 新增的通用表

下一批新增表建议如下：

#### 实体核心层

- `entities_v2`
- `entity_aliases_v2`
- `entity_edges_v2`

作用：

- 用统一实体模型承接人物、势力、地点、物品、岗位、概念对象
- 用统一关系模型承接各种边

#### 面板扩展层

- `panel_templates_v2`
- `panel_fields_v2`
- `entity_panel_values_v2`

作用：

- 承接题材差异字段
- 避免继续改核心主表

#### 标签与任务层

- `tag_taxonomies_v2`
- `entity_tags_v2`
- `task_templates_v2`
- `task_requirements_v2`
- `task_assignments_v2`
- `entity_task_matches_v2`

作用：

- 承接多人物、多组织、多任务匹配场景

#### 变化与修正层

- `entity_assertions_v2`
- `entity_override_rules_v2`

作用：

- 显式记录结构化断言
- 支撑人工覆盖与自动结果的优先级控制

### 21.4 这些新表解决什么问题

`entities_v2 / entity_aliases_v2 / entity_edges_v2` 解决：

- 不同作品对象种类不同
- 但核心对象模型要稳定

`panel_templates_v2 / panel_fields_v2 / entity_panel_values_v2` 解决：

- 不同题材有不同“系统面板”
- 但不能每种题材都改主表

`entity_state_snapshots_v2 + entity_state_events_v2` 组合解决：

- 当前状态
- 状态变化历史
- 信息流

`tag / task / match` 解决：

- 多角色调度
- 任务推荐
- 岗位匹配

### 21.5 当前建议的边界

以下内容优先走新通用表：

- 角色外的其他实体
- 系统面板字段
- 任务匹配
- 岗位、权限、组织角色
- 高频变化状态

以下内容继续留在现有表/文件层：

- 正文
- 详细设定长文
- 章级内容
- 当前知识闭环对象

## 22. 迁移顺序

### 第一阶段：并行新增

新增：

- `entities_v2`
- `entity_aliases_v2`
- `entity_edges_v2`
- `panel_templates_v2`
- `panel_fields_v2`
- `entity_panel_values_v2`

目标：

- 不影响现有角色表和当前写作链
- 先把通用承载层搭起来

### 第二阶段：双写与投影

目标：

- 新数据优先写通用表
- 需要兼容的地方继续产出角色投影
- 页面和写作包优先读 projection，而不是直接撞旧表

### 第三阶段：补状态事件与任务层

新增：

- `entity_state_events_v2`
- `tag_taxonomies_v2`
- `entity_tags_v2`
- `task_templates_v2`
- `task_requirements_v2`
- `task_assignments_v2`
- `entity_task_matches_v2`

目标：

- 支撑“系统面板 + 状态流 + 任务匹配”类作品

### 第四阶段：旧表降级为兼容层

目标：

- `characters_v2` 不再承担新增建模需求
- 仅作为旧数据投影或兼容视图

## 23. 当前不做的事

这一轮数据库扩展明确不做：

- 重写当前知识系统表
- 推翻当前 V2 表
- 为某一种题材新增主表
- 建图谱 UI
- 把全部 Markdown 真相源迁进数据库
- 让页面需求反向驱动核心 schema

## 24. 这一步的验收标准

数据库扩展草案落地完成的标准是：

1. 已明确哪些表保留，哪些表退为兼容层
2. 已明确新增哪些通用表
3. 已明确迁移顺序
4. 已明确哪些需求以后走扩展机制，不再走核心重构

只要满足这 4 条，就进入实现阶段，不再继续补充架构讨论。

## 2026-04-09 Hard Preflight

Default entrypoints are now blocked by programmatic preflight instead of relying on chat memory.

Bound entrypoints:
- quickstart
- workspace:init
- books:init
- plugins:manage
- db:register-from-protocol
- db:protocol-smoke
- apps/worker/src/sync-runner.ts

Checks:
1. The fixed 4 + 1 core docs must exist.
2. Non-bootstrap commands must see workspace.yml.
3. Book-mode commands must resolve the target book.yml.
4. docs/project/project-progress.md must keep the backlog section after close-out.
