import { ControlSection } from "../components/control-section";
import { HeroPanel } from "../components/hero-panel";
import { ModulesSection } from "../components/modules-section";
import { PipelineSection } from "../components/pipeline-section";

export default function HomePage() {
  return (
    <main className="page-shell">
      <HeroPanel />

      <section className="section-grid">
        <PipelineSection />
        <ControlSection />
      </section>

      <ModulesSection />
    </main>
  );
}