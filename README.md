# AiFiction

AiFiction 是一个面向个人长篇网文创作的工作台。

它现在的定位不是“全自动写书系统”，而是：

- 你在 `VSCode + Codex` 里创作
- 本地目录保存设定、大纲、正文
- 协议文件负责告诉系统“这本书在哪、现在写到哪”
- 数据库负责保存结构化状态
- 网页工作台负责查看作品和处理少量例外

一句话：

**你负责创作和拍板，系统负责同步、整理、提示。**

## 当前到底做到了什么

已经落下来的主线能力：

- 真实作品目录结构已经跑起来了
- 《末站执灯人》已经建立了正式作品目录、协议文件和章节内容
- 本地文件 -> 协议锚点 -> 数据库 -> 工作台 这条链已经打通
- 数据库已经能存角色、别名、关系、伏笔、时间线、同步记录、待处理项、来源引用
- 工作台已经能读取作品、读取正文/大纲/设定、显示待处理项
- 新建作品弹窗、书架首页、单书页路由已经接好

当前仍在收口的部分：

- 前端可见层正在重做
- 本轮重点不是继续加功能，而是把首页、单书页、工作区、待处理页做成真正能用的界面

## 这项目现在怎么工作

项目现在分成 4 层。

### 1. 创作文件层

这是你真正写的内容。

- 设定
- 大纲
- 正文

默认放在：

```text
books/作品名/
```

例如：

```text
books/
  末站执灯人/
    00-设定/
    01-大纲/
    02-正文/
```

### 2. 协议锚点层

这层只负责“入口和定位”，不是数据库。

核心文件：

- `workspace.yml`
- `books/作品名/book.yml`

它们回答的问题是：

- 当前有哪些书
- 这本书在哪
- 当前写到哪
- 当前焦点任务是什么

### 3. 数据库层

当前用的是本地 SQLite。

数据库不是拿来替代正文的，它的作用是：

- 保存结构化事实
- 记录同步过程
- 给工作台和 Codex 提供稳定上下文

当前已经落地的数据类型包括：

- 角色
- 角色别名
- 角色关系
- 世界规则
- 分卷
- 章节结构
- 伏笔
- 时间线事件
- 文件来源
- 文档快照
- 同步 run
- 候选更新
- 审查队列
- 正式复核任务状态
- 来源引用

### 4. 工作台层

就是 Web + Worker。

它负责：

- 同步本地目录
- 阅读正文 / 大纲 / 设定
- 展示作品状态
- 暴露少量需要处理的例外

## 数据库到底在这里起什么作用

很多时候最容易误解的就是这一点。

数据库 **不是** 用来直接写小说的。

数据库主要负责三件事：

### 1. 把长篇小说拆成可查询的结构化状态

比如：

- 角色是谁
- 角色有哪些别名
- 谁和谁是什么关系
- 哪些伏笔埋下了
- 哪些时间线事件已经出现

### 2. 记录同步和审查

比如：

- 哪个文件改了
- 哪次同步扫到了什么
- 系统提了哪些候选更新
- 哪些需要你确认
- 哪些已经自动处理

### 3. 给工作台和 Codex 提供稳定上下文

比如：

- 当前写到第几卷第几章
- 当前卷目标是什么
- 最近章节是什么
- 当前待处理项是什么

所以更准确的理解是：

- **文件** 负责创作内容
- **协议** 负责入口和定位
- **数据库** 负责结构化控制
- **网页** 负责查看和处理例外

## 我是怎么工作的

我现在不是“直接对数据库写书”。

我的实际工作顺序是：

1. 先读作品文件
   - 设定
   - 大纲
   - 正文
   - 写作卡

2. 再读协议锚点
   - 当前是哪本书
   - 写到哪一卷哪一章
   - 当前焦点任务是什么

3. 必要时再读数据库读模型
   - 最近章节摘要
   - 角色状态
   - 待处理项
   - 来源引用

4. 然后产出内容
   - 设定
   - 大纲
   - 正文
   - 页面结构
   - 工作流方案

5. 定版内容优先落回文件
   - 不是直接把聊天内容塞进数据库
   - 而是先写进 `books/...`
   - 再由同步链和工作台吸收结构化信息

## 你现在最推荐怎么用

当前阶段最推荐的真实使用方式：

1. 在 `VSCode` 里和 Codex 讨论作品
2. 定版后把内容落到 `books/作品名/`
3. 用网页工作台查看这本书
4. 看正文、看大纲、看设定
5. 只在有明显冲突或高风险变化时处理待处理项

也就是说：

**网页工作台现在不是主写作界面，而是作品控制台。**

## 当前推荐的目录结构

