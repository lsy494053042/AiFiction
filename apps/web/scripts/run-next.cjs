#!/usr/bin/env node

/**
 * 本地 Next 启动包装脚本。
 * 目前用于在 workspace 模式下忽略 Next 14 的 lockfile 自动修补噪音，避免开发日志被误导性错误刷屏。
 */
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = process.env.NEXT_IGNORE_INCORRECT_LOCKFILE || "1";

require("next/dist/bin/next");