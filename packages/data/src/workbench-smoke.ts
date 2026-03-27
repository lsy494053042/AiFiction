import { NovelWorkbenchService } from "./workbench/novel-workbench.service";

async function main() {
  const service = new NovelWorkbenchService();
  const snapshot = await service.getProjectSnapshotBySlug("demo-work-v2");
  const bundle = snapshot?.pendingReviewBundles[0];

  console.log(`[AiFiction Data] Review bundle count: ${snapshot?.pendingReviewBundles.length ?? 0}`);
  console.log(`[AiFiction Data] First bundle title: ${bundle?.title ?? "N/A"}`);
  console.log(`[AiFiction Data] Impact summary: ${bundle?.impactSummary?.summary ?? "N/A"}`);
  console.log(`[AiFiction Data] Impact entries: ${bundle?.impactSummary?.topEntries.length ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});