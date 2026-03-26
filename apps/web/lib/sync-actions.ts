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

/**
 * 绑定本地目录并立即执行首轮扫描。
 * 这样用户第一次录入路径后，工作台就能马上看到待审查结果。
 */
export async function bindWorkSourceAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");

  const fileSource = await syncService.bindProjectFileSource({
    projectId: readRequiredText(formData, "workId", "作品 ID"),
    sourceKey: readOptionalText(formData, "sourceKey"),
    label: readOptionalText(formData, "label"),
    sourceKind: "local-directory",
    rootPath: readRequiredText(formData, "rootPath", "本地目录"),
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
 * 对已绑定目录执行手动重扫。
 * 后续接入文件监听前，页面上的这个入口就是最直接的同步按钮。
 */
export async function rescanWorkSourceAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");
  const fileSourceId = readRequiredText(formData, "fileSourceId", "目录源 ID");

  await syncService.scanFileSource(fileSourceId, "manual-web-rescan");

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

/**
 * 处理待审查项。
 * 当前先打通“通过 / 驳回”与状态回写，后续再继续接事实层回写。
 */
export async function decideReviewAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");
  const reviewId = readRequiredText(formData, "reviewId", "审查项 ID");
  const decision = readRequiredText(formData, "decision", "审查决策");

  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("Unsupported review decision.");
  }

  await reviewQueueService.decideReviewItem({
    reviewId,
    decision,
    decisionNote: readOptionalText(formData, "decisionNote"),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}