# AiFiction 操作手册

最后更新：2026-03-25

## 1. 文档目的

这份手册只回答一件事：当前仓库已经能做什么、该怎么用。

它面向两类场景：

- 你自己快速判断“现在能不能直接开始操作”
- 后续我继续维护项目时，快速确认目前可用入口、命令和限制

## 2. 当前可用的使用方式

### 2.1 文档与架构查看模式

当前最完整、最稳定的入口仍然是文档层。

适合做：

- 查看项目目标与阶段规划
- 查看数据库 V2 设计边界
- 查看当前已完成内容和下一阶段重点

优先阅读：

- `docs/product/novel-pipeline-mvp.md`
- `docs/data-model/novel-domain.md`
- `docs/architecture/database-v2-foundation.md`
- `docs/architecture/database-v2-decision-map.md`
- `docs/project/project-progress.md`

### 2.2 本地网页查看模式

Web 当前是本地 React/Next.js 管理台骨架。

当前能做：

- 启动本地页面
- 查看项目首页的整体模块展示
- 作为后续作品管理台的前端骨架

当前还不能做：

- 创建作品
- 编辑角色卡
- 编辑章节卡
- 直接调用模型产出内容

启动方式：

```powershell
npm run dev:web
```

默认访问地址：

```text
http://localhost:3000
```

源码位置：

- `apps/web/app`
- `apps/web/components`

### 2.3 Worker 流水线预览模式

Worker 当前已经能跑通一条本地预览链路。

当前能做：

- 初始化本地 SQLite
- 写入 demo 章节上下文包
- 从数据库重建章节记忆包
- 组装 draft / continuity prompt bundle
- 通过 preview provider 输出预览结果
- 记录 pipeline run

当前还不能做：

- 调用真实 OpenAI / Claude / DeepSeek / 本地模型
- 产出正式正文
- 直接走 V2 repository 主链路

推荐命令：

```powershell
npm --workspace @aifiction/worker exec tsx src/index.ts
```

长期开发时可用：

```powershell
npm run dev:worker
```

源码位置：

- `apps/worker/src`

### 2.4 数据库与迁移模式

当前数据库默认是本地 SQLite。

数据库文件路径：

```text
storage/db/aifiction.sqlite
```

当前状态：

- V1：支撑 demo 实际读写
- V2：schema、migration、bootstrap、repository 已建立，并已通过本地 smoke 验证

常用命令：

```powershell
npm run db:bootstrap
npm run db:generate
npm run db:v2-smoke
npm run typecheck
```

### 2.5 V2 仓储验证模式

当前已经可以直接验证 V2 repository 是否正常工作。

验证内容：

- 项目目录仓储
- 叙事资产仓储
- 记忆快照仓储
- artifact/version 仓储
- pipeline run 仓储
- prompt registry 仓储

推荐命令：

```powershell
npm run db:v2-smoke
```

源码位置：

- `packages/data/src/repositories/v2`
- `packages/data/src/v2-smoke.ts`
### 2.6 Git 本地版本管理模式

当前仓库已经完成本地 Git 初始化，并已有首个基础提交。

当前能做：

- 在本地继续正常提交代码变更
- 基于 `main` 分支持续迭代
- 直接向已绑定的 GitHub 远端推送

当前还不能做：

- 直接从仓库内自动创建 GitHub 远端仓库
- 在未知远端地址的情况下自动完成首次推送

当前状态：

- 本地 Git 仓库：已初始化
- 默认分支：`main`
- GitHub 远端：已配置为 git@github-lsy494053042:lsy494053042/AiFiction.git
- 首次推送：已完成

## 3. 当前可用功能清单

### 已可用

- 本地 monorepo 工程骨架
- Next.js Web 首页骨架
- Worker 预览执行器
- SQLite 本地落库
- V1 repository 读写
- Prompt 模板与上下文组装
- Preview provider
- 数据库 V2 文档
- 数据库 V2 schema 与 migration
- V2 bootstrap 与细粒度 repository
- V2 本地 smoke 验证脚本

### 未完成但已留口

- Web CRUD 页面
- 作品管理与章节管理后台
- Worker 改走 V2 repository 主链路
- artifact/version 被真实工作流正式接管
- prompt registry 被真实工作流正式接管
- 真实模型 provider
- Agent / LangGraph 集成
- GitHub 远端推送与协作流程

## 4. 推荐操作顺序

### 4.1 第一次启动项目

```powershell
npm install --registry=https://registry.npmjs.org/
npm run db:bootstrap
npm run typecheck
```

### 4.2 查看网页骨架

```powershell
npm run dev:web
```

### 4.3 验证 Worker 预览链路

```powershell
npm --workspace @aifiction/worker exec tsx src/index.ts
```

### 4.4 查看数据库 V2 演进状态

```powershell
npm run db:generate
```

然后查看：

- `packages/data/src/v2`
- `packages/data/drizzle`

### 4.5 验证 V2 仓储落地情况

```powershell
npm run db:v2-smoke
```

### 4.6 查看本地 Git 状态

```powershell
git -c safe.directory=F:/AiFiction status --short --branch
```

### 4.7 推送到 GitHub

```powershell
git -c safe.directory=F:/AiFiction push
```

## 5. 当前最适合的使用姿势

在现阶段，更推荐把项目当作“创作控制台底座”而不是“已经可直接写小说的产品”。

更实际的工作方式是：

1. 用文档梳理产品和数据设计
2. 用本地网页承接未来管理台骨架
3. 用 Worker 验证工作流和数据库链路
4. 用 V2 smoke 脚本确认新仓储已经可用
5. 再进入 CRUD、真实模型和工作流切换阶段

## 6. 当前限制

- Web 还不是可操作后台，只是首页骨架
- Worker 还在 preview provider 阶段，不调用真实模型
- SQLite 目前仍以 V1 为主要运行真相源
- V2 虽然已经可写可读，但还未成为应用层默认主路径
- 还没有统一的 server action / API 读写入口

## 7. 文档维护规则

当项目发生下面这些变化时，这份手册必须同步更新：

- 新增可直接使用的功能
- 新增新的启动命令或操作入口
- 某个现有命令失效或替换
- Web / Worker / 数据库的使用方式发生变化
- 当前“已可用 / 未完成”边界变化
