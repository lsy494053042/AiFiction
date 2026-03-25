# AiFiction 设计文档

最后更新：2026-03-25

## 1. 当前定位

AiFiction 当前是“个人长篇网文创作工作台”的底座工程。
当前优先级不是多 Agent 自治，而是先把多作品管理、结构化资产、章节卡工作流和后续生成入口做稳。

## 2. 当前总体设计思路

### 2.1 先工作流，后 Agent

当前主路线仍然是确定性工作流，而不是多 Agent 自治。

### 2.2 先结构化数据，后复杂智能

作品、角色、关系、分卷、章节、伏笔和状态快照优先结构化。
AI 不负责“记住全部”，系统负责“只把当前任务真正需要的事实交给 AI”。

### 2.3 先仓储，再读模型，再写服务

当前已经形成三层：

- repository：负责底层表读写
- workbench query service：负责页面友好的读模型
- workbench mutation service：负责把表单输入转换成领域对象再落库

这样做的价值：

- 页面层不直接依赖底表结构
- 读写逻辑都能复用
- 后续无论是表单、API 还是批量导入，都能走同一套应用层入口

## 3. 当前架构分层

### 3.1 `packages/data`

当前关键入口：

- `packages/data/src/workbench/novel-workbench.service.ts`
- `packages/data/src/workbench/novel-workbench-mutation.service.ts`

前者负责：

- 作品概览
- 作品快照
- 关系图谱预览数据

后者负责：

- 创建作品 / 分卷 / 角色 / 章节卡
- 编辑作品 / 分卷 / 角色 / 章节卡
- 生成唯一 slug
- 自动分配卷序号与章节序号
- 编辑时保留角色关系与章节场景卡等既有结构

### 3.2 `apps/web`

当前关键入口：

- `apps/web/app/workbench-actions.ts`
- `apps/web/app/works/[slug]/page.tsx`
- `apps/web/components/create-work-section.tsx`
- `apps/web/components/work-detail-shell.tsx`
- `apps/web/scripts/run-next.cjs`

说明：

- 首页负责作品概览和创建作品
- 详情页负责结构化资产的查看与编辑
- `run-next.cjs` 用于收敛 Next 14 的 workspace lockfile 噪音

## 4. 当前关键设计模式

### 4.1 Repository Pattern

仓储层负责底层表读写。

### 4.2 Application Read Model

工作台查询服务把 V2 数据整理成页面友好的结构，避免页面层自己做拼装。

### 4.3 Application Mutation Service

工作台写服务负责：

- 生成唯一 slug
- 自动分配卷序号和章节序号
- 表单输入校验与归一化
- 编辑已有对象时保留不该被覆盖的结构化信息

### 4.4 Work Scoped Data

每本书继续通过 `work_id` 强关联，保证多作品之间天然隔离。

### 4.5 Controlled Dev Runtime

由于 Next 14 在 workspace 下会产生 lockfile 自动修补噪音，当前开发启动使用包装脚本而不是直接裸跑 `next dev`。
这属于工程稳定性处理，不影响业务层设计。

## 5. 当前运行状态

当前已经打通：

- V2 schema / bootstrap / repository
- V2 演示数据写入
- 工作台查询服务
- 首页真实概览
- 工作台写服务
- 作品详情页创建入口
- 作品详情页编辑入口
- 根级验证链路 `npm run typecheck`

## 6. 下一步的最优方向

- 补删除与状态变更能力
- 补完整关系图谱页
- 推动 Worker 主链路切向 V2
- 再接真实模型 provider