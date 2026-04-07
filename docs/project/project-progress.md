# AiFiction 项目进度

最后更新：2026-04-04

## 当前状态
- 当前工作区没有活动小说。
- 当前主线是通用数据库与知识系统落地，不处理页面，不推进正文。
- 空工作区协议可正常运行，协议 smoke 在无活动作品时直接通过。

## 已完成
- 文件 / 协议 / 数据库 / 上下文包 / 页面 的职责边界已冻结到主文档。
- 写作知识系统 V1 最小闭环已完成。
- 通用实体层与面板扩展层已正式落地到 schema 与 migration：
  - `entities_v2`
  - `entity_aliases_v2`
  - `entity_edges_v2`
  - `panel_templates_v2`
  - `panel_fields_v2`
  - `entity_panel_values_v2`
  - `entity_state_events_v2`
  - `tag_taxonomies_v2`
  - `entity_tags_v2`
  - `task_templates_v2`
  - `task_requirements_v2`
  - `task_assignments_v2`
  - `entity_task_matches_v2`
- 通用实体仓储已补齐最小读写能力：
  - 实体
  - 关系
  - 面板模板 / 字段 / 值
  - 标签分类 / 标签值
  - 任务模板 / 要求 / 指派 / 匹配
- 最小 service 入口已补齐：
  - `GenericEntityWorkbenchService`
- 工作台读模型已接入通用实体层：
  - 通用实体摘要
  - 标签分类投影
  - 任务模板摘要
  - 面板值 / 标签 / 匹配统计
- 写作包已开始消费通用实体层：
  - 当前相关通用实体
  - 标签投影
  - 任务与匹配投影
- 验证链已跑通：
  - `db:check`
  - `db:v2-smoke`
  - `db:sync-smoke`
  - `db:protocol-smoke`
  - `encoding:check`

## 当前主线
1. 通用数据库主线
2. 后续新作品冷启动主线

## 当前进行中
- 不处理页面。
- 不恢复旧小说。
- 优先把通用实体层从“最小可运行”推进到“可被工作台、写作包、后续冷启动稳定消费”。

## 下一步
1. 把通用实体层进一步接入后续上下文包，不只停留在写作包与工作台读模型。
2. 在空工作区前提下继续做回归，确保新增能力不会重新绑定到具体小说样例。
3. 再决定是否把这套投影视图接进页面，而不是反过来让页面驱动底层结构。
