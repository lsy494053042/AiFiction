# AiFiction 项目进度

最后更新：2026-04-14

## 2026-04-14 前 25 万字止损线重规划覆盖口径
- 本节优先级高于本文后面仍保留的旧运行记录；凡是和“卷三第 07 批已放行、直接续写 `0055-0064`”冲突的地方，一律以本节为准。
- 《灰雾雇员》当前总盘子改为 `100 万字以上`，上限暂不锁死；当前只细化并锁定前 `25 万字` 止损线结构。
- 当前默认执行入口已经切换，不再直接续写卷三旧批次正文；先做这三件事：
  1. 重锁前 `25 万字` 的四卷阶段结构，确认每一卷交付的是阶段胜利，不是只把一个事件继续磨长。
  2. 按新阶段结构重排卷三、卷四大纲，重新核定群像镜头、组织成长、系统开放、电量收益和节奏密度。
  3. 用新的止损线目标回扫 `0001-0054`，确认前两卷和卷三开头承接的是同一条阶段主线，而不是沿旧节奏继续外扩。
- 当前项目底座、插件链、数据库和协议链继续保留，不推倒重来；这一轮调整的是《灰雾雇员》的单书执行入口和阶段规划，不是重开一轮项目级重构。
- 卷后同步硬门禁不变：前一卷未完成整卷扫描、卷后复核和状态回写，后一卷不能视为正式放行。
- 当前完成以上三件事之前，不允许把“继续写 `0055-0064`”当成默认下一步。

## 当前状态
- 完全插件化与产品化三大步已经关账，当前默认主线回到《灰雾雇员》的内容生产与按卷同步。
- 当前这轮基础治理已完成 `第 1 步：冻结地基` 与 `第 2 步：跑通执行闭环`，`第 3 步：单书试点并收总尾` 已开始。
- 《灰雾雇员》当前正文 `0001-0054` 已完成一次全量风险扫描，第一批高风险收口已完成；后续继续推进前，先以这版正文为当前基线。
- 当前默认不处理 UI 和页面体验；除非用户明确切回平台 backlog，否则优先做内容侧推进与同步。

## 当前收口结论
- 项目不用推倒重来，保留已经做出来的通用底座，但停止“来一个问题补一层规则”的推进方式。
- 现在真正要收的是地基，不是继续堆历史补丁；以后所有新增问题都必须先判断它属于哪一层，而不是直接改核心。
- 当前统一分成四层处理：
  - `内核层`：跨作品稳定成立的通用能力，例如协议、实体、插件运行时、检查链、上下文链。
  - `题材/工作流层`：平台、题材、长短篇、试写规则、批处理节奏这类可复用规则包。
  - `单书层`：某一本书自己的设定、权限边界、文风、人物规则、剧情约束。
  - `运行时层`：某一卷、某一批、某一次扫描、某一次补丁、某一次复盘生成的临时产物。
- 今后不允许把单书问题直接污染内核层；先落单书层或运行时层，只有跨书重复出现并且稳定成立，才允许上升到题材层或内核层。

## 当前只做三件事
1. 冻结分层和准入规则。
   - 先把“什么问题该进哪一层”定死，后面所有优化都按这个口径收，不再边做边发散。
2. 跑通最小闭环。
   - 目标不是继续扩架构，而是先把这条链真正收稳：`核心文档 / 协议 / 单书真相源 -> 状态快照 -> 检查器 -> 写作上下文包 -> 正文推进`。
3. 用《灰雾雇员》做唯一试点验证。
   - 当前只拿这一本书验证流程是否闭环、规则是否可执行、扫描是否能收住；验证通过后，再把这套方法推广为默认开书方式。

## 当前优化固定执行计划
- 当前优化固定为 `3 步`，不再拆成“第一步第一轮、第二轮、第三轮”。
- 每一步都必须一次做完、一次关门；未达到完成标准，不进入下一步。
- 当前步骤状态：
  - `第 1 步：冻结地基`：已完成
  - `第 2 步：跑通执行闭环`：已完成
  - `第 3 步：单书试点并收总尾`：进行中
- 执行中发现的新遗漏、新想法、新优化点：
  - 如果会阻断当前步骤完成，就在当前步骤内一次收掉。
  - 如果不会阻断当前步骤完成，就统一记入最终收口清单，等 `第 3 步` 完成后再一起处理。
- 不再允许边做边新增主步骤，也不允许把已经定好的 3 步重新膨胀成无限子任务。

### 第 3 步当前进度
- 《灰雾雇员》当前正文全量扫描已完成首轮。
- 首轮扫描结果已落到运行时清单：
  - [卷二试点扫描与归层清单.md](/f:/AiFiction/books/灰雾雇员/03-中间产物/卷二试点扫描与归层清单.md)
- 当前初判：
  - 主要问题集中在 `单书层`
  - 存在一部分 `运行时层` 口径不一致问题
  - 暂无必须立刻改数据库结构的问题
