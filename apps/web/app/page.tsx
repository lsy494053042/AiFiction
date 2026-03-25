import { CreateWorkSection } from "../components/create-work-section";
import { ProjectCatalogSection } from "../components/project-catalog-section";
import { ControlSection } from "../components/control-section";
import { HeroPanel } from "../components/hero-panel";
import { ModulesSection } from "../components/modules-section";
import { PipelineSection } from "../components/pipeline-section";
import { getHomePageWorkbenchData } from "../lib/workbench";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workbenchData = await getHomePageWorkbenchData();

  return (
    <main className="page-shell">
      <HeroPanel />

      <section className="section-grid">
        <PipelineSection />
        <ControlSection />
      </section>

      <ModulesSection />
      <CreateWorkSection />
      <ProjectCatalogSection
        projects={workbenchData.projects}
        highlightedProject={workbenchData.highlightedProject}
        loadError={workbenchData.loadError}
      />
    </main>
  );
}