```text
books/
  末站执灯人/
    book.yml
    00-设定/
      作品定位.md
      世界设定.md
      角色设定.md
      文风与写作卡.md
    01-大纲/
      全书大纲.md
      卷一大纲.md
      卷二大纲.md
      章节规划.md
      卷二章节规划.md
    02-正文/
      0001-没有车灯的列车.md
      ...
    03-中间产物/
      context-packs/
```

说明：

- 这里只定目录，不定磁盘
- 无论项目现在在 `F:`、`D:` 还是其他盘，规则都是“相对工作区根目录”

## 当前正式页面和路由

当前正式 Web 入口：

- `/`
- `/works/[slug]`
- `/works/[slug]/[view]`

当前单书页拆成这些视图：

- `overview`
- `manuscript`
- `outline`
- `characters`
- `settings`
- `issues`

当前产品目标不是“把所有东西塞进一个页面”，而是：

- 首页只做书架
- 单书页只做作品控制
- 工作区直接读 `设定 / 大纲 / 正文`
- 待处理只做例外处理

## 关键服务文件

如果你想快速知道项目当前核心逻辑在哪，先看这些：

- [workspace-protocol.service.ts](f:\AiFiction\packages\data\src\protocol\workspace-protocol.service.ts)
- [novel-workbench.service.ts](f:\AiFiction\packages\data\src\workbench\novel-workbench.service.ts)
- [novel-project-sync.service.ts](f:\AiFiction\packages\data\src\sync\novel-project-sync.service.ts)
- [review-queue.service.ts](f:\AiFiction\packages\data\src\sync\review-queue.service.ts)
- [narrative-schema.ts](f:\AiFiction\packages\data\src\v2\narrative-schema.ts)
- [sync-schema.ts](f:\AiFiction\packages\data\src\v2\sync-schema.ts)

## 当前项目重点

当前项目重点不是再加一堆新机制，而是两件事：

1. 真实用《末站执灯人》继续写下去
2. 把前端可见层重做干净

也就是说，当前状态不是“底层还没搭完”，而是：

**底层已经够用，现在重点是把前端和实际工作流收口。**

## 常用命令

### 启动网页

```powershell
npm.cmd run dev:web
```

作用：

- 启动 Web 工作台
- 默认地址是 `http://localhost:8080/`
- 日常最常用的一条命令

什么时候用：

- 你要看书架
- 你要进单本书页面
- 你要查看正文 / 大纲 / 设定 / 待处理

### 启动 Worker 监听

```powershell
npm.cmd run dev:worker
```

作用：

- 启动 Worker 的开发监听
- 主要用于同步、后台任务、调试数据链路

什么时候用：

- 你要调试同步流程
- 你要看 Worker 侧日志
- 你在改 `apps/worker` 相关逻辑

### 检查机器上下文

```powershell
npm.cmd run machine:context
```

作用：

- 输出当前机器的工作区、路径、SSH、数据库等上下文
- 用来确认当前电脑上的环境是不是对的

什么时候用：

- 换电脑后第一次打开项目
- 你怀疑路径、仓库、端口或数据库位置不对

### 检查中文编码

```powershell
npm.cmd run encoding:check
```

作用：

- 检查项目里是否有编码异常、乱码风险文件
- 这是现在的必跑检查之一

什么时候用：

- 改完文档
- 改完含中文文案的页面
- 你怀疑文件被控制台或脚本打坏

### 跑协议 smoke

```powershell
npm.cmd run db:protocol-smoke
```

作用：

- 检查 `workspace.yml / book.yml / 上下文包` 这一条协议链是不是通的

什么时候用：

- 改了协议服务
- 改了 `workspace.yml`
- 改了 `book.yml`
- 改了上下文包生成逻辑

### 跑同步 smoke

```powershell
npm.cmd run db:sync-smoke
```

作用：

- 检查“文件来源 -> 同步 -> 候选更新 -> 待处理”这条同步链是不是通的

什么时候用：

- 改了同步逻辑
- 改了 review queue
- 改了数据层同步 schema

### 跑数据库基础 smoke

```powershell
npm.cmd run db:v2-smoke
```

作用：

- 检查 V2 数据层基础是否正常
- 更偏底层完整性验证

什么时候用：

- 改了 schema
- 改了 repository
- 改了 bootstrap

### 生成数据库迁移 / 变更

```powershell
npm.cmd run db:generate
```

作用：

- 基于当前 Drizzle schema 生成数据库迁移文件

什么时候用：

- 你新增表
- 你改表字段
- 你改索引或约束

### 检查数据层类型

```powershell
npm.cmd run db:check
```

作用：

- 只检查 `packages/data` 的类型是否正常

