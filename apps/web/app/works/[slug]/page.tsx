import { notFound } from "next/navigation";

import { NovelWorkbenchService } from "@aifiction/data";

import { WorkDetailShell } from "../../../components/work-detail-shell";

export const dynamic = "force-dynamic";

interface WorkDetailPageProps {
  params: {
    slug: string;
  };
  searchParams?: {
    view?: string;
  };
}

export default async function WorkDetailPage({ params, searchParams }: WorkDetailPageProps) {
  const workbenchService = new NovelWorkbenchService();
  const snapshot = await workbenchService.getProjectSnapshotBySlug(decodeURIComponent(params.slug));

  if (!snapshot) {
    notFound();
  }

  return <WorkDetailShell snapshot={snapshot} activeView={searchParams?.view} />;
}
