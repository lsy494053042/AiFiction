export function HeroPanel() {
  return (
    <section className="hero-panel">
      <p className="eyebrow">AiFiction</p>
      <h1>把长篇网文写作拆成一条可控的流水线</h1>
      <p className="hero-copy">
        这不是一个一开始就追求自治的 Agent 系统，而是一套先把作品资产、章节流程、数据库记忆和运行闸门做扎实的个人创作工作台。
      </p>
      <div className="hero-grid">
        <div className="metric-card">
          <span className="metric-value">6</span>
          <span className="metric-label">首版流程节点</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">5</span>
          <span className="metric-label">当前分层模块</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">1</span>
          <span className="metric-label">本地 SQLite 真相源</span>
        </div>
      </div>
    </section>
  );
}