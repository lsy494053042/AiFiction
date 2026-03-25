import Link from "next/link";

import type { WorkbenchProjectSnapshot, WorkbenchProjectSummary } from "@aifiction/data";

interface ProjectCatalogSectionProps {
  projects: WorkbenchProjectSummary[];
  highlightedProject: WorkbenchProjectSnapshot | null;
  loadError?: string;
}

const statusLabelMap: Record<string, string> = {
  planning: "规划中",
  serializing: "连载中",
  completed: "已完结",
  archived: "已归档",
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 首页的作品概览区。
 * 这层先把作品摘要和关系图谱预览接进来，为后续详情页和图谱页打前站。
 */
export function ProjectCatalogSection({
  projects,
  highlightedProject,
  loadError,
}: ProjectCatalogSectionProps) {
  if (loadError) {
    return (
      <section className="content-card wide-card">
        <div className="section-heading">
          <p>Projects</p>
          <h2>工作台数据读取失败</h2>
        </div>
        <div className="empty-state">
          <strong>当前还没成功读到 V2 数据。</strong>
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  if (!projects.length) {
    return (
      <section className="content-card wide-card">
        <div className="section-heading">
          <p>Projects</p>
          <h2>V2 作品入口已经预留好</h2>
        </div>
        <div className="empty-state">
          <strong>当前数据库里还没有作品数据。</strong>
          <p>可以先运行 <code>npm run db:v2-smoke</code>，让首页拿到第一批真实的作品、角色和章节概览。</p>
        </div>
      </section>
    );
  }

  const highlightedVolumes = highlightedProject?.volumes.slice(0, 3) ?? [];
  const relationPreview = highlightedProject?.graph.edges.slice(0, 6) ?? [];

  return (
    <section className="content-card wide-card">
      <div className="section-heading">
        <p>Projects</p>
        <h2>首页已经开始读取真实的 V2 作品概览</h2>
      </div>

      <div className="project-workbench-grid">
        <div className="project-card-stack">
          {projects.map((project) => (
            <article className="project-card" key={project.work.id}>
              <div className="project-card-top">
                <strong>{project.work.title}</strong>
                <span className="status-badge">{statusLabelMap[project.work.status] ?? project.work.status}</span>
              </div>
              <p className="project-copy">{project.work.tagline}</p>
              <p className="project-meta">
                {project.work.genre}
                {project.work.subgenre ? ` · ${project.work.subgenre}` : ""}
                {` · ${project.work.targetPlatform}`}
              </p>
              <div className="stat-chip-row">
                <span className="stat-chip">角色 {formatCount(project.stats.characterCount)}</span>
                <span className="stat-chip">卷 {formatCount(project.stats.volumeCount)}</span>
                <span className="stat-chip">章 {formatCount(project.stats.chapterCount)}</span>
                <span className="stat-chip">关系 {formatCount(project.stats.relationCount)}</span>
              </div>
              <p className="project-meta subtle-text">
                最近一章：{project.latestChapterTitle ?? "尚未建立章节"}
              </p>
              <Link className="action-link" href={`/works/${project.work.slug}`}>
                进入作品详情
              </Link>
            </article>
          ))}
        </div>

        <div className="project-focus-panel">
          <div className="section-heading">
            <p>Focus</p>
            <h2>{highlightedProject?.work.title ?? "等待作品数据"}</h2>
          </div>

          {highlightedProject ? (
            <>
              <p className="project-copy">{highlightedProject.work.tagline}</p>
              <div className="stat-chip-row">
                <span className="stat-chip">伏笔 {formatCount(highlightedProject.stats.foreshadowCount)}</span>
                <span className="stat-chip">关系边 {formatCount(highlightedProject.graph.edges.length)}</span>
                <span className="stat-chip">角色节点 {formatCount(highlightedProject.graph.nodes.length)}</span>
              </div>

              <div className="mini-section">
                <strong>当前卷概览</strong>
                <ul className="mini-list">
                  {highlightedVolumes.map((volume) => (
                    <li key={volume.id}>
                      <span>{`卷 ${volume.order}`}</span>
                      <p>{volume.title}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mini-section">
                <strong>角色关系预览</strong>
                {relationPreview.length ? (
                  <ul className="relation-list">
                    {relationPreview.map((relation) => (
                      <li key={`${relation.sourceCharacterId}:${relation.targetCharacterId}:${relation.publicLabel}`}>
                        <strong>{relation.sourceCharacterName} → {relation.targetCharacterName}</strong>
                        <p>
                          {relation.publicLabel}
                          {relation.privateLabel ? ` / ${relation.privateLabel}` : ""}
                          {` · 信任 ${relation.trustLevel} · 张力 ${relation.tensionLevel}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state compact-state">
                    <p>当前作品还没有可展示的结构化关系边。</p>
                  </div>
                )}
              </div>

              <div className="mini-section">
                <strong>章节推进锚点</strong>
                <p className="project-meta">
                  最近一章：{highlightedProject.latestChapter?.title ?? "尚未建立章节"}
                </p>
                <p className="project-copy compact-copy">
                  {highlightedProject.latestChapter?.summary ?? "当章节开始接入更多 CRUD 后，这里会继续扩成章节详情入口。"}
                </p>
                <Link className="action-link" href={`/works/${highlightedProject.work.slug}`}>
                  查看这本书的完整工作台
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}