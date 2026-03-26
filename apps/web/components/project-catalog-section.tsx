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
 * 首页作品总览。
 * 默认先把作品目录和当前聚焦作品抬到最前面，减少介绍性内容对操作区的干扰。
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
          <h2>作品总览暂时读不到数据</h2>
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
          <h2>先创建第一本作品</h2>
        </div>
        <div className="empty-state">
          <strong>当前数据库里还没有作品数据。</strong>
          <p>你可以先用下面的快速创建入口建一本书，或者先运行 <code>npm run db:v2-smoke</code> 看演示数据。</p>
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
        <h2>作品总览</h2>
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
                <span className="stat-chip">分卷 {formatCount(project.stats.volumeCount)}</span>
                <span className="stat-chip">章节 {formatCount(project.stats.chapterCount)}</span>
                <span className="stat-chip">待审查 {formatCount(project.stats.pendingReviewCount)}</span>
              </div>
              <p className="project-meta subtle-text">
                最近一章：{project.latestChapterTitle ?? "还没有章节"}
              </p>
              <Link className="action-link" href={`/works/${project.work.slug}`}>
                进入这本书
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
                <span className="stat-chip">目录源 {formatCount(highlightedProject.stats.sourceCount)}</span>
                <span className="stat-chip">待审查 {formatCount(highlightedProject.stats.pendingReviewCount)}</span>
                <span className="stat-chip">关系边 {formatCount(highlightedProject.graph.edges.length)}</span>
              </div>

              <div className="mini-section">
                <strong>当前分卷</strong>
                <ul className="mini-list">
                  {highlightedVolumes.length ? (
                    highlightedVolumes.map((volume) => (
                      <li key={volume.id}>
                        <span>{`卷 ${volume.order}`}</span>
                        <p>{volume.title}</p>
                      </li>
                    ))
                  ) : (
                    <li>
                      <p>当前还没有分卷数据。</p>
                    </li>
                  )}
                </ul>
              </div>

              <div className="mini-section">
                <strong>关系预览</strong>
                {relationPreview.length ? (
                  <ul className="relation-list">
                    {relationPreview.map((relation) => (
                      <li key={`${relation.sourceCharacterId}:${relation.targetCharacterId}:${relation.publicLabel}`}>
                        <strong>
                          {relation.sourceCharacterName} → {relation.targetCharacterName}
                        </strong>
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
                <strong>章节推进</strong>
                <p className="project-meta">
                  最近一章：{highlightedProject.latestChapter?.title ?? "还没有章节"}
                </p>
                <p className="project-copy compact-copy">
                  {highlightedProject.latestChapter?.summary ?? "接下来优先通过目录同步和审查结果，逐步把章节事实维护起来。"}
                </p>
                <Link className="action-link" href={`/works/${highlightedProject.work.slug}`}>
                  进入当前聚焦作品
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}