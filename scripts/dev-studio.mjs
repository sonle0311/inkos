#!/usr/bin/env node
// Cross-platform dev launcher for InkOS Studio (works on Windows & Unix).
// Runs the API server (tsx watch) and the vite client together, mirroring
// `inkos studio` behavior: it locates (or initializes) a project root with
// inkos.json and passes it to the server as argv[2].
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const studioDir = join(repoRoot, "packages", "studio");

// --- Locate / prepare a project root -------------------------------------
function findProjectRoot() {
  // Allow explicit override, else prefer cwd when it already is a project.
  const explicit = process.env.INKOS_PROJECT_ROOT;
  if (explicit) {
    const p = resolve(explicit);
    if (existsSync(join(p, "inkos.json"))) return p;
    console.warn(`INKOS_PROJECT_ROOT=${p} has no inkos.json; falling back.`);
  }
  if (existsSync(join(process.cwd(), "inkos.json"))) return process.cwd();
  // Monorepo dev convenience: repo root itself gets a minimal inkos.json.
  if (existsSync(join(repoRoot, "inkos.json"))) return repoRoot;
  // Final fallback: initialize a minimal project in cwd (like `inkos studio`).
  return process.cwd();
}

const projectRoot = findProjectRoot();
if (!existsSync(join(projectRoot, "inkos.json"))) {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(join(projectRoot, "books"), { recursive: true });
  writeFileSync(
    join(projectRoot, "inkos.json"),
    JSON.stringify(
      {
        name: "dev-studio",
        version: "0.1.0",
        language: "zh",
        llm: { provider: "openai", service: "custom", configSource: "studio" },
        notify: [],
        inputGovernanceMode: "v2",
        daemon: { schedule: { radarCron: "0 */6 * * *", writeCron: "*/15 * * * *" }, maxConcurrentBooks: 3 },
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`Initialized minimal inkos.json in ${projectRoot} for dev.`);
}

const serverOnly = process.argv.includes("--server-only");
const apiPort = process.env.INKOS_STUDIO_PORT ?? "4569";
const clientPort = process.env.INKOS_VITE_PORT ?? "4567";

const env = {
  ...process.env,
  INKOS_STUDIO_PORT: apiPort,
  INKOS_PROJECT_ROOT: projectRoot,
};

const tsxBin = join(studioDir, "node_modules", ".bin", "tsx");
const viteBin = join(studioDir, "node_modules", ".bin", "vite");

// Windows needs the .cmd shim; Unix uses the shell script directly.
const bin = (p) => (process.platform === "win32" ? `${p}.cmd` : p);

console.log(`[studio] project root: ${projectRoot}`);
console.log(`[studio] API  server:  http://localhost:${apiPort}`);
console.log(`[studio] Vite  client:  http://localhost:${clientPort} (proxies /api -> ${apiPort})`);

const server = spawn(bin(tsxBin), ["watch", join(studioDir, "src", "api", "index.ts"), projectRoot], {
  cwd: studioDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const client = serverOnly
  ? null
  : spawn(bin(viteBin), ["--host", "--port", clientPort], {
      cwd: studioDir,
      env: { ...env, INKOS_STUDIO_PORT: apiPort },
      stdio: "inherit",
      shell: process.platform === "win32",
    });

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill();
  if (client) client.kill();
  process.exit(code);
}

server.on("exit", (code) => {
  console.error(`[studio] API server exited (${code}). Stopping vite client.`);
  shutdown(code ?? 1);
});
client?.on("exit", (code) => {
  console.error(`[studio] Vite client exited (${code}). Stopping API server.`);
  shutdown(code ?? 1);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