- 当前已完成的试点动作：
  - 正文 `0001-0054` 全量风险扫描
  - 第一批高风险章节一次收口
  - `latest-review` 与 `latest-knowledge-candidates` 已刷新到当前真实状态
  - 当前正文基线重新冻结，避免继续带着旧口径往后写

### 第 1 步：冻结地基
- 目标
  - 把项目级边界、分层、准入、兼容、卷后门禁一次锁死。
- 本步必须收完的东西
  - 什么属于内核层、题材/工作流层、单书层、运行时层
  - 什么问题允许上升为项目级问题，什么问题只能留在单书或运行时
  - 绿地判断原则
  - 兼容保留原则
  - 卷后同步硬门禁
  - 当前唯一主线和 backlog 入口
- 本步完成标准
  - 项目级正式文档里已经有明确口径
  - 后续遇到问题时，能先按文档判断归属，而不是再靠聊天临时决定
  - 不再继续新增同类“项目到底怎么收”的讨论分支

### 第 2 步：跑通执行闭环
- 目标
  - 把“文档真相源 -> 协议状态 -> 结构化状态 -> 检查 -> 上下文包 -> 正文推进 -> 卷后同步”这条主链一次串通。
- 本步必须收完的东西
  - 核心文档、协议文档、单书真相源各自的职责边界
  - 写前、写中、卷后分别调用什么
  - 扫描、检查、回写、同步的默认入口
  - 哪些东西按组轻检，哪些东西必须卷后统一收
  - 当前项目里已有底座怎么接入这条主链，而不是继续散着用
- 本步完成标准
  - 能用一句稳定流程把整套运行逻辑说清楚
  - 新开一本书时，知道先做什么、后做什么、什么情况下不能继续往下走
  - 写一本正在进行的书时，知道正文推进和卷后同步分别怎么执行

### 第 3 步：单书试点并收总尾
- 目标
  - 只拿《灰雾雇员》把这套闭环跑一遍，并把当前遗留问题统一收口。
- 本步必须收完的东西
  - 用《灰雾雇员》验证卷级推进和卷后同步是否真能跑通
  - 把当前已经暴露出来的单书问题，按新分层口径重新归类
  - 把不该进项目层的问题留在单书层或运行时层
  - 把真正缺的项目级能力，汇总成最终补单，而不是边写边补
- 本步完成标准
  - 《灰雾雇员》可以按“正文推进 -> 卷后同步 -> 下一卷”稳定运转
  - 项目层、单书层、运行时层的边界不再混着用
  - 当前优化阶段正式关账；后续只允许按固定流程迭代，不再重开这一轮基础治理

## 项目级硬约束
- `绿地优先判断`
  - 以后所有新问题，先按没有历史包袱的理想结构判断归属，再决定怎么兼容落地。
  - 不允许用历史写法、旧补丁、当前正文里的临时表达，反向决定项目级架构。
- `兼容不是标准答案`
  - 现有项目里已经能用的协议链、实体层、插件底座、检查链和上下文链继续保留。
  - 兼容的意义是平滑过渡，不是让旧问题继续长期占住核心位置。
  - 凡是为了兼容而保留的旧口径，后续都必须能说明它最终准备落回哪一层，不能无限挂着。
- `单书问题不上升为核心问题`
  - 某一本书里的设定、文风、权限边界、叙述习惯、补丁规则，默认先落单书层。
  - 某一卷、某一批、某一次扫描、某一次修补产生的东西，默认只落运行时层。
  - 只有跨书重复出现、并且能稳定复用的问题，才允许提升到题材层或内核层。
- `卷后同步是硬门禁`
  - 一卷正文写完后，必须先完成整卷扫描、问题收口、设定回写、状态同步、必要的检查与入库，再允许进入下一卷。
  - 未完成卷后同步时，下一卷最多只能停留在准备态，不能视为正式放行。
- `主线收口优先于新增优化`
  - 只要这三件主线工作没有收完，新的优化建议默认先进 backlog，不直接改主链。
  - 后续新增问题，优先通过“归层判断 + 最小兼容落地 + 卷后统一回收”解决，不再边写边扩总架构。

## 保留 / 重写 / 停掉
- `保留`
  - 核心文档 `4 + 1`
  - `workspace.yml / book.yml` 协议链
  - 通用实体层、插件底座、上下文包和检查链
  - 现有 CLI、smoke、doctor、quickstart 这类产品化入口
- `重写`
  - 项目级分层治理方式
  - “问题出现以后该落哪一层”的准入规则
  - 从单书特例里抽通用规则的提升流程
  - 从“按问题补丁”改成“按层收束”的执行方式
- `停掉`
  - 单书问题直接改核心
  - 靠聊天结论长期代替正式文档
  - 每发现一个词、一个句式、一个设定点就额外开一套架构动作
  - 在没有完成卷后同步前，提前把下一卷当成正式放行

