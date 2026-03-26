import http from "node:http";

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
          snippet: body.slice(0, 120).replace(/\s+/g, " ").trim(),
        });
      });
    });

    request.on("error", (error) => {
      resolve({
        ok: false,
        statusCode: 0,
        durationMs: Date.now() - startedAt,
        snippet: error.message,
      });
    });

    request.setTimeout(3000, () => {
      request.destroy(new Error("Request timed out after 3000ms"));
    });
  });
}

const result = await checkTarget(target);
console.log(`[AiFiction] Web health check`);
console.log(`TARGET=${target}`);
console.log(`STATUS=${result.statusCode}`);
console.log(`OK=${result.ok}`);
console.log(`DURATION_MS=${result.durationMs}`);
console.log(`DETAIL=${result.snippet || "(empty)"}`);
process.exit(result.ok ? 0 : 1);
