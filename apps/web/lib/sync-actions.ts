"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { NovelProjectSyncService, SyncReviewQueueService } from "@aifiction/data";

const syncService = new NovelProjectSyncService();
const reviewQueueService = new SyncReviewQueueService();

function readRequiredText(formData: FormData, field: string, label: string): string {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) {
    throw new Error(`${label}不能为空。`);
  }
  return value;
}

function readOptionalText(formData: FormData, field: string): string | undefined {
  const value = String(formData.get(field) ?? "").trim();
  return value || undefined;
}

function readReviewIdList(formData: FormData, field = "reviewIds"): string[] {
  return String(formData.get(field) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function decideReviewIds(input: {
  reviewIds: string[];
  decision: "approved" | "rejected";
  decisionNote?: string;
}) {
  for (const reviewId of input.reviewIds) {
    await reviewQueueService.decideReviewItem({
      reviewId,
      decision: input.decision,
      decisionNote: input.decisionNote,
    });
  }
}

/**
 * 绑定作品目录源。
 * 绑定完成后会立即执行一次扫描，确保工作台能立刻看到最新状态。
 */
export async function bindWorkSourceAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");

  const fileSource = await syncService.bindProjectFileSource({
    projectId: readRequiredText(formData, "workId", "作品 ID"),
    sourceKey: readOptionalText(formData, "sourceKey"),
    label: readOptionalText(formData, "label"),
    sourceKind: "local-directory",
    rootPath: readRequiredText(formData, "rootPath", "根目录"),
    chapterPath: readOptionalText(formData, "chapterPath"),
    outlinePath: readOptionalText(formData, "outlinePath"),
    exportPath: readOptionalText(formData, "exportPath"),
  });

  await syncService.scanFileSource(fileSource.id, "manual-web-bind");

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

/**
 * 重新扫描已绑定目录源。
 * 用于在本地章节新增或修改后手动触发一次同步。
 */
export async function rescanWorkSourceAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const fileSourceId = readRequiredText(formData, "fileSourceId", "目录源 ID");

  await syncService.scanFileSource(fileSourceId, "manual-web-rescan");

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

/**
 * 处理单条审查项。
 * 主要用于对单个 review item 执行通过或驳回。
 */
export async function decideReviewAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const reviewId = readRequiredText(formData, "reviewId", "审查项 ID");
  const decision = readRequiredText(formData, "decision", "处理决定");

  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("不支持的审查决定。");
  }

  await decideReviewIds({
    reviewIds: [reviewId],
    decision,
    decisionNote: readOptionalText(formData, "decisionNote"),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

/**
 * 处理整包变更。
 * 用于对一个变更包里的所有 review item 批量执行通过或驳回。
 */
export async function decideReviewBundleAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const decision = readRequiredText(formData, "decision", "处理决定");
  const reviewIds = readReviewIdList(formData);

  if (!reviewIds.length) {
    throw new Error("没有提供审查项 ID。");
  }
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("不支持的审查决定。");
  }

  await decideReviewIds({
    reviewIds,
    decision,
    decisionNote: readOptionalText(formData, "decisionNote"),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

/**
 * 自动通过低风险变更包。
 * 这里仍然由服务端做最终校验，避免前端误传导致越权自动通过。
 */
export async function autoApproveLowRiskBundlesAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const reviewIds = readReviewIdList(formData);

  if (!reviewIds.length) {
    throw new Error("没有提供低风险审查项 ID。");
  }

  await reviewQueueService.autoApproveReviewItems({
    reviewIds,
    decisionNote: readOptionalText(formData, "decisionNote") ?? "系统自动通过低风险变更包。",
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}