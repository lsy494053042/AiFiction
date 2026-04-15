# AiFiction 操作手册

最后更新：2026-04-09

## 1. 这份手册到底是干嘛的
这份手册只回答一件事：

**现在这套东西该怎么用。**

它不是讲底层原理的，也不是讲技术术语的。

你可以把 AiFiction 暂时理解成 4 层：
- `books/<作品>` 里的 Markdown 文档，是真正写书的地方。
- `workspace.yml` 和 `books/<作品>/book.yml`，是“系统现在处于什么阶段”的说明书。
- 数据层负责同步、生成写作包、风险包和一些结构化结果。
- 网页只是辅助查看，不是当前阶段的主入口。

一句话记住就行：

**文档是正文和设定本体，协议是当前状态，命令是辅助，不要倒过来。**

## 2. 新窗口进来先干什么
默认按下面顺序看：

1. [README.md](/f:/AiFiction/README.md)
2. [操作手册](/f:/AiFiction/docs/operations/workbench-operations-manual.md)
3. [系统设计](/f:/AiFiction/docs/architecture/system-design.md)
4. [项目进度](/f:/AiFiction/docs/project/project-progress.md)
5. [默认架构收口方案](/f:/AiFiction/docs/architecture/default-architecture-convergence.md)
6. [workspace.yml](/f:/AiFiction/workspace.yml)
7. 当前作品的 `book.yml`
8. 当前任务相关的作品设定、大纲、正文、上下文包

如果你只是继续当前这本书，不搞平台，不搞架构，可以压缩成：

1. 读核心文档
2. 读 `workspace.yml` 和当前 `book.yml`
3. 读当前作品真相源和最新运行产物

## 3. 现在最常见的 4 种活
当前阶段最重要的不是页面好不好看，而是：

- 文档别乱
- 协议别错
- 生成链别漂

你现在基本只会遇到下面 4 种工作。

### 3.1 搞平台和底层
什么时候算这类：
- 通用叙事底座
- 插件系统
- 数据层、同步链、上下文链

先看：
1. [系统设计](/f:/AiFiction/docs/architecture/system-design.md)
2. [默认架构收口方案](/f:/AiFiction/docs/architecture/default-architecture-convergence.md)
3. [项目进度](/f:/AiFiction/docs/project/project-progress.md)

### 3.2 整理设定和大纲
什么时候算这类：
- 作品定位
- 世界设定
- 角色设定
- 分卷
- 章纲

先看：
1. `workspace.yml`
2. 当前作品 `book.yml`
3. `books/<作品>/00-设定/*.md`
4. `books/<作品>/01-大纲/*.md`

补一句：
- 如果当前还没进大纲阶段，就只看设定，不要硬往卷纲上跳。
- 如果已经开卷，就先锁整卷章纲，再切当前批次章纲，不要回到“写几章补几章”。
- 新书正式落地前，先试写 10 章；试写整体过线，再正式回填大纲、章纲和协议状态。

### 3.3 写正文
什么时候算这类：
- 写新章
- 续写当前批次
- 校正文风、角色声音、承接关系

先看：
1. `workspace.yml`
2. 当前作品 `book.yml`
3. 当前卷的整卷章纲
4. 当前批次章纲
5. 最近正文
6. 当前 `writing-pack.latest.md`

### 3.4 排查问题和复盘
什么时候算这类：
- 连贯性排查
- gate 检查
- 知识层复盘

先看：
1. `workspace.yml`
2. 当前作品 `book.yml`
3. 当前 `risk-investigation-pack.latest.md`
4. 当前 review / 复盘记录

## 4. 页面现在怎么用
网页工作台现在主要拿来：
- 找到作品
- 查看设定、大纲、正文和投影视图
- 快速回忆当前状态
- 处理少量例外问题

现在不要把页面当成：
- 真相源
- 架构裁决入口
- 协议替代物
- 大规模编辑入口

一句话就是：

