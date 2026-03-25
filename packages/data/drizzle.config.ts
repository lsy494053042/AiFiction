import path from "node:path";

import { defineConfig } from "drizzle-kit";

const databasePath = process.env.AIFICTION_DB_PATH
  ? path.resolve(process.env.AIFICTION_DB_PATH)
  : path.resolve(process.cwd(), "..", "..", "storage", "db", "aifiction.sqlite");

export default defineConfig({
  dialect: "sqlite",
  // V1 继续支撑当前 demo，V2 与之并行设计，因此迁移入口需要同时看见两套 schema。
  schema: ["./src/schema.ts", "./src/v2/*.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: `file:${databasePath.replace(/\\/g, "/")}`,
  },
  verbose: true,
  strict: true,
});