## 当前唯一主线
- 当前默认主线不是继续扩插件、扩页面、扩智能体，而是把上面的三件事收完。
- 在这三件事收完之前，新的优化建议默认只允许进入 backlog，不再直接进入主链。
- 对《灰雾雇员》来说，正文推进和卷后同步继续做；但项目级动作只能服务这条收口主线，不能再次散开。

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

## 2026-04-13 Volume Release Gate Gap

Issue:
- `灰雾雇员` 卷二正文仍残留明显元话语和卷次口吻，但文档与协议已经提前把卷二标成“卷后同步完成”，并直接放行卷三正文入口。

Root cause:
- 协议硬门只检查平台、字数、整卷规划、章节定位、批次章纲、预算与当前批次可写。
- 协议里没有“上一卷卷后复核完成 / 上一卷正文整卷扫描完成 / 上一卷卷后同步完成”三个硬门字段。
- 结果是文档一旦被提前写成完成态，数据库与协议链也不会额外拦住这类放行错误。

Fix:
- 已为协议补充上一卷复核、整卷扫描、卷后同步三个布尔门。
- 已把《灰雾雇员》卷三入口改回冻结状态，等待卷二复核后再放行。
- 后续卷切换必须同时满足三门全绿，缺一不可。

## 2026-04-13 Volume Two Sweep Progress

Historical note:
- 本节保留的是卷二收口前的扫描过程记录，最终正式结论以下一节 `Volume Two Closeout Completed` 为准。

Status:
- 卷二 `0027-0054` 仍保持“未收口、未放行”状态。
- 已完成一轮正文后半段语言复核，重点处理工程腔、后台口吻、卷次口吻和过硬的系统腔。

This pass covered:
- `0035 / 0037 / 0039 / 0041 / 0042 / 0043 / 0044 / 0045 / 0046 / 0047 / 0048 / 0049 / 0051 / 0052 / 0053`

Second pass covered:
- `0027 / 0028 / 0030 / 0031 / 0033 / 0034 / 0036 / 0039 / 0040 / 0043 / 0044 / 0046 / 0048 / 0049 / 0051 / 0052 / 0054`

Third pass covered:
- `0048 / 0049 / 0050 / 0051 / 0052 / 0053 / 0054`

Adjusted direction:
- 把“流程 / 前台 / 中段 / 跑流程 / 临调流程”等明显出戏表达，尽量压回剧情语境里的“路子 / 柜台 / 接手口子 / 正经手续 / 今夜接人”等自然说法。
- 系统面板保留机器感，人物对白改回更像人在现场说出来的话。
- 把前线感知层里的“周临那边”统一往“面板 / 灰字 / 任务短讯 / 耳机那头”收，避免把系统、灰鳞和周临写成一团。
- 把即时权限触发重新分层：系统负责弹冷字和状态，灰鳞只补成员口吻的人话，不替系统抢戏。
- 把 `0048-0054` 的卷尾行动段重新压回现场语境，减少“复盘稿 / 总结稿”味道，让卷末更像一夜刚结束时人物真正会落下来的反应。

Not finished yet:
- 这一轮只说明“卷二复核在进行中”，不代表卷后二次复核结束。
- `book.yml` 里卷三冻结状态保持不变，必须等卷二正文整卷扫描、卷后复核、卷后同步三项都收口后，才能重新放行。
- 卷二还欠“卷后二次复核 + 正式同步”。
- 进入下一步前，正文层面最该做的整段通读复核已经从 `0048-0054` 这一段收掉了。

## 2026-04-13 Volume Two Closeout Completed

Status:
- 卷二 `0027-0054` 已完成整卷正文扫描、卷后复核与卷后同步，正式收口。
- `books/灰雾雇员/book.yml` 已从“卷三入口冻结”切回“卷三第 07 批可开写”。
- [开写前检查清单.md](/f:/AiFiction/books/灰雾雇员/00-设定/开写前检查清单.md) 已重写为当前正式状态，不再保留会误导后续接手的旧阶段表述。
- [角色设定.md](/f:/AiFiction/books/灰雾雇员/00-设定/角色设定.md)、[世界设定.md](/f:/AiFiction/books/灰雾雇员/00-设定/世界设定.md)、[组织生态设定.md](/f:/AiFiction/books/灰雾雇员/00-设定/组织生态设定.md) 已复核，卷二结束后的正式状态已在这些真相源中保留，本轮不再为了“看起来同步过”而做无意义改写。

Historical note:
- 本节只保留 2026-04-13 当天的阶段结论。
- 自 2026-04-14 起，《灰雾雇员》已切换到“100 万字以上、先锁前 25 万字止损线”的新口径。
- 因此本节里关于“卷三第 07 批直接续写”的旧下一步，已经失效。

Next step:
- 以上旧下一步已被 `2026-04-14 前 25 万字止损线重规划覆盖口径` 替代。
- 当前正确入口：先重锁前 25 万字四卷结构，重做卷三卷四大纲，再决定 `0055-0064` 如何处理。
