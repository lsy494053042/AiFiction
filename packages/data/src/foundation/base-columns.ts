import { integer, text } from "drizzle-orm/sqlite-core";

export type JsonObject = Record<string, unknown>;

/**
 * 生命周期字段。
 * 所有 V2 核心表都建议保留这些列，方便软删除、版本递增和审计。
 */
export function lifecycleColumns() {
  return {
    status: text("status").notNull(),
    version: integer("version").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
    metaJson: text("meta_json", { mode: "json" }).$type<JsonObject>().notNull(),
    extraJson: text("extra_json", { mode: "json" }).$type<JsonObject>().notNull(),
  };
}

/**
 * 排序字段。
 * 对卷、章、场景、标签等有自然顺序的表统一复用。
 */
export function orderingColumns() {
  return {
    sortOrder: integer("sort_order").notNull(),
  };
}

/**
 * 可选的显示名称字段。
 * 一些系统内部对象可能会有 code 和 displayName 两套标识。
 */
export function displayColumns() {
  return {
    code: text("code").notNull(),
    displayName: text("display_name").notNull(),
  };
}