**页面拿来看，不拿来拍板。**

## 5. 你现在最可能照着走的流程

### 5.0 当前默认闭环

如果只记一条主链，就记这条：

`核心文档 / 协议 / 单书真相源 -> 状态快照 -> 检查 -> 上下文包 -> 正文推进 -> 卷后同步 -> 下一卷`

把它翻成大白话，就是下面 7 步：

1. `先重建上下文`
   - 先读核心文档，再读 `workspace.yml` 和当前作品 `book.yml`，最后按任务读这本书的设定、大纲、正文和运行产物。
   - 这一步不是走形式，而是为了先知道“系统现在跑到哪了”。

2. `写前先看真相源，不先看页面`
   - 先看整卷章纲、当前批次章纲、最近正文、必要设定。
   - 页面和工作台是辅助回忆，不是拍板入口。

3. `协议负责说明现在怎么跑`
   - `workspace.yml` 和 `book.yml` 管的是当前阶段、当前卷、当前批次、当前 gate 和当前焦点。
   - 它们不是正文仓库，也不负责替代作品真相源。

4. `数据层负责把当前状态整理出来`
   - 数据层不负责替你写书，它负责把文档和协议投影成结构化状态，方便检查、生成上下文包和做风险排查。
   - 你可以把它理解成“状态账本 + 索引层 + 检查层”。

5. `上下文包负责给当前任务凑最小工作集`
   - 写正文时，不是把整本书全塞进来，而是只拿这次任务真正要用的那部分。
   - 所以上下文包是运行时产物，不是真相源。

6. `正文默认按组推进，组后只轻检`
   - 正文默认按 `10` 章一组推进，连续性风险太高时才降到 `5` 章。
   - 一组写完后，先做轻量检查和接续确认，不在组后做正式卷后同步。

7. `一卷写完后，必须先卷后同步，才能进下一卷`
   - 先做整卷扫描。
   - 再收问题、回写设定和大纲。
   - 再同步状态、跑必要检查、确认下一卷入口。
   - 这些没做完，下一卷就不能正式放行。

这条链里每一层只干自己的事：

- 文档管真相
- 协议管当前状态
- 数据层管结构化状态
- 上下文包管当前任务最小工作集
- 正文管实际内容推进
- 卷后同步管关门和承上启下

### 5.1 新开一个窗口，继续接手
1. 先读核心文档。
2. 再读 `workspace.yml` 和当前作品 `book.yml`。
3. 再按任务读作品设定、大纲、正文或上下文包。
4. 确认当前主线、阶段和 gate 后再动手。

### 5.2 开一本新书
以前手工开书很麻烦，现在不要再那样做了。

现在默认直接走命令：

- 题材预设会自动带上对应的默认配置。
- 工作区插件组合会自动补，不用你手工拼。
- 新书默认只会补 4 份设定真相源：
  `作品定位 / 世界设定 / 角色设定 / 组织生态设定`
- `全书大纲 / 当前卷纲` 不会默认塞进协议，只有你真的进入大纲阶段才补。

1. 先列出可用 starter profile

```powershell
npm.cmd run books:init -- list-profiles
```

2. 再按 profile 生成新书骨架

```powershell
npm.cmd run books:init -- create 作品名 --profile qidian-male-longform
```

3. 如果只是预览，不想真正落盘

```powershell
npm.cmd run books:init -- create 作品名 --profile qidian-male-longform --dry-run
```

4. 如果工作区本身都还没初始化，先走：

```powershell
npm.cmd run workspace:init -- show-defaults
npm.cmd run workspace:init -- init --profile qidian-male-longform --workspace-name "AiFiction 工作区"
```

5. `workspace:init` 会自动把默认题材包写进工作区，不需要你再手工补配置。

6. 如果你后面只是想加一个题材包、删一个题材包，不要整段手改配置，优先用：

```powershell
npm.cmd run plugins:manage -- add-bundle topic-serial-experimental
npm.cmd run plugins:manage -- remove-bundle topic-serial-experimental
```

