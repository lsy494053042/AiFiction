import { NovelWorkbenchService, type WorkbenchProjectSummary } from "@aifiction/data";

export interface HomePageWorkbenchData {
  projects: WorkbenchProjectSummary[];
  loadError?: string;
}

export async function getHomePageWorkbenchData(): Promise<HomePageWorkbenchData> {
  const workbenchService = new NovelWorkbenchService();

  try {
    const projects = await workbenchService.listProjectSummaries({ limit: 24 });
    return { projects };
  } catch (error) {
    return {
      projects: [],
      loadError: error instanceof Error ? error.message : "工作台数据读取失败。",
    };
  }
}
