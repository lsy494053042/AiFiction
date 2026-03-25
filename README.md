# AiFiction

AiFiction 是一个面向个人创作的长篇网文工作台底座。
当前阶段已经进入“基础工作台成型期”，目标不是直接做自治 Agent，而是先把多作品管理、结构化资产、章节卡和后续生成链路的地基打稳。

## 当前已可用

- 首页读取真实的 V2 作品概览
- 首页直接创建作品
- 作品详情页查看分卷、角色、章节和关系预览
- 作品详情页创建分卷、角色、章节卡
- 作品详情页编辑作品、分卷、角色、章节卡
- 本地 SQLite 演示数据写入与读取
- Worker 预览链路和 V2 数据底座联通

## 核心文档

- `docs/operations/workbench-operations-manual.md`
- `docs/architecture/system-design.md`
- `docs/project/project-progress.md`

## 常用命令

```powershell
npm run dev:web
npm run dev:worker
npm run db:bootstrap
npm run db:v2-smoke
npm run typecheck
git -c safe.directory=F:/AiFiction push
```

## 当前说明

- `npm run dev:web` 现在走本地 Next 启动包装脚本，已经把 Next 14 在 workspace 下的 lockfile 修补噪音收敛掉了。
- `npm run typecheck` 现在是串行检查：`data -> worker -> web build`，这样不会再和 `.next/types` 的生成时机互相打架。