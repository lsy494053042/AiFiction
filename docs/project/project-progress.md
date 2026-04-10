# AiFiction 项目进度

最后更新：2026-04-09

## 当前状态
- 当前工作区有活动作品《灰雾雇员》，但当前优先级仍然是架构与产品化主线，不推进正文。
- 当前主线已经从“完全插件化”切到“插件化完成后的产品化预备”。
- 当前不处理 UI，不补页面层体验，不新增治理文档。

## 核心约束
- 项目级核心文档按 `4 + 1` 管理：
  - `README.md`
  - `docs/operations/workbench-operations-manual.md`
  - `docs/architecture/system-design.md`
  - `docs/project/project-progress.md`
  - `docs/architecture/default-architecture-convergence.md`
- 协议文档单独管理，不计入上面的 `4 + 1`：
  - `workspace.yml`
  - `books/<作品>/book.yml`
- 跨窗口接手时，先读核心文档，再读协议文档，再按任务读当前作品的真相源与运行产物。

## 已完成基础
- 文件、协议、数据库、上下文包、页面的职责边界已经冻结到核心文档。
- 通用实体层、面板层、标签层、任务层已经落地到 v2 schema 和 repository。
- 工作台、同步链、上下文包已经能稳定消费通用实体层。
- 已跑通基础验证链：
  - `db:check`
  - `db:v2-smoke`
  - `db:sync-smoke`
  - `db:protocol-smoke`
  - `encoding:check`

## 2026-04-09 大步 1 完成
- 已落地插件底座与注册表骨架：
  - [types.ts](/f:/AiFiction/packages/data/src/plugins/types.ts)
  - [registry.ts](/f:/AiFiction/packages/data/src/plugins/registry.ts)
  - [runtime.ts](/f:/AiFiction/packages/data/src/plugins/runtime.ts)
  - [source-document-definitions.plugin.ts](/f:/AiFiction/packages/data/src/plugins/builtin/source-document-definitions.plugin.ts)
- 已把注册文档语义抽取器挂入内置插件：
  - [source-document-semantics.ts](/f:/AiFiction/packages/data/src/sync/source-document-semantics.ts)
- 已把 `source_of_truth` 默认文档定义切到插件注册表消费：
  - [workspace-protocol.service.ts](/f:/AiFiction/packages/data/src/protocol/workspace-protocol.service.ts)
  - [novel-project-sync.service.ts](/f:/AiFiction/packages/data/src/sync/novel-project-sync.service.ts)

## 2026-04-09 大步 2 完成
- 已将三类核心能力接入插件注册表：
  - `source-document-semantic-projection`
  - `source-document-semantic-context`
  - `writing-pack-gate-policy`
- 已新增内置工作流插件：
  - [source-document-workflow.plugin.ts](/f:/AiFiction/packages/data/src/plugins/builtin/source-document-workflow.plugin.ts)
- 已完成主链路接线：
  - [novel-workbench.service.ts](/f:/AiFiction/packages/data/src/workbench/novel-workbench.service.ts)
  - [workspace-protocol.service.ts](/f:/AiFiction/packages/data/src/protocol/workspace-protocol.service.ts)
  - [runtime.ts](/f:/AiFiction/packages/data/src/plugins/runtime.ts)

## 2026-04-09 大步 3 完成
- 已补齐插件可用性与收官能力：
  - manifest 增加 `apiVersion / builtin / requiresPlugins / conflictsWith`
  - runtime 增加工作区插件配置、bundle、strict mode、阻断诊断和加载状态
  - `workspace.yml` 已有 `plugins` 配置入口
  - 主链路默认按工作区插件配置加载，并在插件失败时回退 legacy
- 已新增本地管理入口与回归脚本：
  - [plugins-cli.ts](/f:/AiFiction/packages/data/src/plugins-cli.ts)
  - [plugin-smoke.ts](/f:/AiFiction/packages/data/src/plugin-smoke.ts)

## 2026-04-09 产品化预备：Starter Profile 与开书 CLI
- 已新增工作区级 starter profile 配置：
  - `workspace.yml > book_starters`
