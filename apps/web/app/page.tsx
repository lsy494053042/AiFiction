import { CreateWorkSection } from "../components/create-work-section";
import { ProjectCatalogSection } from "../components/project-catalog-section";
import { WorkspaceGuideSection } from "../components/workspace-guide-section";
import { WorkspaceTopbar } from "../components/workspace-topbar";
import { getHomePageWorkbenchData } from "../lib/workbench";

export const dynamic = "force-dynamic";

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

// Stage 4.5 homepage: remove oversized hero and turn the page into a usable desk shell.
export default async function HomePage() {
  const workbenchData = await getHomePageWorkbenchData();

  const projectCount = workbenchData.projects.length;
  const sourceCount = workbenchData.projects.reduce((total, project) => total + project.stats.sourceCount, 0);
  const pendingReviewCount = workbenchData.projects.reduce(
    (total, project) => total + project.stats.pendingReviewCount,
    0,
  );
  const focusHref = workbenchData.highlightedProject ? `/works/${workbenchData.highlightedProject.work.slug}` : "#quick-create";
  const focusLabel = workbenchData.highlightedProject
    ? "回到当前作品"
    : "创建第一本作品";

  return (
    <main className="page-shell workspace-home">
      <WorkspaceTopbar
        projectCount={projectCount}
        sourceCount={sourceCount}
        pendingReviewCount={pendingReviewCount}
        focusHref={focusHref}
        focusLabel={focusLabel}
      />

      <section className="workspace-summary-strip" aria-label={"工作台摘要"}>
        <article className="content-card summary-card summary-card-wide">
          <p className="eyebrow">Desk</p>
          <h1 className="summary-title">{"先定位作品，再决定今天要处理什么"}</h1>
          <p className="panel-copy">
            {"首页现在优先服务“找书、看状态、继续处理”。说明和补充信息全部后置，不再挡住真正的工作区。"}
          </p>
        </article>
        <article className="content-card summary-card">
          <p className="eyebrow">Projects</p>
          <strong className="summary-value">{formatCount(projectCount)}</strong>
          <p className="summary-copy">{"当前作品数"}</p>
        </article>
        <article className="content-card summary-card">
          <p className="eyebrow">Sources</p>
          <strong className="summary-value">{formatCount(sourceCount)}</strong>
          <p className="summary-copy">{"已绑定目录源"}</p>
        </article>
        <article className="content-card summary-card">
          <p className="eyebrow">Review</p>
          <strong className="summary-value">{formatCount(pendingReviewCount)}</strong>
          <p className="summary-copy">{"待处理审查"}</p>
        </article>
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
