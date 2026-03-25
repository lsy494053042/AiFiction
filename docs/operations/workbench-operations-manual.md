# AiFiction 操作手册

最后更新：2026-03-25

## 1. 当前可用功能

### 1.1 本地网页工作台

当前 Web 已经进入“基础工作台”阶段。
现在可以做：

- 首页查看真实的 V2 作品概览
- 首页直接创建作品
- 进入作品详情页
- 在作品详情页创建分卷
- 在作品详情页创建角色
- 在作品详情页创建章节卡
- 在作品详情页编辑作品配置
- 在作品详情页编辑已有分卷
- 在作品详情页编辑已有角色
- 在作品详情页编辑已有章节卡
- 查看作品的角色、分卷、章节和关系预览

当前还不能做：

- 删除作品 / 分卷 / 角色 / 章节
- 完整关系图谱交互编辑
- 真实模型生成正文
- Worker 主链路完全切到 V2

启动命令：

```powershell
npm run dev:web
```

访问地址：

```text
http://localhost:3000
```

### 1.2 Worker 预览链路

Worker 目前仍然可以跑通章节预览流程。
推荐命令：

```powershell
npm run dev:worker
```

### 1.3 数据库与演示数据

当前数据库默认是本地 SQLite：

```text
storage/db/aifiction.sqlite
```

推荐命令：

```powershell
npm run db:bootstrap
npm run db:v2-smoke
npm run typecheck
```

说明：

- `db:v2-smoke` 会写入一套演示作品数据，方便首页和详情页直接看到真实内容
- `typecheck` 现在会串行执行 `data -> worker -> web build`，这是为了兼容 Next 的 `.next/types` 生成方式

### 1.4 Git 与远端同步

当前远端：

```text
git@github-lsy494053042:lsy494053042/AiFiction.git
```

常用命令：

```powershell
git -c safe.directory=F:/AiFiction status --short --branch
git -c safe.directory=F:/AiFiction push
```

## 2. 当前推荐操作顺序

1. 运行 `npm run db:v2-smoke`
2. 运行 `npm run dev:web`
3. 在首页创建一部新作品
4. 进入作品详情页补分卷、角色和章节卡
5. 继续用详情页的编辑表单修正作品控制信息
6. 再进入下一步的删除能力、图谱页和 Worker V2 接入

## 3. 关于当前 Next 提示

之前 `next dev` 在 workspace 下会尝试自动修补 lockfile，并打印一串误导性的报错。
当前已经通过本地包装脚本收敛掉这类噪音。

结论：

- 它不是页面功能错误
- 它是 Next 14 在 workspace 场景下的开发期兼容噪音
- 当前项目已经改成更稳定的本地启动方式