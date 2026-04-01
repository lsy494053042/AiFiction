"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { WorkspaceProtocolService } from "@aifiction/data";

const protocolService = new WorkspaceProtocolService();

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

function buildWorkHref(workSlug: string, view?: string): string {
  const targetView = view && view !== "overview" ? view : "overview";
  return `/works/${encodeURIComponent(workSlug)}/${targetView}`;
}

function revalidateWorkPaths(workSlug: string, view?: string) {
  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  revalidatePath(buildWorkHref(workSlug, view));
}

export async function bootstrapWorkProtocolAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const returnView = readOptionalText(formData, "returnView") ?? "overview";

  await protocolService.bootstrapWorkProtocolBySlug(workSlug);

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkHref(workSlug, returnView));
}

export async function generateWritingPackAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const returnView = readOptionalText(formData, "returnView") ?? "overview";

  await protocolService.generateWritingPackBySlug(workSlug);

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkHref(workSlug, returnView));
}

export async function generateRiskInvestigationPackAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品 slug");
  const bundleId = String(formData.get("bundleId") ?? "").trim() || undefined;
  const returnView = readOptionalText(formData, "returnView") ?? "issues";

  await protocolService.generateRiskInvestigationPackBySlug(workSlug, bundleId);

  revalidateWorkPaths(workSlug, returnView);
  redirect(buildWorkHref(workSlug, returnView));
}
