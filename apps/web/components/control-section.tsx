import { controlPillars, runtimeNotes } from "./home-data";

export function ControlSection() {
  return (
    <article className="content-card">
      <div className="section-heading">
        <p>Control</p>
        <h2>为什么这套东西能稳住长篇</h2>
      </div>
      <div className="pillar-list">
        {controlPillars.map((pillar) => (
          <div className="pillar-card" key={pillar.title}>
            <strong>{pillar.title}</strong>
            <p>{pillar.detail}</p>
          </div>
        ))}
      </div>

      <div className="section-heading section-heading-sub">
        <p>Runtime</p>
        <h2>当前运行方式</h2>
      </div>
      <div className="pillar-list">
        {runtimeNotes.map((note) => (
          <div className="pillar-card" key={note.title}>
            <strong>{note.title}</strong>
            <p>{note.detail}</p>
          </div>
        ))}
      </div>
    </article>
  );
}