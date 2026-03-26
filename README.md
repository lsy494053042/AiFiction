# AiFiction

AiFiction 是一个面向个人创作的长篇网文控制台。当前主线已经收敛为：**本地正文驱动、自动维护优先、人工审查兜底**。

## 当前定位

这个项目不是“全自动写小说的 Agent 平台”，而是一个可持续演进的小说工作台：
- 本地目录中的正文、设定和大纲持续推进。
- 系统负责增量扫描、结构化抽取、待审查整理和事实回写。
- Web 工作台主要负责查看、判断、修正和回溯，而不是承载大规模手工录入。

## 当前已经具备的能力

- V2 SQLite 数据底座已经落地，并支持继续扩展。
- Worker 已具备目录同步入口，可列作品、列目录源、绑定目录并执行扫描。
- 新增或修改文件后，系统会自动生成：
  - 摘要预览 artifact
  - 结构化抽取预览 artifact
  - `asset_updates_v2`
  - `review_queue_v2`
- Web 工作台已经接入：
  - 作品总览
  - 快速创建作品
  - 目录绑定与重扫
  - 待审查列表
  - 审查通过 / 驳回
- 通过审查的角色、关系、伏笔、时间线候选，已经可以首版写回结构化事实层。
- 为了让伏笔和时间线写回稳定，系统会在必要时自动为源文档补一个占位卷/占位章节映射。
- 首页和作品详情页已经做了一轮减负：默认优先看概览、同步和待审查，重表单入口折叠后置。

## 核心文档

- `docs/operations/workbench-operations-manual.md`
- `docs/architecture/system-design.md`
- `docs/project/project-progress.md`

## 常用命令

```powershell
npm run dev:web
npm run dev:worker
npm run worker:sync -- --list-projects
npm run worker:sync -- --project demo-work-v2 --list-sources
npm run worker:sync -- --project demo-work-v2 --root storage/sync-smoke/demo-work-v2 --chapters chapters --outline outline
npm run db:v2-smoke
npm run db:sync-smoke
npm run typecheck
git -c safe.directory=F:/AiFiction push
```

## 当前阶段

当前处于“阶段 4 后半段收口”：
- 自动同步结果已经正式接入 Web 工作台。
- 审查队列已经可消费。
- 角色 / 关系 / 伏笔 / 时间线候选都已经具备首版事实回写能力。
- 页面正在持续从“重手工后台”收缩成“自动维护控制台”。

下一步优先做：
1. 补强来源引用与冲突处理。
2. 继续压缩手工维护入口，强化概览与审查视角。
3. 为关系图谱、来源引用和影响分析留出更清晰的页面入口。