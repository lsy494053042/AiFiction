"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { NovelWorkbenchMutationService } from "@aifiction/data";

const mutationService = new NovelWorkbenchMutationService();

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

function readInteger(formData: FormData, field: string, fallback: number): number {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readList(formData: FormData, field: string): string[] {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(/[\n,，；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createWorkAction(formData: FormData) {
  const work = await mutationService.createWork({
    title: readRequiredText(formData, "title", "作品标题"),
    slug: readOptionalText(formData, "slug"),
    tagline: readRequiredText(formData, "tagline", "一句话卖点"),
    genre: readRequiredText(formData, "genre", "主类型"),
    subgenre: readOptionalText(formData, "subgenre"),
    targetPlatform: readRequiredText(formData, "targetPlatform", "目标平台"),
    targetAudience: readList(formData, "targetAudience"),
    targetWordCount: readInteger(formData, "targetWordCount", 1200000),
    dailyWordTarget: readInteger(formData, "dailyWordTarget", 4000),
    updateCadence: readOptionalText(formData, "updateCadence"),
    commercialHooks: readList(formData, "commercialHooks"),
    hardConstraints: readList(formData, "hardConstraints"),
    contentWarnings: readList(formData, "contentWarnings"),
  });

  revalidatePath("/");
  redirect(`/works/${work.slug}`);
}

export async function updateWorkAction(formData: FormData) {
  const previousWorkSlug = readRequiredText(formData, "previousWorkSlug", "旧作品标识");
  const work = await mutationService.updateWork({
    workId: readRequiredText(formData, "workId", "作品 ID"),
    title: readRequiredText(formData, "title", "作品标题"),
    slug: readOptionalText(formData, "slug"),
    tagline: readRequiredText(formData, "tagline", "一句话卖点"),
    genre: readRequiredText(formData, "genre", "主类型"),
    subgenre: readOptionalText(formData, "subgenre"),
    targetPlatform: readRequiredText(formData, "targetPlatform", "目标平台"),
    targetAudience: readList(formData, "targetAudience"),
    targetWordCount: readInteger(formData, "targetWordCount", 1200000),
    dailyWordTarget: readInteger(formData, "dailyWordTarget", 4000),
    updateCadence: readOptionalText(formData, "updateCadence"),
    commercialHooks: readList(formData, "commercialHooks"),
    hardConstraints: readList(formData, "hardConstraints"),
    contentWarnings: readList(formData, "contentWarnings"),
  });

  revalidatePath("/");
  revalidatePath(`/works/${previousWorkSlug}`);
  revalidatePath(`/works/${work.slug}`);
  redirect(`/works/${work.slug}`);
}

export async function createVolumeAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");

  await mutationService.createVolume({
    workId: readRequiredText(formData, "workId", "作品 ID"),
    title: readRequiredText(formData, "title", "分卷标题"),
    goal: readRequiredText(formData, "goal", "阶段目标"),
    mainConflict: readRequiredText(formData, "mainConflict", "主冲突"),
    entryHook: readOptionalText(formData, "entryHook"),
    climax: readOptionalText(formData, "climax"),
    payoff: readOptionalText(formData, "payoff"),
    mustDeliverInfo: readList(formData, "mustDeliverInfo"),
    keyCharacters: readList(formData, "keyCharacters"),
    plannedChapterCount: readInteger(formData, "plannedChapterCount", 24),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

export async function updateVolumeAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");

  await mutationService.updateVolume({
    volumeId: readRequiredText(formData, "volumeId", "分卷 ID"),
    workId: readRequiredText(formData, "workId", "作品 ID"),
    title: readRequiredText(formData, "title", "分卷标题"),
    goal: readRequiredText(formData, "goal", "阶段目标"),
    mainConflict: readRequiredText(formData, "mainConflict", "主冲突"),
    entryHook: readOptionalText(formData, "entryHook"),
    climax: readOptionalText(formData, "climax"),
    payoff: readOptionalText(formData, "payoff"),
    mustDeliverInfo: readList(formData, "mustDeliverInfo"),
    keyCharacters: readList(formData, "keyCharacters"),
    plannedChapterCount: readInteger(formData, "plannedChapterCount", 24),
    order: readInteger(formData, "order", 1),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

export async function createCharacterAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");

  await mutationService.createCharacter({
    workId: readRequiredText(formData, "workId", "作品 ID"),
    name: readRequiredText(formData, "name", "角色名"),
    role: readRequiredText(formData, "role", "角色定位"),
    archetype: readRequiredText(formData, "archetype", "角色原型"),
    publicIdentity: readRequiredText(formData, "publicIdentity", "公开身份"),
    hiddenIdentity: readOptionalText(formData, "hiddenIdentity"),
    coreDesire: readRequiredText(formData, "coreDesire", "核心欲望"),
    coreFear: readRequiredText(formData, "coreFear", "核心恐惧"),
    strengths: readList(formData, "strengths"),
    flaws: readList(formData, "flaws"),
    secrets: readList(formData, "secrets"),
    speechStyle: readList(formData, "speechStyle"),
    growthArc: readRequiredText(formData, "growthArc", "成长弧"),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

export async function updateCharacterAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");

  await mutationService.updateCharacter({
    characterId: readRequiredText(formData, "characterId", "角色 ID"),
    workId: readRequiredText(formData, "workId", "作品 ID"),
    name: readRequiredText(formData, "name", "角色名"),
    role: readRequiredText(formData, "role", "角色定位"),
    archetype: readRequiredText(formData, "archetype", "角色原型"),
    publicIdentity: readRequiredText(formData, "publicIdentity", "公开身份"),
    hiddenIdentity: readOptionalText(formData, "hiddenIdentity"),
    coreDesire: readRequiredText(formData, "coreDesire", "核心欲望"),
    coreFear: readRequiredText(formData, "coreFear", "核心恐惧"),
    strengths: readList(formData, "strengths"),
    flaws: readList(formData, "flaws"),
    secrets: readList(formData, "secrets"),
    speechStyle: readList(formData, "speechStyle"),
    growthArc: readRequiredText(formData, "growthArc", "成长弧"),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

export async function createChapterAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");

  await mutationService.createChapter({
    workId: readRequiredText(formData, "workId", "作品 ID"),
    volumeId: readRequiredText(formData, "volumeId", "所属分卷"),
    title: readRequiredText(formData, "title", "章节标题"),
    summary: readRequiredText(formData, "summary", "章节摘要"),
    chapterGoal: readRequiredText(formData, "chapterGoal", "章节目标"),
    conflict: readRequiredText(formData, "conflict", "核心冲突"),
    entryState: readRequiredText(formData, "entryState", "进入状态"),
    exitState: readRequiredText(formData, "exitState", "离开状态"),
    endingHook: readRequiredText(formData, "endingHook", "结尾钩子"),
    newInfo: readList(formData, "newInfo"),
    foreshadowSeeds: readList(formData, "foreshadowSeeds"),
    requiredCallbacks: readList(formData, "requiredCallbacks"),
    keyCharacters: readList(formData, "keyCharacters"),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}

export async function updateChapterAction(formData: FormData) {
  const workSlug = readRequiredText(formData, "workSlug", "作品标识");

  await mutationService.updateChapter({
    chapterId: readRequiredText(formData, "chapterId", "章节 ID"),
    workId: readRequiredText(formData, "workId", "作品 ID"),
    volumeId: readRequiredText(formData, "volumeId", "所属分卷"),
    title: readRequiredText(formData, "title", "章节标题"),
    summary: readRequiredText(formData, "summary", "章节摘要"),
    chapterGoal: readRequiredText(formData, "chapterGoal", "章节目标"),
    conflict: readRequiredText(formData, "conflict", "核心冲突"),
    entryState: readRequiredText(formData, "entryState", "进入状态"),
    exitState: readRequiredText(formData, "exitState", "离开状态"),
    endingHook: readRequiredText(formData, "endingHook", "结尾钩子"),
    newInfo: readList(formData, "newInfo"),
    foreshadowSeeds: readList(formData, "foreshadowSeeds"),
    requiredCallbacks: readList(formData, "requiredCallbacks"),
    keyCharacters: readList(formData, "keyCharacters"),
    order: readInteger(formData, "order", 1),
  });

  revalidatePath("/");
  revalidatePath(`/works/${workSlug}`);
  redirect(`/works/${workSlug}`);
}