7. 创建完成后，先补 `00-设定`，再决定什么时候进 `01-大纲`，不要一上来就写正文。
8. 新书不要一上来就把全套正式协议锁死，先试写 `10` 章。
9. 这 `10` 章试写主要看三件事：能不能看、人物声线稳不稳、这本书自己的味道有没有立住。
10. 只有试写整体过线，才正式进入：
   - 全书大纲
   - 当前卷大纲
   - 整卷章纲
   - 批次章纲
   - 正式正文推进

### 5.3 继续写正文
1. 先确认当前批次和 gate。
2. 先看当前卷整卷章纲，确认这一章在整卷里的职责和阶段位置。
3. 再看当前批次章纲。
4. 再看最近正文和写作包。
5. 写完后再跑检查。

补一句硬规则：

- 每次开新卷，必须先把整卷章纲定下来。
- 每本新书，正式落地前必须先试写 10 章。
- 批次章纲只是整卷章纲的执行切片，不负责代替整卷规划。
- 如果没有整卷章纲，就不要开这一卷的正文。
- 正文默认按 10 章一组推进；如果这一组风险太高、信息量太重，才降到 5 章。
- 同一卷没写完，不要提前切到下一卷。
- 一组写完先复盘，再切下一组，不要今天写 3 章、明天又跳去补别处。

### 5.4 推进架构主线
1. 先确认当前阶段看板。
2. 先补文档，再改代码。
3. 改完后跑验证。
4. 回写 [项目进度](/f:/AiFiction/docs/project/project-progress.md)。

### 5.5 现阶段什么先别碰
- LangGraph / 智能体整体接入计划，先搁置。
- 外放产品化、插件目录、安装升级流，先放 backlog。
- 页面体验优化，暂时不是主线。

当前更实际的顺序是：
1. 先用现有底座把书写起来。
2. 真遇到流程瓶颈，再回头接智能体编排。

## 6. 当前阶段不建议做什么
当前默认不建议：
- 跳过核心文档，直接凭聊天结论开工。
- 用运行时产物替代真相源文档。
- 让单本书的问题反推核心 schema。
- 在核心文档里留过时书名、旧流程、乱码或脏内容。
- 把页面当成当前阶段的主入口。

## 7. 常用命令
### 启动
```powershell
npm.cmd run dev:web
npm.cmd run dev:worker
```

### 核心检查
```powershell
npm.cmd run encoding:check
npm.cmd run db:check
npm.cmd run db:protocol-smoke
```

### 插件与开书
```powershell
npm.cmd run workspace:init -- show-defaults
npm.cmd run workspace:init -- init --profile qidian-male-longform --workspace-name "AiFiction 工作区"
npm.cmd run workspace:init:smoke
npm.cmd run plugins:manage -- status
npm.cmd run plugins:manage -- doctor
npm.cmd run plugins:manage -- snapshot baseline
npm.cmd run plugins:manage -- history
npm.cmd run plugins:manage -- normalize-bundles
npm.cmd run plugins:manage -- add-bundle topic-serial-experimental
npm.cmd run plugins:manage -- remove-bundle topic-serial-experimental
npm.cmd run plugins:manage -- rollback SNAPSHOT_ID
npm.cmd run plugins:smoke
npm.cmd run plugins:matrix:smoke
npm.cmd run migration:compat:smoke
npm.cmd run quickstart -- list-profiles
npm.cmd run quickstart -- create 作品名 --profile qidian-male-longform
npm.cmd run quickstart -- create 作品名 --profile qidian-male-longform --dry-run
npm.cmd run quickstart -- doctor
npm.cmd run quickstart -- repair
npm.cmd run quickstart:smoke
npm.cmd run books:init -- list-profiles
npm.cmd run books:init -- create 作品名 --profile qidian-male-longform --dry-run
npm.cmd run books:init:smoke
npm.cmd run starter:matrix:smoke
```

