import http from "node:http";
import { execFileSync } from "node:child_process";

const port = Number(process.env.AIFICTION_WEB_PORT ?? "8080");
const host = process.env.AIFICTION_WEB_HOST ?? "127.0.0.1";
const path = process.env.AIFICTION_WEB_PATH ?? "/";
const target = `http://${host}:${port}${path}`;

function checkTarget(url) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 400,
          statusCode: response.statusCode ?? 0,
          durationMs: Date.now() - startedAt,
          detail: body.slice(0, 120).replace(/\s+/g, " ").trim(),
        });
      });
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        statusCode: 0,
        durationMs: Date.now() - startedAt,
        detail: error.message,
      });
    });

    request.setTimeout(3000, () => {
      request.destroy(new Error("Request timed out after 3000ms"));
    });
  });
}

function runPowerShell(script) {
  try {
    const output = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();

    if (!output) {
      return [];
    }

    return JSON.parse(output);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const health = await checkTarget(target);
const listeners = runPowerShell(`
  $items = @(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, OwningProcess)
  if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Depth 3 -Compress }
`);
const processes = runPowerShell(`
  $items = @(Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*AiFiction*' } |
    Select-Object ProcessId, CommandLine)
  if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Depth 4 -Compress }
`);

console.log("[AiFiction] Web doctor");
console.log(`TARGET=${target}`);
console.log(`STATUS=${health.statusCode}`);
console.log(`OK=${health.ok}`);
console.log(`DURATION_MS=${health.durationMs}`);
console.log(`DETAIL=${health.detail || "(empty)"}`);
console.log(`LISTENERS=${JSON.stringify(listeners)}`);
console.log(`AIFICTION_NODE_PROCESSES=${JSON.stringify(processes)}`);
console.log("NEXT_STEPS=Use npm run dev:web to start the app, npm run web:health to re-check, and kill duplicate AiFiction node processes if the page keeps spinning.");
process.exit(health.ok ? 0 : 1);
