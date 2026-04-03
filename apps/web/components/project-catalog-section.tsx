"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import type { WorkbenchProjectSummary } from "@aifiction/data";

import { CreateWorkSection } from "./create-work-section";
import styles from "./project-catalog-section.module.css";

interface ProjectCatalogSectionProps {
  projects: WorkbenchProjectSummary[];
  loadError?: string;
}

type ShelfFilter = "all" | "attention";

const text = {
  searchLabel: "搜索作品",
  searchPlaceholder: "搜索书名、题材、平台或最近章节",
  all: "全部作品",
  attention: "需要先处理",
  chapter: "章节",
  pending: "待确认",
  latest: "最近章节",
  emptyTitle: "先创建第一本书",
  emptyCopy: "当前还没有作品，先新建一本书，再进作品里补正文、大纲和设定。",
  noResult: "当前筛选下没有作品，换个关键词试试。",
  loadErrorTitle: "暂时还没读到作品数据",
};

const statusLabelMap: Record<string, string> = {
  planning: "规划中",
  serializing: "连载中",
  completed: "已完结",
  archived: "已归档",
};

const coverGradients = [
  "linear-gradient(160deg, #3b2a24 0%, #896449 100%)",
  "linear-gradient(160deg, #222d39 0%, #587797 100%)",
  "linear-gradient(160deg, #2e2337 0%, #7962a6 100%)",
  "linear-gradient(160deg, #2f3324 0%, #6f8053 100%)",
  "linear-gradient(160deg, #3a2526 0%, #94656b 100%)",
];

function requiresAttention(project: WorkbenchProjectSummary): boolean {
  return project.stats.pendingReviewCount > 0 || project.stats.sourceCount === 0;
}

function matchesSearch(project: WorkbenchProjectSummary, keyword: string): boolean {
  if (!keyword) return true;

  const haystack = [
    project.work.title,
    project.work.tagline,
    project.work.genre,
    project.work.subgenre || "",
    project.work.targetPlatform,
    project.latestChapterTitle || "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(keyword);
}

function getCoverImage(project: WorkbenchProjectSummary): string | null {
  const work = project.work as {
    coverImageUrl?: string;
    coverImage?: string;
    coverUrl?: string;
  };

  return work.coverImageUrl ?? work.coverImage ?? work.coverUrl ?? null;
}

function buildCardStyle(project: WorkbenchProjectSummary) {
  const image = getCoverImage(project);
  if (image) {
    return { backgroundImage: `url("${image}")` };
  }

  const hash = [...project.work.title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return { backgroundImage: coverGradients[hash % coverGradients.length] || coverGradients[0] };
}

export function ProjectCatalogSection({ projects, loadError }: ProjectCatalogSectionProps) {
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState<ShelfFilter>("all");
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  if (loadError) {
    return (
      <section className={styles.surface}>
        <div className={styles.empty}>
          <strong>{text.loadErrorTitle}</strong>
          <p>{loadError}</p>
        </div>
      </section>
    );
  }

  const filteredProjects = [...projects]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .filter((project) => (activeFilter === "attention" ? requiresAttention(project) : true))
    .filter((project) => matchesSearch(project, deferredSearch));

  return (
    <section className={styles.surface}>
      <div className={styles.toolbar}>
        <div className={styles.searchRow}>
          <label className={styles.searchField}>
            <span className={styles.searchLabel}>{text.searchLabel}</span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={text.searchPlaceholder}
            />
          </label>
          <CreateWorkSection />
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filter} ${activeFilter === "all" ? styles.filterActive : ""}`.trim()}
            onClick={() => setActiveFilter("all")}
          >
            {text.all}
          </button>
          <button
            type="button"
            className={`${styles.filter} ${activeFilter === "attention" ? styles.filterActive : ""}`.trim()}
            onClick={() => setActiveFilter("attention")}
          >
            {text.attention}
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className={styles.empty}>
          <strong>{text.emptyTitle}</strong>
          <p>{text.emptyCopy}</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className={styles.empty}>
          <p>{text.noResult}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredProjects.map((project) => (
            <Link className={styles.cardLink} href={`/works/${project.work.slug}/overview`} key={project.work.id}>
              <article className={styles.card} style={buildCardStyle(project)}>
                <div className={styles.cardShade} />
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <span className={styles.status}>{statusLabelMap[project.work.status] || project.work.status}</span>
                  </div>

                  <div className={styles.cardBottom}>
                    <h2 className={styles.title}>{project.work.title}</h2>
                    <p className={styles.meta}>
                      {project.work.genre}
                      {project.work.subgenre ? ` / ${project.work.subgenre}` : ""}
                      {` / ${project.work.targetPlatform}`}
                    </p>
                    <p className={styles.tagline}>{project.work.tagline}</p>
                    <div className={styles.chips}>
                      <span className={styles.chip}>{`${text.chapter} ${project.stats.chapterCount}`}</span>
                      <span className={styles.chip}>{`${text.pending} ${project.stats.pendingReviewCount}`}</span>
                    </div>
                    <p className={styles.latest}>{`${text.latest}：${project.latestChapterTitle || "暂未同步"}`}</p>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
