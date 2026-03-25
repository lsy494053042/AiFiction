# AiFiction

用于个人创作长篇网络小说的流水线项目。

当前仓库的目标不是先做一个万能 Agent，而是先搭出一套可控、可追踪、可扩展的小说生产系统：从作品定位、角色设定、全书大纲、章节卡，到初稿生成、一致性检查、状态回写，逐步把一本书拆成稳定步骤。

## 当前结构

```text
apps/
  web/         Web 管理台骨架
  worker/      流水线执行器骨架
packages/
  core/        工作流编排、provider 抽象与上下文组装
  data/        SQLite + Drizzle 数据访问层，以及 V2 数据层骨架
  prompts/     Prompt 模板与阶段化提示词
  schemas/     核心领域模型与结构化输出 Schema
docs/
  product/     产品与流程设计文档
  data-model/  数据模型与持久化设计
  architecture/基础架构、数据库 V2 与路线图
  operations/  当前可用功能与操作手册
  project/     项目目标、阶段进度与下一步计划
skills/
  aifiction-local-commands/
  aifiction-db-architect/
  aifiction-doc-sync/
storage/
  artifacts/   运行产物、原始输出、审校报告
  db/          本地 SQLite 数据文件
  exports/     导出稿、发布稿、备份文件
```

## 核心原则

1. 书级控制优先于章级生成。
2. 结构化数据优先于大段自由文本。
3. 先做工作流，再逐步局部 agent 化。
4. 人工审核节点始终保留。
5. 数据层、工作流层、模型层、页面层分离。

## 当前已经落地的能力

- 作品定位卡、风格卡、世界规则、角色卡、卷纲、章卡、伏笔、状态快照等领域模型
- SQLite 本地数据层
- 章节上下文筛选与 prompt bundle 组装
- 文本模型 provider 抽象与预览 provider
- 章节工作流服务
- Worker 演示链路：落库 -> 读库 -> 组 prompt -> 生成预览结果
- 数据库 V2 基础设计文档与可编译 schema 骨架
- V2 bootstrap 与细粒度 repository
- V2 本地 smoke 验证脚本
- 数据库设计、文档同步与本地命令执行的项目 skill

## 当前数据库说明

- 当前运行中的数据库：SQLite
- 默认路径：`storage/db/aifiction.sqlite`
- 当前定位：本地单人创作真相源
- 当前策略：V1 继续支撑 demo，V2 已具备写读能力，下一步逐步接入应用层

## 推荐先看的文档

- `docs/product/novel-pipeline-mvp.md`
- `docs/data-model/novel-domain.md`
- `docs/operations/workbench-operations-manual.md`
- `docs/architecture/system-design.md`
- `docs/architecture/database-v2-foundation.md`
- `docs/architecture/foundation-roadmap.md`
- `docs/architecture/database-v2-decision-map.md`
- `docs/project/project-progress.md`

## 常用命令

```powershell
npm install --registry=https://registry.npmjs.org/
npm run db:bootstrap
npm run db:generate
npm run db:v2-smoke
npm run typecheck
npm run dev:web
npm run dev:worker
```

## 说明

- `apps/web/.next` 和 `apps/worker/dist` 是构建产物，不是源码。
- Web 源码主要在 `apps/web/app` 和 `apps/web/components`。
- Worker 源码主要在 `apps/worker/src`。
- 数据层源码主要在 `packages/data/src`。
- V2 数据层骨架当前在 `packages/data/src/v2`。
- V2 仓储实现当前在 `packages/data/src/repositories/v2`。

## 当前验证结果

- `npm run typecheck` 通过
- `npm --workspace @aifiction/data run db:bootstrap` 通过
- `npm --workspace @aifiction/worker exec tsx src/index.ts` 通过
- `npm --workspace @aifiction/web run build` 能完成构建
- `npm run db:generate` 通过
- `npm run db:v2-smoke` 通过

备注：Next.js 14 在 npm workspaces 下仍会尝试自动 patch lockfile，并打印额外 warning；当前构建产物已正常生成，这个 warning 后续可以单独收口。