`starter:matrix:smoke` 现在不只是跑通三套 starter profile，还会把生成结果和内置 golden 基线比对一遍，适合在继续调整题材插件包之前先防漂。
`plugins:matrix:smoke` 现在不只跑静态 runtime 场景，还会补跑 `compatibility normalize / conflicting topic rollback / invalid upgrade rollback / strict toggle roundtrip` 这几类 ops 场景，对 runtime、doctor 和快照计数做 golden 比对，适合在继续补 bundle、冲突规则和运维约束前先防漂。
`migration:compat:smoke` 现在会验证旧工作区缺失 `plugins / book_starters` 时的 bootstrap 回补，以及旧 `source_of_truth` 固定字段向注册文档数组的迁移兼容，适合在继续动协议与迁移入口前先防漂。
`quickstart` 现在已经是统一入口：
- `quickstart -- create`：串起 `workspace:init + books:init + 协议可读性验证`
- `quickstart -- doctor`：统一输出 starter profile、bundle、plugin doctor、协议状态和下一步建议
- `quickstart -- repair`：统一做 compatibility bundle 归一化、协议 bootstrap、占位 source document 补齐，再回到 doctor 摘要
- `quickstart:smoke` 会验证这条链从空工作区 create 到 doctor，再到 repair 后仍能保持 `protocol = ready`
- 新建作品默认只补齐 `4` 份设定真相源：`作品定位 / 世界设定 / 角色设定 / 组织生态设定`
- `全书大纲 / 当前卷纲` 不再作为默认 source-of-truth 预注册；只有显式进入大纲阶段后才补入协议

当前 bundle 口径：
- 默认优先使用 `topic-*` 官方题材包。
- `topic-*` 会组合 `official-default-authoring` 和对应题材 overlay。
- `topic-*` 官方题材包按当前规则是互斥的，同一工作区不应长期并存多套不同题材 topic bundle。
- 旧的 `starter-*` bundle 继续保留，但只作为兼容 alias，不再是推荐入口。

插件运维口径：
- `plugins:manage` 的配置变更会自动写入 `storage/plugin-config-history/` 快照历史。
- `plugins:manage -- doctor` 会输出当前工作区插件诊断、阻断项和建议动作。
- `plugins:manage -- normalize-bundles` 会把旧 `starter-*` compatibility bundle 升级成推荐的 `topic-*` 官方题材包。
- 当检测到互斥 `topic-*` 同时启用时，`doctor` 会明确指出冲突 bundle，并建议只保留一套或直接回滚。
- `plugins:manage -- rollback SNAPSHOT_ID` 只回滚 `workspace.yml > plugins`，适合处理 bundle 组合或 strict mode 配错。

### 写作检查
```powershell
npm.cmd run writing:meta-check -- --dir books/作品名/02-正文 --from 起始章号 --to 结束章号
npm.cmd run writing:budget-check -- --book-root books/作品名
```

## 8. 只记一句话的话
**先按核心文档和协议重建上下文，再按当前任务读取作品文档和运行产物，不要跳读，也不要凭印象。**

## 2026-04-09 Hard Entry Checks

These commands now run hard preflight before execution:
- quickstart
- workspace:init
- books:init
- plugins:manage
- db:register-from-protocol
- db:protocol-smoke
- worker:sync

If blocked, check for missing core docs, missing workspace.yml, missing target book.yml, or a missing backlog section in project-progress.md.

Operational note: SQLite-heavy commands should still be run serially. Do not parallelize register, smoke, or migration commands against the same DB.

## 9. 通用流程和单书特化，到底怎么分

这套流程不是只给《灰雾雇员》写死的。

要分成两层理解：

### 9.1 通用流程

所有书默认都走这条大流程：