- starter profile 现已接入插件注册表：
  - [starter-profiles.plugin.ts](/f:/AiFiction/packages/data/src/plugins/builtin/starter-profiles.plugin.ts)
  - [starter-profiles.ts](/f:/AiFiction/packages/data/src/protocol/starter-profiles.ts)
  - `workspace.yml > book_starters` 现在主要承担 override / 扩展职责，不再是唯一默认来源
- 已落下默认 starter profile：
  - `qidian-male-longform`
  - `qidian-female-longform`
  - `serial-experimental`
- 已把 starter profile 接入协议默认生成链：
  - [workspace-protocol.service.ts](/f:/AiFiction/packages/data/src/protocol/workspace-protocol.service.ts)
  - [starter-profiles.ts](/f:/AiFiction/packages/data/src/protocol/starter-profiles.ts)
- 已新增开书 CLI：
  - [init-book.ts](/f:/AiFiction/packages/data/src/init-book.ts)
  - 命令：`npm.cmd run books:init -- list-profiles`
  - 命令：`npm.cmd run books:init -- create 作品名 --profile qidian-male-longform`
- 当前开书 CLI 已支持：
  - 列出 starter profile
  - 按 profile dry-run 预览
  - 创建作品记录
  - 绑定主稿目录
  - bootstrap `workspace.yml / book.yml`
  - 将所选 profile 的 `plugin_bundles` 合并写入 `workspace.yml > plugins.bundles`
  - 生成基础目录与核心设定/大纲占位文档
- starter overlay 已做实为协议覆盖插件：
  - [starter-protocol-overlays.plugin.ts](/f:/AiFiction/packages/data/src/plugins/builtin/starter-protocol-overlays.plugin.ts)
  - 目前已落下：
    - `builtin.starter-qidian-male-longform`
    - `builtin.starter-qidian-female-longform`
    - `builtin.starter-serial-experimental`
  - 它们会真实覆盖对应题材的 `book.yml` 默认协议项，而不是只保留 bundle 名称
  - `core-default` 不会默认加载这些题材 overlay；现在推荐通过 `topic-*` 官方题材包来启用它们
- 已补真实创建 smoke：
  - [init-book-smoke.ts](/f:/AiFiction/packages/data/src/init-book-smoke.ts)
  - 命令：`npm.cmd run books:init:smoke`
  - 做法：在隔离临时工作区 + 独立 SQLite 中真实创建、校验、再清理
- 本轮验证已通过：
  - `npm.cmd --workspace @aifiction/data run typecheck`
  - `npm.cmd --workspace @aifiction/data run plugins:smoke`
  - `npm.cmd --workspace @aifiction/data run books:init -- list-profiles`
  - `npm.cmd --workspace @aifiction/data run books:init -- create 插件化样例 --profile qidian-male-longform --dry-run`
  - `npm.cmd --workspace @aifiction/data run books:init:smoke`
  - `npm.cmd run db:protocol-smoke`

## 2026-04-09 产品化预备：工作区初始化与默认插件组合
- 已新增工作区初始化 CLI：
  - [init-workspace.ts](/f:/AiFiction/packages/data/src/init-workspace.ts)
  - 命令：`npm.cmd run workspace:init -- show-defaults`
  - 命令：`npm.cmd run workspace:init -- init --profile qidian-male-longform --workspace-name "AiFiction 工作区"`
- 当前 `workspace:init` 已支持：
  - 显示当前可用 starter profile 与内置 bundle
  - 生成或补齐 `workspace.yml`
  - 自动把默认 starter profile 的 `plugin_bundles` 合并进 `workspace.yml > plugins.bundles`
  - 把解析后的 starter profile 完整物化回 `workspace.yml > book_starters.profiles`
  - 保留已有 `enabled / disabled / strict_mode`
  - 二次执行时按增量方式合并 bundle，不会把已有 starter 组合直接冲掉
- 已补真实初始化 smoke：
  - [init-workspace-smoke.ts](/f:/AiFiction/packages/data/src/init-workspace-smoke.ts)
  - 命令：`npm.cmd run workspace:init:smoke`
  - 做法：在隔离临时工作区中真实初始化、校验 bundle 自动合并与二次执行增量合并，再清理
- 已补 bundle 增删入口：
  - [plugins-cli.ts](/f:/AiFiction/packages/data/src/plugins-cli.ts)
  - 命令：`npm.cmd run plugins:manage -- add-bundle topic-serial-experimental`
  - 命令：`npm.cmd run plugins:manage -- remove-bundle topic-serial-experimental`
