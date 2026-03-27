"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import type { WorkbenchProjectSnapshot, WorkbenchProjectSummary } from "@aifiction/data";

interface ProjectCatalogSectionProps {
  projects: WorkbenchProjectSummary[];
  highlightedProject: WorkbenchProjectSnapshot | null;
  loadError?: string;
}

type ShelfFilter = "all" | "attention" | "recent";

const statusLabelMap: Record<string, string> = {
  planning: "规划中",
  serializing: "连载中",
  completed: "已完结",
  archived: "已归档",
};

const shelfFilters: Array<{ key: ShelfFilter; label: string }> = [
  { key: "all", label: "全部作品" },
  { key: "attention", label: "优先处理" },
  { key: "recent", label: "最近更新" },
];

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function requiresAttention(project: WorkbenchProjectSummary): boolean {
  return project.stats.pendingReviewCount > 0 || project.stats.sourceCount === 0;
}

function matchesSearch(project: WorkbenchProjectSummary, keyword: string): boolean {
  if (!keyword) {
    return true;
  }

  const haystack = [
    project.work.title,
    project.work.tagline,
    project.work.genre,
    project.work.subgenre ?? "",
    project.work.targetPlatform,
    project.latestChapterTitle ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(keyword);
}

// Bookshelf shell for the homepage.
export function ProjectCatalogSection({
  projects,
  highlightedProject,
  loadError,
}: ProjectCatalogSectionProps) {
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState<ShelfFilter>("all");
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  if (loadError) {
    return (
      <section className="content-card bookshelf-panel" id="bookshelf">
        <div className="section-heading">
          <p>Bookshelf</p>
          <h2>{"书架暂时读不到数据"}</h2>
        </div>
        <div className="empty-state">
          <strong>{"当前还没成功读到 V2 数据。"}</strong>
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  if (!projects.length) {
    return (
      <section className="content-card bookshelf-panel" id="bookshelf">
        <div className="section-heading">
          <p>Bookshelf</p>
          <h2>{"先把第一本书放进书架"}</h2>
        </div>
        <div className="empty-state">
          <strong>{"当前数据库里还没有作品数据。"}</strong>
          <p>
            {"你可以先用下面的快速创建入口建一本书，或者先运行 "}
            <code>npm run db:v2-smoke</code>
            {" 看演示数据。"}
          </p>
        </div>
      </section>
    );
  }

  const orderedProjects = [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const filteredProjects = orderedProjects
    .filter((project) => {
      if (activeFilter === "attention") {
        return requiresAttention(project);
      }
      if (activeFilter === "recent") {
        return Boolean(project.latestChapterTitle || project.updatedAt);
      }
      return true;
    })
    .filter((project) => matchesSearch(project, deferredSearch));

  const attentionProjects = orderedProjects.filter(requiresAttention).slice(0, 4);
  const focusProject = highlightedProject;
  const focusVolumes = focusProject?.volumes.slice(0, 3) ?? [];
  const focusChapter = focusProject?.latestChapter;

  return (
    <section className="content-card bookshelf-panel" id="bookshelf">
      <div className="bookshelf-toolbar">
        <div>
          <p className="eyebrow">Bookshelf</p>
          <h2>{"作品书架"}</h2>
          <p className="panel-copy">{"你主要在这里找到作品、看当前状态，并快速决定下一步进入哪本书。"}</p>
        </div>

        <div className="bookshelf-search-block">
          <label className="workspace-search-field">
            <span>{"搜索作品"}</span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={"搜索书名、题材、平台或最近章节"}
            />
          </label>
          <div className="bookshelf-filter-row" role="tablist" aria-label={"书架筛选"}>
            {shelfFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`bookshelf-filter ${activeFilter === filter.key ? "is-active" : ""}`}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bookshelf-layout">
        <div className="bookshelf-grid-area">
          <div className="bookshelf-caption-row">
            <p className="bookshelf-caption">
              {"当前显示 "}
              <strong>{formatCount(filteredProjects.length)}</strong>
              {" 本作品"}
            </p>
            {deferredSearch ? (
              <p className="bookshelf-caption subtle-text">{`${"搜索："}${deferredSearch}`}</p>
            ) : null}
          </div>

          {filteredProjects.length ? (
            <div className="bookshelf-grid">
              {filteredProjects.map((project) => (
                <article className="bookshelf-book" key={project.work.id}>
                  <div className="book-head">
                    <div>
                      <strong>{project.work.title}</strong>
                      <p className="book-meta">
                        {project.work.genre}
                        {project.work.subgenre ? ` · ${project.work.subgenre}` : ""}
                        {` · ${project.work.targetPlatform}`}
                      </p>
                    </div>
                    <span className="status-badge">{statusLabelMap[project.work.status] ?? project.work.status}</span>
                  </div>

                  <p className="book-tagline">{project.work.tagline}</p>

                  <div className="stat-chip-row book-chip-row">
                    <span className="stat-chip">{`章节 ${formatCount(project.stats.chapterCount)}`}</span>
                    <span className="stat-chip">{`角色 ${formatCount(project.stats.characterCount)}`}</span>
                    <span className="stat-chip">{`待处理 ${formatCount(project.stats.pendingReviewCount)}`}</span>
                  </div>

                  <div className="book-footer">
                    <p className="book-meta subtle-text">
                      {`${"最近章节："}${project.latestChapterTitle ?? "还没有章节"}`}
                    </p>
                    <Link className="action-link" href={`/works/${project.work.slug}`}>
                      {"打开作品"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-state bookshelf-empty">
              <strong>{"当前筛选结果为空。"}</strong>
              <p>{"可以试试清空搜索词，或者切回“全部作品”。"}</p>
            </div>
          )}
        </div>

        <aside className="bookshelf-side-rail">
          <article className="focus-card">
            <div className="section-heading">
              <p>Focus</p>
              <h2>{focusProject?.work.title ?? "等待作品焦点"}</h2>
            </div>
            {focusProject ? (
              <>
                <p className="panel-copy">{focusProject.work.tagline}</p>
                <div className="stat-chip-row compact-chip-row">
                  <span className="stat-chip">{`目录源 ${formatCount(focusProject.stats.sourceCount)}`}</span>
                  <span className="stat-chip">{`待处理 ${formatCount(focusProject.stats.pendingReviewCount)}`}</span>
                  <span className="stat-chip">{`关系 ${formatCount(focusProject.graph.edges.length)}`}</span>
                </div>
                <div className="mini-section">
                  <strong>{"当前分卷"}</strong>
                  <ul className="mini-list">
                    {focusVolumes.length ? (
                      focusVolumes.map((volume) => (
                        <li key={volume.id}>
                          <span>{`卷 ${volume.order}`}</span>
                          <p>{volume.title}</p>
                        </li>
                      ))
                    ) : (
                      <li>
                        <p>{"当前还没有分卷数据。"}</p>
                      </li>
                    )}
                  </ul>
                </div>
                <div className="mini-section">
                  <strong>{"最近章节"}</strong>
                  <p className="book-meta">{focusChapter?.title ?? "还没有章节"}</p>
                  <p className="panel-copy compact-copy">
                    {focusChapter?.summary ?? "先通过自动同步和审查，把章节事实逐步沉淀下来。"}
                  </p>
                  <Link className="action-link" href={`/works/${focusProject.work.slug}`}>
                    {"继续处理这本书"}
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty-state compact-state">
                <p>{"当前还没有可聚焦的作品。"}</p>
              </div>
            )}
          </article>

          <article className="focus-card">
            <div className="section-heading">
              <p>Attention</p>
              <h2>{"优先处理"}</h2>
            </div>
            {attentionProjects.length ? (
              <ul className="attention-list">
                {attentionProjects.map((project) => (
                  <li key={project.work.id}>
                    <div>
                      <strong>{project.work.title}</strong>
                      <p className="book-meta subtle-text">
                        {`待处理 ${formatCount(project.stats.pendingReviewCount)} · 目录源 ${formatCount(project.stats.sourceCount)}`}
                      </p>
                    </div>
                    <Link className="ghost-link" href={`/works/${project.work.slug}`}>
                      {"进入"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state compact-state">
                <p>{"当前没有高优先级待处理作品，可以继续正常创作。"}</p>
              </div>
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}
