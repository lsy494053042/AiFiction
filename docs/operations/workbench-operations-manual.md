# AiFiction 操作手册

最后更新：2026-03-27

## 1. 当前可用功能

### 1.1 Web 工作台
- 首页现在已经改成“导航 + 书架 / 列表 + 搜索”的工作台入口，不再用大面积介绍卡占首屏。
- 作品详情页现在已经改成 4 个视图：
  - 总览
  - 待处理
  - 剧情资产
  - 高级维护
- 手工维护仍然保留，但已收口到“高级维护”视图中，只作为补录和纠错入口。

### 1.2 自动同步
- 可为作品绑定本地目录。
- 绑定后会立即执行首轮扫描。
- 可对已绑定目录执行重新扫描。
- 扫描命中新增 / 修改文件后，会生成摘要预览、抽取预览、建议更新和待审查项。

### 1.3 审查机制
- 可直接在作品详情页对待审查项执行“通过 / 驳回”。
- 审查结果会同步写回：
  - `review_queue_v2`
  - `asset_updates_v2`
  - `source_documents_v2.syncStatus`
- 当前已经支持把通过的角色、关系、伏笔、时间线候选写回结构化事实层。
- 当源文档还没有正式手工章节时，系统会自动补一个占位卷 / 占位章节映射，保证写回稳定。

## 2. 推荐使用顺序

1. 先运行 `npm run db:v2-smoke`
2. 再运行 `npm run db:sync-smoke`
3. 启动 `npm run dev:web`
4. 进入某本作品详情页，先看“总览”视图
5. 如果还没绑定目录，切到“待处理”视图绑定你自己的目录
6. 扫描完后，仍在“待处理”视图里处理“通过 / 驳回”
7. 切到“剧情资产”视图，检查分卷、角色、章节和关系是否成形
8. 只有在自动维护不够时，才进入“高级维护”视图补录或修正

## 3. 当前自动同步会做什么

扫描命中新增 / 修改文件后，当前会继续执行：
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

目前的 `db:sync-smoke` 已经覆盖“扫描 -> 审查通过 -> 事实写回”的验证链，并会输出：
- 写回摘要
- 伏笔数量变化
- 时间线数量变化
- 源文档映射到的章节范围

## 5. 目录绑定与路径规则

- 默认数据库路径：`storage/db/aifiction.sqlite`
- `rootPath` 如果填相对路径，会按工作区根目录解析。
- `chapterPath`、`outlinePath`、`exportPath` 如果填相对路径，会按作品根目录解析。
- 当前扫描默认包含：`.md`、`.txt`、`.docx`
- 当前扫描默认排除：`.git`、`.next`、`dist`、`node_modules`

## 6. 已知边界

- 当前自动同步已经形成“扫描 -> 摘要预览 -> 抽取预览 -> 审查 -> 首版事实回写”的最小闭环，但还不是最终版事实维护。
- 当前抽取层仍是启发式预览，后续会接更真实的模型抽取与事实回写。
- 冲突合并、来源引用展示和影响分析还没补完。
- 如果 `apps/web/.next/trace` 被 dev 进程占用，`web:check` 可能失败；停掉 dev 后重跑即可。
- 首页和详情页的第一轮交互收口已经落地，但审查视图仍然偏开发者后台视角。
- 当前待审查仍以条目列表展示，后续会优先改成更直观的“变更包”视图。

## 7. 常用命令

```powershell
npm run dev:web
npm run dev:worker
npm run worker:sync -- --list-projects
npm run worker:sync -- --project demo-work-v2 --list-sources
npm run worker:sync -- --project demo-work-v2 --root storage/sync-smoke/demo-work-v2 --chapters chapters --outline outline
npm run web:health
npm run web:doctor
npm run db:v2-smoke
npm run db:sync-smoke
npm run typecheck
```