- 本轮验证已通过：
  - `npm.cmd --workspace @aifiction/data run typecheck`
  - `npm.cmd --workspace @aifiction/data run workspace:init -- show-defaults`
  - `npm.cmd --workspace @aifiction/data run workspace:init -- init --profile qidian-male-longform --dry-run`
  - `npm.cmd --workspace @aifiction/data run workspace:init:smoke`
  - `npm.cmd --workspace @aifiction/data run plugins:smoke`
  - `npm.cmd run db:protocol-smoke`

## 2026-04-09 产品化预备：官方题材包收口
- 已补 `official-default-authoring`，作为官方默认写作能力组合。
- 已补官方题材包：
  - `topic-qidian-male-longform`
  - `topic-qidian-female-longform`
  - `topic-serial-experimental`
- `topic-*` 现在会组合 `official-default-authoring` 与对应 `starter-*` 兼容 alias；旧 `starter-*` bundle 继续保留给历史配置回退。
- `workspace:init` 现在会把解析后的 starter profile 完整物化回 `workspace.yml > book_starters.profiles`，避免工作区只留局部 override。
- 当前工作区也已经归一化到 `core-default + topic-qidian-male-longform` 口径。

## 2026-04-09 产品化预备：插件运维约束补齐
- 已补插件配置快照历史：
  - [plugin-config-history.ts](/f:/AiFiction/packages/data/src/plugin-config-history.ts)
  - 快照默认落到 `storage/plugin-config-history/`
- 已扩展插件管理 CLI：
  - [plugins-cli.ts](/f:/AiFiction/packages/data/src/plugins-cli.ts)
  - 新增命令：
    - `doctor`
    - `snapshot`
    - `history`
    - `rollback`
- 当前插件配置变更会自动生成 `before:* / after:*` 快照，便于回滚 starter / topic bundle 组合调整。
- `doctor` 会输出工作区插件诊断、阻断项、兼容 alias 提示和建议动作。
- `rollback` 目前只回滚 `workspace.yml > plugins`，不碰作品协议和正文资产。
- 已把运维链补进回归：
  - [plugin-smoke.ts](/f:/AiFiction/packages/data/src/plugin-smoke.ts)
  - 当前已验证 `snapshot / doctor / add-bundle / rollback` 全链路。

## 2026-04-09 产品化预备：Starter 样本库、Golden 基线与回归矩阵
- 已新增 starter fixture 样本定义：
  - [starter-profile-fixtures.ts](/f:/AiFiction/packages/data/src/starter-profile-fixtures.ts)
  - 当前覆盖：`qidian-male-longform / qidian-female-longform / serial-experimental`
- 已新增 starter golden 基线：
  - [starter-profile-golden.ts](/f:/AiFiction/packages/data/src/starter-profile-golden.ts)
  - 当前固定工作区 bundle、平台/字数、节奏配比、规则集、重写触发器、prewrite sequence 和 source document 路径
- 已新增 starter 矩阵 smoke：
  - [starter-profile-matrix-smoke.ts](/f:/AiFiction/packages/data/src/starter-profile-matrix-smoke.ts)
  - 命令：`npm.cmd run starter:matrix:smoke`
- 当前矩阵会逐个 profile 校验并对比 golden：
  - `workspace:init` 是否写入正确 starter profile 和 bundle
  - `books:init` 是否写入正确平台、总字数、止损线和章均目标
  - starter overlay 是否真的写入 `chapter_function_mix / enabled_rule_sets / allowed_rewrite_triggers / hard_rules`
  - `serial-experimental` 是否正确放宽 prewrite gate 和卷体量预算
  - placeholder source documents 与协议摘要是否可读
  - 当前输出是否与 golden 基线一致，避免 starter 题材预设悄悄漂移
- 本轮验证已通过：
  - `npm.cmd --workspace @aifiction/data run typecheck`
  - `npm.cmd --workspace @aifiction/data run starter:matrix:smoke`
  - `npm.cmd --workspace @aifiction/data run books:init:smoke`
  - `npm.cmd --workspace @aifiction/data run workspace:init:smoke`
  - `npm.cmd --workspace @aifiction/data run plugins:smoke`
  - `npm.cmd run db:protocol-smoke`

