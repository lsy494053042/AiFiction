# AiFiction

AiFiction 是一个面向个人创作的长篇网文控制台。当前主线已经收敛为：**本地正文驱动、自动维护优先、人工审查兜底**。

## 当前定位

这个项目不是“全自动写小说的 Agent 平台”，而是一个可持续演进的小说工作台：
- 本地目录中的正文、设定和大纲持续推进。
- 系统负责增量扫描、结构化抽取、待审查整理和事实回写。
- Web 工作台主要负责查看、判断、修正和回溯，而不是承载大规模手工录入。

## 当前已具备的能力

- V2 SQLite 数据底座已经落地，并支持继续扩展。
- Worker 已具备目录同步入口，可列作品、列目录源、绑定目录并执行扫描。
- 新增或修改文件后，系统会自动生成：
  - 摘要预览 artifact
  - 结构化抽取预览 artifact
  - `asset_updates_v2`
  - `review_queue_v2`
- Web 工作台已经接入：
  - 作品书架
  - 快速创建作品
  - 目录绑定与重扫
  - 待处理变更包
  - 审查通过 / 驳回
- 通过审查的角色、关系、伏笔、时间线候选，已经可以首版写回结构化事实层。
- 首页已经进入“导航 + 书架 / 列表 + 搜索”的工作台形态。
- 作品详情页已经拆成“总览 / 待处理 / 剧情资产 / 高级维护”四个分区。

## 核心文档

- `docs/operations/workbench-operations-manual.md`
- `docs/architecture/system-design.md`
- `docs/project/project-progress.md`

## 常用命令

```powershell
npm.cmd run machine:context
npm.cmd run encoding:check
npm.cmd run dev:web
npm.cmd run dev:worker
npm.cmd run worker:sync -- --list-projects
npm.cmd run worker:sync -- --project demo-work-v2 --list-sources
npm.cmd run db:v2-smoke
npm.cmd run db:sync-smoke
npm.cmd run db:workbench-smoke
npm.cmd run typecheck
```

## 当前阶段

当前进入“阶段 4.5：产品收口与自动化减负”：
- 后端主链已经打通：本地目录同步 -> 抽取预览 -> 审查 -> 首版事实回写。
- 首页书架入口和详情页分区式工作台都已经落地。
- 当前最紧急的问题已经转向：进一步降低人工占比，继续收口审查与冲突处理，而不是重做底层数据库。

下一步优先做：
1. 继续强化来源引用和冲突处理。
2. 让低风险项尽可能自动通过。
3. 把影响分析逐步接成更明确的动作分发。

## 机器上下文

- 先运行 `node scripts/machine-context.mjs` 或 `npm.cmd run machine:context`，读取当前电脑的有效配置。
- 机器配置来自 `config/machine-profiles.json`，可选的本地覆盖文件是 `config/machine-overrides.local.json`。
- 这层配置统一管理仓库根路径、`git safe.directory`、GitHub SSH 主机或别名、默认 Web 端口和数据库路径。
- 切换电脑时，优先切换机器上下文，不再改 skill 里的固定路径。

## 中文与编码

- 仓库文本文件统一使用 UTF-8 和 LF 行尾。
- 修改中文文档和页面文案后，先跑 `node scripts/encoding-check.mjs` 或 `npm.cmd run encoding:check`。
- 如果 PowerShell 的默认输出或重定向会污染中文，改用显式 UTF-8 写入，或通过 Node 脚本落盘。