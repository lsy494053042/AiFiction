import { notFound } from "next/navigation";

import { NovelWorkbenchService, WorkspaceProtocolService } from "@aifiction/data";

import { WorkDetailShell } from "../../../../components/work-detail-shell";

export const dynamic = "force-dynamic";

const allowedViews = new Set(["overview", "manuscript", "outline", "characters", "settings", "issues"]);

interface WorkSectionPageProps {
  params: {
    slug: string;
    view: string;
  };
  searchParams?: {
    document?: string;
  };
}

export default async function WorkSectionPage({ params, searchParams }: WorkSectionPageProps) {
  const workbenchService = new NovelWorkbenchService();
  const protocolService = new WorkspaceProtocolService();
  const slug = decodeURIComponent(params.slug);
  const activeView = decodeURIComponent(params.view);
  const selectedDocumentKey = searchParams?.document ? decodeURIComponent(searchParams.document) : undefined;

  if (!allowedViews.has(activeView)) {
    notFound();
  }

  const chapterDocumentId = selectedDocumentKey?.startsWith("chapter:")
    ? selectedDocumentKey.replace("chapter:", "")
    : activeView === "manuscript"
      ? undefined
      : undefined;

  const outlineDocumentId = selectedDocumentKey?.startsWith("outline:")
    ? selectedDocumentKey.replace("outline:", "")
    : activeView === "outline"
      ? undefined
      : undefined;

  const [snapshot, protocolSummary, chapterWorkspace, outlineWorkspace] = await Promise.all([
    workbenchService.getProjectSnapshotBySlug(slug),
    protocolService.getWorkProtocolSummaryBySlug(slug),
    workbenchService.getProjectDocumentWorkspaceBySlug(slug, "chapter", chapterDocumentId),
    workbenchService.getProjectDocumentWorkspaceBySlug(slug, "outline", outlineDocumentId),
  ]);

  if (!snapshot) {
    notFound();
  }

  return (
    <WorkDetailShell
      snapshot={snapshot}
      protocolSummary={protocolSummary}
      chapterWorkspace={chapterWorkspace}
      outlineWorkspace={outlineWorkspace}
      activeView={activeView}
      selectedDocumentKey={selectedDocumentKey}
    />
  );
}