## 2026-04-09 产品化预备：Plugin Runtime、Ops 与冲突约束矩阵回归
- 已新增 runtime fixture 样本定义：
  - [plugin-runtime-fixtures.ts](/f:/AiFiction/packages/data/src/plugin-runtime-fixtures.ts)
  - 当前覆盖：
    - `core-default-baseline`
    - `compatibility-serial-alias`
    - `topic-female-strict`
    - `topic-male-overlay-disabled`
    - `broken-unknown-bundle`
- 已新增 runtime golden 基线：
  - [plugin-runtime-golden.ts](/f:/AiFiction/packages/data/src/plugin-runtime-golden.ts)
  - 当前固定工作区插件配置、bundle 展开结果、loaded plugin 集、blocking/skipped 记录和 doctor 建议。
- 已新增 runtime 矩阵 smoke：
  - [plugin-runtime-matrix-smoke.ts](/f:/AiFiction/packages/data/src/plugin-runtime-matrix-smoke.ts)
  - 命令：`npm.cmd run plugins:matrix:smoke`
- 当前矩阵会逐个场景校验并对比 golden：
  - `workspace.yml > plugins` 解析结果
  - runtime 的 `bundleIds / expandedBundleIds / selectedPluginIds / loadedPluginIds`
  - runtime 的 `blockingRecords / skippedRecords`
  - doctor 的 `snapshotCount / recommendations`
- 当前也已纳入 ops 场景：
  - `compatibility-normalize-rollback`
  - `conflicting-topic-rollback`
  - `unknown-bundle-rollback`
  - `strict-toggle-roundtrip`
- 已新增兼容 alias 归一化入口：
  - [plugin-bundle-compat.ts](/f:/AiFiction/packages/data/src/plugin-bundle-compat.ts)
  - [plugins-cli.ts](/f:/AiFiction/packages/data/src/plugins-cli.ts)
  - 命令：`npm.cmd run plugins:manage -- normalize-bundles`
- `doctor` 现在不只提示“prefer topic bundle”，还会给出 `plugins:manage normalize-bundles` 的具体动作建议。
- 官方 `topic-*` bundle 现在带有互斥冲突约束；当同一工作区同时启用多套不同题材 topic bundle 时，runtime 会阻断后加入的 bundle，doctor 也会给出冲突建议。
- 本轮验证已通过：
  - `npm.cmd --workspace @aifiction/data run typecheck`
  - `npm.cmd --workspace @aifiction/data run plugins:smoke`
  - `npm.cmd --workspace @aifiction/data run plugins:matrix:smoke`
  - `npm.cmd run db:protocol-smoke`

## 2026-04-09 产品化预备：Migration / Compatibility Baseline
- 已新增迁移兼容 fixture、golden 与 smoke：
  - [migration-compat-fixtures.ts](/f:/AiFiction/packages/data/src/migration-compat-fixtures.ts)
  - [migration-compat-golden.ts](/f:/AiFiction/packages/data/src/migration-compat-golden.ts)
  - [migration-compat-smoke.ts](/f:/AiFiction/packages/data/src/migration-compat-smoke.ts)
- 命令：
  - `npm.cmd run migration:compat:smoke`
- 当前基线覆盖：
  - 旧工作区缺失 `plugins / book_starters` 时，`bootstrapWorkProtocolBySlug` 会回补默认 starter profile、starter profile 列表和对应 `topic-*` bundle
  - 旧 `source_of_truth` 只有固定字段时，协议会稳定回补 `documents`
  - 固定字段与注册文档混用时，注册文档优先、缺失项由 legacy 字段补齐，自定义文档继续保留
- 已补 bootstrap 兼容行为：
  - [workspace-protocol.service.ts](/f:/AiFiction/packages/data/src/protocol/workspace-protocol.service.ts)
  - 当前在工作区缺失插件配置时，会按解析出的 starter profile 回补默认 bundle；缺失 `book_starters.profiles` 时，也会回补注册 starter profile 列表
- 本轮验证已通过：
  - `npm.cmd --workspace @aifiction/data run typecheck`
  - `npm.cmd --workspace @aifiction/data run migration:compat:smoke`
  - `npm.cmd run db:protocol-smoke`

