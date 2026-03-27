# AiFiction 操作手册

最后更新：2026-03-27

## 1. 当前可用功能

### 1.1 Web 工作台
- 首页已经改成“导航 + 书架 / 列表 + 搜索”的工作台入口，不再用大面积介绍卡占首屏。
- 作品详情页已经拆成 4 个视图：
  - 总览
  - 待处理
  - 剧情资产
  - 高级维护
- 手工维护仍然保留，但已经收口到“高级维护”里，只作为补录和纠错入口。

### 1.2 自动同步
- 可为作品绑定本地目录。
- 绑定后会立即执行首轮扫描。
- 可对已绑定目录执行重新扫描。
- 扫描命中新文件或修改文件后，会生成摘要预览、抽取预览、建议更新和待审查项。

### 1.3 审查机制
- 可直接在作品详情页对待审查项执行“通过 / 驳回”。
- 待审查当前以“变更包”形式展示，而不是零散条目。
- 审查结果会同步写回：
  - `review_queue_v2`
  - `asset_updates_v2`
  - `source_documents_v2.syncStatus`
- 当前已经支持把通过的角色、关系、伏笔、时间线候选写回事实层。

## 2. 推荐使用顺序

1. 先运行 `npm.cmd run machine:context`
2. 再运行 `npm.cmd run db:v2-smoke`
3. 需要同步链路验证时运行 `npm.cmd run db:sync-smoke`
4. 启动 `npm.cmd run dev:web`
5. 进入某本作品详情页，先看“总览”视图
6. 如果还没绑定目录，切到“待处理”视图绑定本地目录
7. 扫描完成后，继续在“待处理”里处理“通过 / 驳回”
8. 切到“剧情资产”视图，检查分卷、角色、章节和关系是否成形
9. 只有自动维护明显不够时，才进入“高级维护”补录或修正

## 3. 当前自动同步会做什么

扫描命中新文件或修改文件后，当前会继续执行：
- 读取 `.md` / `.txt`
- 生成摘要预览 artifact
- 生成结构化抽取预览 artifact
- 写入 `asset_updates_v2`
- 写入 `review_queue_v2`
- 写入 `source_refs_v2`

当前 `.docx` 还不会自动解析正文，而是先进入待审查队列，等待后续接入专门解析器。

## 4. 当前事实回写范围

已经能正式写回事实层的候选：
- 角色候选
- 关系候选
- 伏笔候选
- 时间线候选

`db:sync-smoke` 已经覆盖“扫描 -> 审查通过 -> 事实回写”的验证链。

## 5. 目录绑定与路径规则

- 默认数据库路径：`storage/db/aifiction.sqlite`
- `rootPath` 如果填相对路径，会按工作区根目录解析。
- `chapterPath`、`outlinePath`、`exportPath` 如果填相对路径，会按作品根目录解析。
- 当前扫描默认包含：`.md`、`.txt`、`.docx`
- 当前扫描默认排除：`.git`、`.next`、`dist`、`node_modules`

## 6. 常用命令

```powershell
npm.cmd run machine:context
npm.cmd run encoding:check
npm.cmd run dev:web
npm.cmd run dev:worker
npm.cmd run web:health
npm.cmd run web:doctor
npm.cmd run db:v2-smoke
npm.cmd run db:sync-smoke
npm.cmd run db:workbench-smoke
npm.cmd run typecheck
npm.cmd run worker:sync -- --list-projects
```

## 7. 机器上下文

- 新机器接入时，先执行 `node scripts/machine-context.mjs` 或 `npm.cmd run machine:context`。
- 输出里需要确认这几项：
  - `workspaceRoot`
  - `git.safeDirectory`
  - `git.remoteUrl`
  - `ssh.host`
  - `web.preferredPort`
  - `storage.databasePath`
- 如果当前电脑和仓库内置配置不完全一致，就复制 `config/machine-overrides.local.example.json` 为 `config/machine-overrides.local.json`，只改本机差异项。
- 如果 PowerShell 因执行策略拦截 `npm`，直接改用 `npm.cmd`，不要把这个问题误判成仓库脚本故障。
- 沙箱审批属于运行环境边界，不能靠 skill 彻底关闭；能做的是尽量复用稳定脚本入口，例如 `npm.cmd run typecheck`、`npm.cmd run db:sync-smoke`、`npm.cmd run db:workbench-smoke`。

## 8. 中文与编码

- 中文文档、页面文案、配置说明统一按 UTF-8 写入，不使用依赖终端默认编码的重定向写法。
- 仓库已增加 `.editorconfig`、`.vscode/settings.json` 和 `scripts/encoding-check.mjs`，用于固定 UTF-8 读写和巡检乱码。
- 后续只要批量改过中文内容，先跑 `npm.cmd run encoding:check`，再跑 `npm.cmd run typecheck`。