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

function buildWorkViewHref(workSlug: string, view?: string): string {
  const targetView = view && view !== "overview" ? view : "overview";
  return `/works/${encodeURIComponent(workSlug)}/${targetView}`;
}

function revalidateWorkPaths(workSlug: string, view?: string) {
  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  revalidatePath(buildWorkViewHref(workSlug, view));
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

export async function bindWorkSourceAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const returnView = readOptionalText(formData, "returnView") ?? "settings";

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

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkViewHref(workSlug, returnView));
}

export async function rescanWorkSourceAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const fileSourceId = readRequiredText(formData, "fileSourceId", "目录源 ID");
  const returnView = readOptionalText(formData, "returnView") ?? "settings";

  await syncService.scanFileSource(fileSourceId, "manual-web-rescan");

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkViewHref(workSlug, returnView));
}

export async function decideReviewAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const reviewId = readRequiredText(formData, "reviewId", "审查项 ID");
  const decision = readRequiredText(formData, "decision", "审查决定");
  const returnView = readOptionalText(formData, "returnView") ?? "issues";

  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("不支持的审查决定。");
  }

  await decideReviewIds({
    reviewIds: [reviewId],
    decision,
    decisionNote: readOptionalText(formData, "decisionNote"),
  });

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkViewHref(workSlug, returnView));
}

export async function decideReviewBundleAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const decision = readRequiredText(formData, "decision", "审查决定");
  const reviewIds = readReviewIdList(formData);
  const returnView = readOptionalText(formData, "returnView") ?? "issues";

  if (!reviewIds.length) {
    throw new Error("没有收到可处理的审查项 ID。");
  }
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("不支持的审查决定。");
  }

  await decideReviewIds({
    reviewIds,
    decision,
    decisionNote: readOptionalText(formData, "decisionNote"),
  });

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkViewHref(workSlug, returnView));
}

export async function autoRouteProjectReviewsAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const workId = readRequiredText(formData, "workId", "作品 ID");
  const returnView = readOptionalText(formData, "returnView") ?? "issues";

  await reviewQueueService.autoRouteProjectReviewItems({
    projectId: workId,
    decisionNote: readOptionalText(formData, "decisionNote") ?? "系统已自动分流当前待处理项，并自动通过低风险部分。",
  });

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkViewHref(workSlug, returnView));
}

export async function autoApproveLowRiskBundlesAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const reviewIds = readReviewIdList(formData);
  const returnView = readOptionalText(formData, "returnView") ?? "issues";

  if (!reviewIds.length) {
    throw new Error("没有收到可自动通过的审查项 ID。");
  }

  await reviewQueueService.autoApproveReviewItems({
    reviewIds,
    decisionNote: readOptionalText(formData, "decisionNote") ?? "系统已自动通过低风险变更。",
  });

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkViewHref(workSlug, returnView));
}

export async function updateFollowUpTaskAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const workId = readRequiredText(formData, "workId", "作品 ID");
  const chapterId = readRequiredText(formData, "chapterId", "章节 ID");
  const taskKind = readRequiredText(formData, "taskKind", "任务类型");
  const taskFingerprint = readRequiredText(formData, "taskFingerprint", "任务指纹");
  const taskResult = readOptionalText(formData, "taskResult");
  const explicitTaskStatus = readOptionalText(formData, "taskStatus");
  const explicitTaskOutcome = readOptionalText(formData, "taskOutcome");
  const returnView = readOptionalText(formData, "returnView") ?? "issues";

  if (taskKind !== "formal-review") {
    throw new Error("暂不支持这个复核任务类型。");
  }

  const [resultStatus, resultOutcome] = taskResult ? taskResult.split(":", 2) : [];
  const taskStatus = explicitTaskStatus ?? resultStatus ?? "pending";
  const taskOutcome = explicitTaskOutcome ?? resultOutcome ?? undefined;

  if (!["pending", "in_review", "completed", "dismissed"].includes(taskStatus)) {
    throw new Error("不支持的任务状态。");
  }

  await reviewQueueService.updateFollowUpTaskState({
    projectId: workId,
    chapterId,
    taskKind: "formal-review",
    taskFingerprint,
    taskStatus: taskStatus as "pending" | "in_review" | "completed" | "dismissed",
    taskOutcome: taskOutcome as "consistent" | "needs-revision" | "needs-rescan" | "deferred" | undefined,
    outcomeSummary: readOptionalText(formData, "outcomeSummary"),
    decisionNote: readOptionalText(formData, "decisionNote"),
  });

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkViewHref(workSlug, returnView));
}