什么时候用：

- 你只改了数据层
- 不想一口气跑全项目 typecheck

### 检查 Worker 类型

```powershell
npm.cmd run worker:check
```

作用：

- 只检查 `apps/worker` 的类型

什么时候用：

- 你只改了 Worker

### 检查 Web 构建

```powershell
npm.cmd run web:check
```

作用：

- 直接跑 Web build
- 这是目前判断前端是否真能出包的主要检查

什么时候用：

- 你改了页面
- 你改了路由
- 你改了前端组件结构

### 跑全项目检查

```powershell
npm.cmd run typecheck
```

作用：

- 串行执行：
  - `db:check`
  - `worker:check`
  - `web:check`

什么时候用：

- 一轮改动收尾时
- 准备提交前
- 你想确认这一轮改动没有明显断链

### 手动触发一次同步

```powershell
npm.cmd run worker:sync -- --slug 作品-slug
```

作用：

- 直接运行 Worker 的同步入口
- 用来手动推进某本书的同步

什么时候用：

- 你改了本地文件，想立刻同步
- 你在调试单本书的同步问题

### 检查当前批次正文有没有元语言问题

```powershell
npm.cmd run writing:meta-check -- --dir books/作品名/02-正文 --from 起始章号 --to 结束章号
```

作用：

- 检查正文里是否出现：
  - 阶段说明腔
  - 卷末总结腔
  - 跳出正文的元语言

什么时候用：

- 每批正文写完后立刻跑
- 这是现在正文生产流程的固定检查

## 常见场景

下面这些是当前最常见、最实用的实际场景。

### 1. 换电脑后第一次启动项目

按这个顺序：

```powershell
npm.cmd run machine:context
npm.cmd run encoding:check
npm.cmd run dev:web
```

这三步分别用来：

- 确认当前机器路径、工作区、数据库上下文
- 确认中文文件没有编码问题
- 启动网页工作台

### 2. 新开一本书

你现在最推荐的流程是：

1. 在 `VSCode + Codex` 里先定作品方向
2. 用首页的“新建作品”弹窗建书
3. 把设定、大纲、正文落进 `books/作品名/`
4. 回网页里看这本书

通常你不用先跑很多命令，只需要：

```powershell
npm.cmd run dev:web
```

### 3. 继续写一本现有的书

最常见的工作流是：

1. 在 `VSCode` 里继续和 Codex 写
2. 正文定版后保存到 `books/作品名/02-正文/`
3. 回网页里看总览、工作区、待处理

如果你改完正文后想手动推进一次同步，可以跑：

```powershell
npm.cmd run worker:sync -- --slug 作品-slug
```

### 4. 一批正文写完后

正文现在默认不是写完就算结束，而是要做一轮最小检查。

推荐顺序：

```powershell
npm.cmd run writing:meta-check -- --dir books/作品名/02-正文 --from 起始章号 --to 结束章号
npm.cmd run encoding:check
```

这两步分别用来：

- 检查有没有阶段说明腔、卷末总结腔、跳出正文的元语言
- 检查中文编码有没有被打坏

### 5. 改完前端页面后

推荐顺序：

```powershell
npm.cmd run encoding:check
npm.cmd run web:check
```

如果你正在开发态中看页面：

```powershell
npm.cmd run dev:web
```

这样你就能确认：

- 文案没被打坏
- Web 真的能构建通过

### 6. 改完数据层 / schema 后

推荐顺序：

```powershell
npm.cmd run db:generate
npm.cmd run db:v2-smoke
npm.cmd run db:sync-smoke
```

如果你只想先看类型有没有坏：

```powershell
npm.cmd run db:check
```

### 7. 改完协议文件或上下文包逻辑后

推荐顺序：

```powershell
npm.cmd run db:protocol-smoke
```

这个场景主要包括：

- 改 `workspace.yml`
- 改 `book.yml`
- 改协议服务
- 改上下文包生成逻辑

### 8. 一轮改动准备收尾时

如果你想确认这轮不是只改了一半，最稳的检查顺序是：

```powershell
npm.cmd run encoding:check
npm.cmd run typecheck
```

这一组会帮你确认：

- 中文没坏
- 数据层没断
- Worker 没断
- Web 构建没断

## 核心文档

- [系统设计](f:\AiFiction\docs\architecture\system-design.md)
- [操作手册](f:\AiFiction\docs\operations\workbench-operations-manual.md)
- [项目进度](f:\AiFiction\docs\project\project-progress.md)

## 当前一句话状态

**文件是真正的创作源，协议负责定位，数据库负责结构化控制，网页负责查看和处理例外，而我负责在这些层之间帮你把书真正写出来。**
