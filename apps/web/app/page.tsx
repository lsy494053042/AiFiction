import styles from "./page.module.css";
import { ProjectCatalogSection } from "../components/project-catalog-section";
import { getHomePageWorkbenchData } from "../lib/workbench";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workbenchData = await getHomePageWorkbenchData();

  return (
    <main className={styles.page}>
      <section className={styles.surface}>
        <header className={styles.header}>
          <p className={styles.brand}>AiFiction</p>
          <h1 className={styles.title}>书架</h1>
          <p className={styles.copy}>先找到书，再进入工作。正文、大纲、设定和待处理，都放在单本书里继续推进。</p>
        </header>

        <ProjectCatalogSection projects={workbenchData.projects} loadError={workbenchData.loadError} />
      </section>
    </main>
  );
}