1. 先锁平台、总字数、止损线、章均字数。
2. 新书先试写 10 章，试写不过线，不进正式大纲和协议定稿。
3. 先做设定，再做全书大纲，再做卷大纲，再做整卷章节定位表。
4. 开新卷前，必须先锁整卷章纲；没有整卷章纲，不开这一卷正文。
5. 正文默认按 10 章一批推进；只有连续性风险太高时，才降到 5 章。
6. 一组正文写完只做轻量检查和接续确认，不做正式同步。
7. 一卷写完先整卷复核，再统一同步设定、状态和下一卷入口；卷后同步没完成，不准进入下一卷。

这部分是通用工作流，所有书都该服从。

### 9.2 单书特化

每本书自己的东西，落在作品文档和作品协议里，例如：

- 是男频还是女频
- 总盘子是 100 万还是 30 万
- 主角是幕后中枢还是一线视角
- 这本书专属写作卡是什么
- 当前卷是什么，当前批次是什么

这些不属于通用规则，属于单书运行参数。

一句大白话：

- 通用流程决定“怎么写一本书”
- 单书特化决定“这一本书具体怎么跑”

## 10. 插件和数据库，到底分别干什么

很多时候容易把这两个东西混在一起，其实它们不是一回事。

### 10.1 插件是什么

插件负责“决定系统有哪些能力、默认怎么开、不同题材怎么套默认规则”。

它更像：

- 功能包
- 题材包
- 默认规则包
- 工作流能力开关

比如：

- `topic-qidian-male-longform` 这种，决定起点男频长篇默认怎么起步
- starter profile 决定新书默认字数、止损线、批次节奏、硬约束

所以插件解决的是：

- 新书怎么快速起盘
- 工作区默认启哪些能力
- 不同题材怎么用不同默认配置

### 10.2 数据库是什么

数据库不负责决定题材，也不负责决定写法。

数据库负责的是“把文档和协议投影成结构化状态，方便同步、检查、生成上下文包和做风险排查”。

它更像：

- 状态仓库
- 索引层
- 检查层
- 投影层

所以数据库解决的是：

- 当前作品现在进行到哪一步
- 哪些对象、关系、批次、复盘已经存在
- 能不能稳定生成 writing pack / risk pack
- 能不能做协议检查、连续性检查、预算检查

### 10.3 两者关系

插件决定“系统能做什么、默认怎么做”。

数据库决定“当前这些东西实际处于什么状态、能不能被稳定消费”。

再说白一点：

- 插件像规则和功能包
- 数据库像账本和索引
- 文档才是小说本体

## 11. 组内轻检查和卷后强制同步

从现在开始，这一条按硬规则执行，不再靠“想起来再做”。

### 11.1 一组正文写完后，只做轻检查

1. 跑基础检查：至少 `encoding:check`，需要时再跑写作检查。
2. 判断这一批新增了哪些“稳定事实”。
3. 如果只是临时现场细节，不回写设定。
4. 如果已经出现明显冲突、失控风险或重大设定补丁，先记下来，等卷末统一收。
5. 确认下一步只是继续本卷正文，不切下一卷协议状态。

### 11.2 卷写完后必须收

1. 先做整卷复核。
2. 做一遍正文整卷扫描，重点扫作者后台口吻、卷次口吻、元话语、系统话太重、承上启下是否像人话。
3. 回写卷大纲、卷章节定位表、角色设定、世界设定、组织生态设定。
4. 更新 `book.yml` 当前卷、当前章、当前 focus、当前批次状态。
5. 明确下一卷入口，不允许靠聊天记忆口头续。
6. 卷后同步没有完成前，下一卷正文不得开写。

### 11.3 哪些东西不准跳过

- 不准只写正文，不改协议状态。
- 不准只改聊天结论，不回写真相源文档。
- 不准卷已经切换了，`book.yml` 还停在上一卷。
- 不准把同步动作继续当成“可做可不做”的附属动作。
- 不准把 10 章分组误当成正式同步节点；分组只是产出节奏，不是卷切换依据。
- 不准在上一卷正文整卷扫描未完成时，把下一卷改成 `ready-to-write`。
