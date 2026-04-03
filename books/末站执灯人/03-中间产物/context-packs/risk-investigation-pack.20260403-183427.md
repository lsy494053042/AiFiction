# 风险排查包：末站执灯人

- 生成时间：2026-04-03T10:34:27.968Z
- 风险标题：03-中间产物/context-packs/writing-pack.latest.md
- 风险性质：information-gap
- 风险级别：review
- 协议文件：F:/AiFiction/books/末站执灯人/book.yml

## 问题摘要
2 条待处理项 / export

## 风险原因
- 抽取预览的置信度低于低风险阈值。
- 当前文本里还没有提取到清晰的关系信号。
- 当前文本里还没有提取到明确的时间线标记。
- 摘要预览的置信度低于低风险阈值。
- Document hierarchy is deep and may need finer-grained splitting.

## 推荐动作
- 主动作：先判断这次是信息不足，还是需要补充正文后再重试。
- 先看抽取预览，确认角色、关系、伏笔和时间线命中是否合理。
- 回看原文关键段落，确认这次判断不是误读剧情。
- 等章节内容更完整后，再重新同步一次。
- 先看摘要预览，确认系统概括的方向没有跑偏。
- 如果正文本身就没写明，不要强行入库，先保留候选。
- 只有在后续章节补全后，再重新同步一次。

## 影响范围
- 秘密：当前文本里抽取到了 2 条新的伏笔信号。

## 建议回看章节
- 当前没有建议回看的章节。

## 证据
> - 生成时间：2026-04-03T06:34:27.239Z - 当前阶段：drafting - 当前焦点：复盘开篇第 1 至 10 章，规划第 11 至 20 章 - 目标：检查开篇承接、职业锚点、世界信息和关系起点是否清楚，再决...

## 最近来源引用
- source-document-extraction-preview / 03-中间产物/context-packs/writing-pack.latest.md
- source-document-analysis / 03-中间产物/context-packs/writing-pack.latest.md
- foreshadow-candidate-bundle / 03-中间产物/context-packs/writing-pack.latest.md
- character-candidate-bundle / 03-中间产物/context-packs/writing-pack.latest.md