# AiFiction

AiFiction 是一个面向长篇小说创作的本地工作系统。

它的基本分工是：

- 文件：保存设定、大纲、正文
- 协议：保存当前作品、当前批次、gate、工作流状态
- 数据库：保存结构化状态与知识闭环
- 页面：展示投影视图，不是真相源

## 当前主文档

架构、数据库边界、知识系统、冻结线，统一看这里：

- [系统设计与数据库冻结清单](docs/architecture/system-design.md)

## 目录结构

```text
books/
  作品名/
    book.yml
    00-设定/
    01-大纲/
    02-正文/
    03-中间产物/

templates/
  protocol/
  writing/

packages/
  data/

apps/
  web/
  worker/
```

## 默认工作流

1. 先在 `books/作品名/01-大纲` 做整卷规划
2. 在 `workspace.yml` 和 `book.yml` 里确认当前批次与 gate
3. 再写 `02-正文`
4. 写完一批后跑检查和批次复盘
5. 由知识系统沉淀 finding、candidate、profile、gate 结果

## 常用命令

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

### 写作检查

```powershell
npm.cmd run writing:meta-check -- --dir books/作品名/02-正文 --from 起始章号 --to 结束章号
npm.cmd run writing:budget-check -- --book-root books/作品名
```

## 当前原则

- 先整卷规划，再开正文
- 先验证，再宣布完成
- 先查根因，再决定重写还是重规划
- 核心数据库按通用信息结构设计，不按题材设计

## 备注

- `books/` 目录属于项目的一部分，会跟代码一起提交
- 目录使用相对工作区路径，不绑定固定盘符
