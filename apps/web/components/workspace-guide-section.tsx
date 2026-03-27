const guideGroups = [
  {
    label: "默认流程",
    title: "先同步，再审查，最后只在必要时手动修正",
    items: [
      "先把本地正文目录绑定到作品上。",
      "系统会扫描新增或修改章节，自动生成摘要、抽取候选和待审查项。",
      "你主要在工作台里判断这些结果是否合理，而不是手动维护全部资产。",
    ],
  },
  {
    label: "首页原则",
    title: "首页只保留最常用的三件事",
    items: [
      "看作品总览。",
      "快速创建新作品。",
      "按需查看帮助说明，而不是先看三四屏介绍。",
    ],
  },
  {
    label: "当前边界",
    title: "现在系统已经能自动做的事",
    items: [
      "识别目录中的新增和修改文件。",
      "生成摘要预览、结构化抽取预览和待审查项。",
      "把通过审查的角色、关系、伏笔和时间线候选回写到结构化资产层。",
    ],
  },
];

export function WorkspaceGuideSection() {
  return (
    <section className="content-card" id="workspace-guide">
      <div className="section-heading">
        <p>帮助</p>
        <h2>帮助与设计说明</h2>
      </div>
      <p className="panel-copy">说明信息默认后置，只有在你想确认设计思路时再展开查看。</p>

      <details className="manual-details guide-details">
        <summary>展开帮助说明</summary>
        <div className="guide-grid">
          {guideGroups.map((group) => (
            <section className="guide-card" key={group.title}>
              <p className="eyebrow guide-eyebrow">{group.label}</p>
              <h3>{group.title}</h3>
              <ul className="guide-list">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </section>
  );
}