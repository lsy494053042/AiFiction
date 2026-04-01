# 前端话语转换指引

这份文档只管一件事：把系统内部词，转换成用户能一眼看懂的人话。

## 原则
- 先说结果，再说原因。
- 先说问题，再说系统判断。
- 不直接把 review bundle、confidence、extraction、protocol 这类词暴露给用户。
- 同一个概念，在页面里尽量只保留一种叫法。

## 当前转换
- `待处理项`：需要你拍板的例外
- `factual-conflict`：前后写法打架了
- `information-gap`：这里的信息还不够
- `format-blocker`：文档结构需要整理
- `confidence-review`：系统还不太敢确定
- `review-extraction-preview`：先核对系统抓到的重点是不是对的
- `inspect-source-text`：先回看原文，看是不是写得太含糊
- `retry-after-more-content`：可以先继续往后写，等信息更完整再判断
- `review-summary-preview`：先看系统整理出来的摘要再决定

## 后续补充方式
- 先在真实页面里验证。
- 新出现的系统词，优先记到这里，再决定是否要沉到公共组件或数据层映射里。
- 这份文档只写稳定说法，不写临时文案试验。
