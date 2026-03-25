import {
  NovelWorkbenchService,
  type WorkbenchProjectSnapshot,
  type WorkbenchProjectSummary,
} from "@aifiction/data";

export interface HomePageWorkbenchData {
  projects: WorkbenchProjectSummary[];
  highlightedProject: WorkbenchProjectSnapshot | null;
  loadError?: string;
}

/**
 * 首页工作台数据入口。
 * 先把数据库查询收敛在本地 lib 中，页面层只消费已经整理好的数据结构。
 */
export async function getHomePageWorkbenchData(): Promise<HomePageWorkbenchData> {
  const workbenchService = new NovelWorkbenchService();

  try {
    const projects = await workbenchService.listProjectSummaries({ limit: 6 });
    const highlightedProject = projects[0]
      ? await workbenchService.getProjectSnapshotBySlug(projects[0].work.slug)
      : null;

    return {
      projects,
      highlightedProject,
    };
  } catch (error) {
    return {
      projects: [],
      highlightedProject: null,
      loadError: error instanceof Error ? error.message : "工作台数据读取失败。",
    };
  }
}