## 2026-04-09 产品化大步 3：Quickstart 最小闭环
- 已新增对外 `quickstart` 入口：
  - [quickstart.ts](/f:/AiFiction/packages/data/src/quickstart.ts)
  - 命令：
    - `npm.cmd run quickstart -- list-profiles`
    - `npm.cmd run quickstart -- create 作品名 --profile qidian-male-longform`
    - `npm.cmd run quickstart -- create 作品名 --profile qidian-male-longform --dry-run`
- 当前 `quickstart` 会串起：
  - `workspace:init`
  - `books:init`
  - 基本协议可读性验证
  - 并输出 source-of-truth 文档路径与下一步建议
- 已新增闭环 smoke：
  - [quickstart-smoke.ts](/f:/AiFiction/packages/data/src/quickstart-smoke.ts)
  - 命令：`npm.cmd run quickstart:smoke`
- 当前 smoke 会验证：
  - 从空工作区直接创建 `workspace.yml`
  - starter profile 与 `topic-*` bundle 正确落到工作区
  - `book.yml`、占位 source-of-truth 文档与协议摘要都能直接拉起
  - 最终 `protocolStatus = ready`
- 本轮验证已通过：
  - `npm.cmd --workspace @aifiction/data run typecheck`
  - `npm.cmd --workspace @aifiction/data run quickstart:smoke`
  - `npm.cmd run encoding:check`
  - `npm.cmd run db:protocol-smoke`

## 2026-04-09 产品化大步 3：统一 Doctor / Repair 入口
- 已把 `quickstart` 收成统一入口：
  - `quickstart -- create`
  - `quickstart -- doctor`
  - `quickstart -- repair`
- 当前 `doctor` 会统一输出：
  - starter profile 与推荐 bundle
  - 当前工作区 bundle / strict mode
  - plugin doctor 摘要
  - 当前活动/默认/索引作品的协议状态与缺口
  - 下一步推荐动作
- 当前 `repair` 会统一执行：
  - compatibility bundle 归一化
  - 当前工作区作品协议 bootstrap
  - 缺失 placeholder source-of-truth 文档补齐
  - repair 后再次输出 doctor 摘要
- 已补 quickstart smoke 到完整闭环：
  - create
  - doctor
  - 人工打坏为 compatibility alias + 缺失 source doc
  - repair
  - 最终仍保持 `protocolStatus = ready`
- 本轮验证已通过：
  - `npm.cmd --workspace @aifiction/data run typecheck`
  - `npm.cmd --workspace @aifiction/data run quickstart:smoke`
  - `npm.cmd run quickstart:smoke`
  - `npm.cmd run encoding:check`
  - `npm.cmd run db:protocol-smoke`

## 完全插件化阶段看板
1. 阶段 1：插件底座与边界重定义
   状态：`completed`
2. 阶段 2：Manifest 与注册表
   状态：`completed`
3. 阶段 3：文档类型与抽取器插件化
   状态：`completed`
4. 阶段 4：上下文包与 Gate 插件化
   状态：`completed`
5. 阶段 5：Projection 与视图插件化
   状态：`completed`
6. 阶段 6：插件隔离、版本与冲突处理
   状态：`completed`
7. 阶段 7：插件打包、安装与工作区配置
   状态：`completed`
8. 阶段 8：迁移、回归与最终验收
   状态：`completed`

## 三个大步看板
1. 大步 1：插件底座批次
   对应阶段：`1 + 2`
   状态：`completed`
2. 大步 2：核心能力插件化批次
   对应阶段：`3 + 4 + 5`
   状态：`completed`
3. 大步 3：可用性与收官批次
   对应阶段：`6 + 7 + 8`
   状态：`completed`

## 当前主线
1. 通用数据库与通用叙事底座主线
2. 完全插件化收官后的产品化预备主线
3. 官方默认插件包与工作区体验优化主线

## 产品化三大步看板
1. 大步 1：题材插件包与默认能力批次
   状态：`completed`
2. 大步 2：样本库、Golden 与运维约束批次
   状态：`completed`
3. 大步 3：官方默认组合与对外可用性批次
   状态：`completed`

