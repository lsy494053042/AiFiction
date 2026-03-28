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

function buildWorkViewHref(workSlug: string, view?: string): string {
  return view && view !== "overview" ? `/works/${workSlug}?view=${view}` : `/works/${workSlug}`;
}

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

export async function rescanWorkSourceAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const fileSourceId = readRequiredText(formData, "fileSourceId", "目录源 ID");

  await syncService.scanFileSource(fileSourceId, "manual-web-rescan");

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

export async function decideReviewAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const reviewId = readRequiredText(formData, "reviewId", "审查项 ID");
  const decision = readRequiredText(formData, "decision", "审查决定");

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

export async function decideReviewBundleAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const decision = readRequiredText(formData, "decision", "审查决定");
  const reviewIds = readReviewIdList(formData);

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

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

export async function autoRouteProjectReviewsAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const workId = readRequiredText(formData, "workId", "作品 ID");

  await reviewQueueService.autoRouteProjectReviewItems({
    projectId: workId,
    decisionNote: readOptionalText(formData, "decisionNote") ?? "系统已自动分流当前待处理项，并自动通过低风险部分。",
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}?view=reviews`);
}

export async function autoApproveLowRiskBundlesAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const reviewIds = readReviewIdList(formData);

  if (!reviewIds.length) {
    throw new Error("没有收到可自动通过的审查项 ID。");
  }

  await reviewQueueService.autoApproveReviewItems({
    reviewIds,
    decisionNote: readOptionalText(formData, "decisionNote") ?? "系统已自动通过低风险变更包。",
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}
export async function updateFollowUpTaskAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "work slug");
  const workId = readRequiredText(formData, "workId", "work ID");
  const chapterId = readRequiredText(formData, "chapterId", "chapter ID");
  const taskKind = readRequiredText(formData, "taskKind", "task kind");
  const taskFingerprint = readRequiredText(formData, "taskFingerprint", "task fingerprint");
  const taskResult = readOptionalText(formData, "taskResult");
  const explicitTaskStatus = readOptionalText(formData, "taskStatus");
  const explicitTaskOutcome = readOptionalText(formData, "taskOutcome");
  const returnView = readOptionalText(formData, "returnView") ?? "overview";

  if (taskKind !== "formal-review") {
    throw new Error("Unsupported follow-up task kind.");
  }

  const [resultStatus, resultOutcome] = taskResult ? taskResult.split(":", 2) : [];
  const taskStatus = explicitTaskStatus ?? resultStatus ?? "pending";
  const taskOutcome = explicitTaskOutcome ?? resultOutcome ?? undefined;

  if (!["pending", "in_review", "completed", "dismissed"].includes(taskStatus)) {
    throw new Error("Unsupported follow-up task status.");
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

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(buildWorkViewHref(workSlug, returnView));
}

