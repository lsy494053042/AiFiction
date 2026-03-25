import type { JsonObject } from "../../foundation/base-columns";

export interface ExistingLifecycleRow {
  createdAt: string;
  version: number;
}

/**
 * 返回统一时间戳。
 * 仓储层统一使用 ISO 字符串，便于日志、导出和后续迁移。
 */
export function nowIsoString(): string {
  return new Date().toISOString();
}

/**
 * 组装 V2 核心表通用生命周期字段。
 * 新纪录从 version=1 起步，更新时自动递增版本号。
 */
export function buildLifecycleValues(input: {
  existing?: ExistingLifecycleRow | null;
  status: string;
  timestamp?: string;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}) {
  const timestamp = input.timestamp ?? nowIsoString();

  return {
    status: input.status,
    version: (input.existing?.version ?? 0) + 1,
    createdAt: input.existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    metaJson: input.metaJson ?? {},
    extraJson: input.extraJson ?? {},
  };
}

/**
 * 取出数组型扩展字段。
 * 避免调用方每次都手写一遍 JSON 容错逻辑。
 */
export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