## 当前进行中
- 不处理页面。
- 不恢复旧小说正文主线。
- 完全插件化主线已完成，产品化三大步也已完成。
- 后续如继续推进，默认进入 backlog / 使用反馈 / 实际写作工作流，不再属于这 3 个既定大步。

## 关账后遗留与补充
1. `Windows smoke cleanup / SQLite EBUSY`
   状态：`backlog`
   说明：当前 smoke 本身通过，但临时工作区清理时偶发 `EBUSY`，已经有延迟清理兜底，后续可再做更彻底的句柄收束。
2. `quickstart 输出收束`
   状态：`backlog`
   说明：目前 `quickstart -- repair` 仍会透出部分底层 CLI 输出，可继续压成更适合普通用户的摘要式反馈。
3. `外放产品化能力`
   状态：`backlog`
   说明：插件目录、安装/升级体验、来源信任、签名与更完整的普通用户 UI 仍未纳入本轮三大步。
4. `更深的工作流统一入口`
   状态：`backlog`
   说明：当前统一入口已覆盖 `create / doctor / repair`，但更深的审校编排、批量工作流和 UI 引导仍可后续扩展。
5. `LangGraph / 智能体编排接入`
   状态：`parked`
   说明：方案可以先写，但整体接入计划暂时搁置，不进入当前主线。
   触发：
   - 现有真实写作流程已经稳定跑过至少 1 到 2 本书；
   - 当前 CLI / 协议 / 上下文链已经开始明显成为编排瓶颈；
   - 确实需要多节点状态流转、人工打回、重试或多智能体协作时，再正式开启。

## 下一步
1. 这 3 个既定大步已经关账，后续新增事项不再回灌。
2. 如果继续做平台侧，只进入新 backlog，例如 UI、目录、外放安装体验或实际使用反馈优化。
3. 如果继续做内容侧，就回到作品本身，用这套已经收好的底座开书、做设定和推进正文。
4. LangGraph 方案可保留为未来选项，但当前不启动接入实施。



## 2026-04-09 Hard Preflight Landed

Delivered:
- packages/data/src/preflight.ts
- packages/data/src/smoke-workspace.ts

Bound entrypoints:
- packages/data/src/quickstart.ts
- packages/data/src/init-workspace.ts
- packages/data/src/init-book.ts
- packages/data/src/plugins-cli.ts
- packages/data/src/protocol-smoke.ts
- packages/data/src/register-from-protocol.ts
- apps/worker/src/sync-runner.ts

Smoke coverage updated:
- workspace:init:smoke
- books:init:smoke
- quickstart:smoke
- starter:matrix:smoke
- migration:compat:smoke
- plugins:smoke
- plugins:matrix:smoke

Closed in this pass:
- Windows smoke cleanup / SQLite EBUSY now uses shared retry cleanup and no longer emits routine cleanup warnings on the serial smoke path.
- quickstart output now uses compact user-facing summaries for create / doctor / repair instead of raw JSON and nested CLI dumps.

Historical note:
- The older backlog lines for these two items remain above as trace history only; this block is the current status override.

## 2026-04-09 Backlog Trigger Rules

Deferred items should only be resumed when a trigger fires. They do not reopen completed phases by default.

1. External productization capabilities
   Trigger:
   - a second stable user starts using the system regularly;
   - the tool is being prepared for external delivery instead of internal-only use.
2. Deeper unified workflow entry
   Trigger:
   - at least 1 to 2 books have completed a real writing/review loop;
   - manual command stitching becomes the main source of friction.
3. Full UI guidance, plugin catalog, and install/upgrade flow
   Trigger:
   - ordinary users are expected to onboard without reading the codebase first;
   - plugin distribution or upgrade support becomes a real need.

## 2026-04-09 Setting-Only Source Of Truth Baseline

Delivered:
- `book.yml` and `book.template.yml` no longer pre-register `master_outline / active_volume_outline`.
- Default source-of-truth bootstrap now only auto-fills the four setting documents.
- Writing pack key anchors only render outline entries when they are explicitly present in protocol.

Verified:
- `books:init:smoke` now reports `Placeholder docs: 4`.
- `灰雾雇员` protocol re-registration no longer re-inserts `outline-master / outline-active-volume`.
- `writing-pack.latest.md` and `risk-investigation-pack.latest.md` no longer carry stale outline references during the setting-only phase.
