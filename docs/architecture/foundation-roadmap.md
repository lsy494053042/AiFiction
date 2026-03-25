# 底座路线图

## 当前状态

### 已完成

- Web / Worker / Core / Schemas 基础骨架
- SQLite 本地数据库落地
- Provider 抽象与 Preview provider
- 章节工作流基础链路
- V1 数据层可运行 demo
- 数据库 V2 结构确认
- repository 接口分层
- artifact/version 统一层落地
- prompt template version 结构落地
- V2 repository 与本地 smoke 验证

### 已识别但未完成

- V1 -> V2 切换策略
- Worker 改走 V2 repository
- CRUD / API / server actions 入口
- 真实模型 provider
- 应用层正式接管 artifact/version 与 prompt registry

## 下一阶段优先级

### P0

- V1 -> V2 双写或模块级切换策略
- 作品管理、角色管理、章节管理的基础读写入口
- 从 V2 数据层读取工作流上下文
- 让 artifact/version 与 prompt registry 进入真实工作流链路

### P1

- 作品管理页、角色管理页、章节管理页
- 运行记录查看入口
- prompt registry 管理入口

### P2

- 真实模型 provider 接入
- 连续性审校结构化输出
- Worker 主流程迁移到 V2

### P3

- Agent / LangGraph 接入
- 更细的记忆检索策略
- 自动重试、人工打回与分支版本

## 现在不急着做重的部分

- 多用户权限系统
- 复杂缓存体系
- 向量数据库独立部署
- 自动联网采风
- 大规模评测平台

## 当前建议

在真正接大规模前端 CRUD 和真实模型调用前，先把 P0 做扎实。

原因：

- 现在 V2 底层已经能写能读，正适合开始应用层接线
- 如果先堆页面而不定切换策略，V1 / V2 会一起变复杂
- 现在推进 CRUD 和 V2 接入，后面模型层和 Agent 层会顺很多
