# AiFiction 设计文档

最后更新：2026-03-25

## 1. 当前定位

AiFiction 当前不是“自动写小说 Agent”，而是“个人长篇网文创作工作台”的底座工程。

当前阶段的核心目标：

- 先把工作流、数据层和扩展边界设计稳
- 先保证可控、可维护、可迭代
- 先让系统知道“这本书是什么、这一章需要什么、这次运行做了什么”

## 2. 当前总体设计思路

### 2.1 先工作流，后 Agent

当前主路线不是多 Agent 自治，而是确定性流水线：

1. 作品定位
2. 世界观与角色资产
3. 卷纲 / 章卡
4. 初稿生成
5. 连续性检查
6. 状态回写
7. 版本沉淀

这样做的原因：

- 便于回放和审计
- 便于分阶段接入真实模型
- 便于后续只把高价值环节 agent 化

### 2.2 先双轨数据层，后切换

当前采用 V1 / V2 并行策略：

- V1：当前 demo 的运行数据层
- V2：未来正式底座的数据结构与细粒度仓储

这样做的原因：

- 保持 demo 继续可运行
- 在不打断主流程的前提下逐步升级底座
- 避免一边验证业务、一边被一次性大迁移拖死
### 2.3 先建立工程治理基线

当前已经补齐最基础的工程治理约束：

- 本地 Git 仓库已初始化
- 默认分支统一为 `main`
- 通过 `.gitignore` 排除本地数据库、构建产物和日志
- 通过 `.gitattributes` 统一仓库内文本文件行尾策略

这样做的原因：

- 避免构建产物和本地状态污染版本库
- 降低 Windows 环境下的 CRLF/LF 噪音
- 为后续 GitHub 同步和持续迭代打底
- 远端推送统一通过 SSH Host 别名管理多账号场景

## 3. 技术栈

### 3.1 前端

- `Next.js 14`
- `React 18`
- `TypeScript`

当前用途：

- 承接本地网页管理台骨架
- 未来扩展作品管理、角色管理、章节管理等页面

### 3.2 后端与工作流

- `Node.js`
- `TypeScript`
- `tsx`

当前用途：

- 承接 Worker 入口
- 承接章节级工作流服务
- 承接 provider 抽象与 prompt 组装

### 3.3 数据层

- `SQLite`
- `@libsql/client`
- `drizzle-orm`
- `drizzle-kit`

当前用途：

- 本地单人创作真相源
- 支撑 demo 的低门槛运行
- 为后续 PostgreSQL 演进保留抽象边界

## 4. 当前架构分层

### 4.1 `packages/schemas`

职责：

- 定义领域模型
- 定义结构化输出的契约
- 作为不同层之间的共享类型基础

### 4.2 `packages/prompts`

职责：

- 管理提示词模板
- 管理阶段化 prompt 文本
- 避免 prompt 散落在页面或业务逻辑里

### 4.3 `packages/core`

职责：

- 承接工作流逻辑
- 承接上下文选择
- 承接 provider 抽象
- 承接章节流水线服务

当前设计模式：

- `Workflow Service`
- `Provider Pattern`
- `Schema-first Context Assembly`

### 4.4 `packages/data`

职责：

- 承接数据库连接
- 承接 schema
- 承接 repository
- 承接 V1 / V2 并行演进
- 承接 V2 bootstrap 与本地 smoke 验证

当前设计模式：

- `Repository Pattern`
- `Schema Segmentation`
- `Parallel Evolution (V1 + V2)`
- `Idempotent Bootstrap over Generated SQL`

### 4.5 `apps/web`

职责：

- 承接管理台 UI
- 未来承接作品、角色、章节、运行记录等界面

当前状态：

- 已有首页展示骨架
- 尚未接 CRUD

### 4.6 `apps/worker`

职责：

- 作为后台执行入口
- 负责跑 demo 工作流
- 负责串联 repository、workflow、provider

## 5. 当前使用的主要设计模式

### 5.1 Repository Pattern

业务层不直接依赖 SQL 细节，而是依赖仓储接口。

这样后续：

- 换数据库
- 换 schema
- 切 V1 到 V2
- 增加缓存层

都不会把工作流层一起拖着重写。

### 5.2 Provider Pattern

当前文本生成能力通过 `TextGenerationProvider` 抽象。

这样后续可以切换：

- OpenAI
- Anthropic
- DeepSeek
- 本地模型
- 预览 provider

而不需要重写工作流服务。

### 5.3 Artifact / Version 思路

长文本和版本化内容，不直接散落在各业务表里，而是朝统一产物层收敛。

适用对象：

- 正文
- 章卡版本
- 审校报告
- 改写稿
- 摘要

### 5.4 扩展位策略

通过 `meta_json` 和 `extra_json` 控制不稳定字段：

- `meta_json`：系统元数据
- `extra_json`：业务扩展与实验字段

这样可以避免过早定死字段，又不至于把核心字段埋进 JSON。

### 5.5 生成产物反向驱动引导层

当前 V2 没有再维护一套手写 SQL，而是复用 `drizzle` 生成产物做可重入 bootstrap。

这样做的价值：

- schema、migration、运行时引导层三者保持同一来源
- 少维护一套重复 SQL
- 后续从本地引导过渡到正式迁移链更顺

## 6. 当前数据设计策略

### 6.1 V1

特点：

- 快速落地
- 支撑 demo 实际运行
- 有部分 JSON 聚合结构

适用：

- 当前本地预览链路

### 6.2 V2

特点：

- 项目层、叙事资产层、运行版本层分开
- 长文本统一向 artifact/version 归拢
- 明显会扩张的结构优先拆子表
- run 与 step 两层同时保留
- 已落地细粒度 repository
- 已通过本地 smoke 写读验证

适用：

- 后续正式 repository 接入
- 后续 Agent / LangGraph 演进
- 后续应用层从 V1 向 V2 逐步切换

## 7. 当前运行模式

### 7.1 手动模式

通过文档、终端命令和 Codex 协助推进项目。

这是当前最主要的使用方式。

### 7.2 混合模式

未来可以由：

- 网页承接资产管理
- Worker 承接工作流
- 外部模型或 IDE 插件承接内容生成

### 7.3 自动模式

未来才会进入：

- 网页或 Worker 直接接模型 API
- 多阶段自动运行
- 人工审核闸口保留

## 8. 为未来预留的扩展口

### 8.1 模型扩展口

- provider 抽象已存在
- 真实模型尚未接入

### 8.2 数据扩展口

- V2 schema 已就位
- migration 已生成
- V2 repository 已落地
- 下一步是把应用层读写切到 V2

### 8.3 Agent 扩展口

当前不做 Agent-first，但未来可在不推翻底层的前提下接入：

- `outline-agent`
- `continuity-agent`
- `revision-agent`
- `LangGraph`

### 8.4 数据库扩展口

当前默认 SQLite，但边界设计目标是：

- 数据访问主要收敛在 `packages/data`
- 后续迁 PostgreSQL 时尽量局部改动

## 9. 当前非目标

现阶段明确不优先做：

- 多人权限系统
- 复杂缓存体系
- 独立向量数据库平台
- 自动联网采风
- 多 Agent 自治编排
- 大规模评测平台

## 10. 文档维护规则

当下面这些设计变化发生时，这份文档必须更新：

- 技术栈变化
- 模块边界变化
- repository / provider / workflow 的职责变化
- V1 / V2 策略变化
- 新增重要设计模式或扩展口
- Agent / LangGraph 的接入策略变化
