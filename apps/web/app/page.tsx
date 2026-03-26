import Link from "next/link";

import { CreateWorkSection } from "../components/create-work-section";
import { ProjectCatalogSection } from "../components/project-catalog-section";
import { WorkspaceGuideSection } from "../components/workspace-guide-section";
import { getHomePageWorkbenchData } from "../lib/workbench";

export const dynamic = "force-dynamic";

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 首页现在优先展示作品工作区，而不是把大段介绍挡在前面。
 * 真正高频的入口只保留：作品概览、快速新建、帮助说明。
 */
export default async function HomePage() {
  const workbenchData = await getHomePageWorkbenchData();

  const projectCount = workbenchData.projects.length;
  const sourceCount = workbenchData.projects.reduce((total, project) => total + project.stats.sourceCount, 0);
  const pendingReviewCount = workbenchData.projects.reduce(
    (total, project) => total + project.stats.pendingReviewCount,
    0,
  );
  const focusHref = workbenchData.highlightedProject ? `/works/${workbenchData.highlightedProject.work.slug}` : "#quick-create";
  const focusLabel = workbenchData.highlightedProject ? "继续处理当前作品" : "快速创建第一本作品";

  return (
    <main className="page-shell workspace-home">
      <section className="content-card dashboard-header">
        <div className="dashboard-copy">
          <p className="eyebrow">Workspace</p>
          <h1 className="dashboard-title">先看作品，再决定同步与审查</h1>
          <p className="panel-copy">
            首页默认只保留正在使用的内容：作品概览、快速新建和帮助入口。说明信息不再占掉前面几屏。
          </p>
        </div>

        <div className="dashboard-side">
          <div className="stat-chip-row dashboard-chip-row">
            <span className="stat-chip">作品 {formatCount(projectCount)}</span>
            <span className="stat-chip">目录源 {formatCount(sourceCount)}</span>
            <span className="stat-chip">待审查 {formatCount(pendingReviewCount)}</span>
          </div>
          <Link className="action-link dashboard-link" href={focusHref}>
            {focusLabel}
          </Link>
        </div>
      </section>

      <ProjectCatalogSection
        projects={workbenchData.projects}
        highlightedProject={workbenchData.highlightedProject}
        loadError={workbenchData.loadError}
      />

      <section className="home-support-grid">
        <CreateWorkSection />
        <WorkspaceGuideSection />
      </section>
    </main>
  );
}